// SPDX-License-Identifier: GPL-3.0-only
import type { NpcShip } from '../../sim/npc/npc';

/** New NPCs fade in, and departed ones fade out where they were (slice 2 spec §4.5). */
export const NPC_FADE_SEC = 1.5;
const MAX_GHOSTS = 12;

interface Ghost {
  readonly npc: NpcShip;
  readonly leftAtSec: number;
}

/**
 * Presentation-only memory of when each NPC first appeared on screen and which have just left.
 * The simulation spawns and despawns instantly; this only softens it for the eye.
 */
export class NpcFade {
  private readonly firstSeenSec = new Map<number, number>();
  private readonly ghosts: Ghost[] = [];

  /** Show these ships at full strength at once (e.g. a voyage loaded from the save). */
  revealAll(npcs: readonly NpcShip[], nowSec: number): void {
    this.firstSeenSec.clear();
    this.ghosts.length = 0;
    for (const npc of npcs) this.firstSeenSec.set(npc.id, nowSec - NPC_FADE_SEC);
  }

  /** Remember ships that just left the map, to fade them out. */
  departed(npcs: readonly NpcShip[], nowSec: number): void {
    for (const npc of npcs) {
      this.firstSeenSec.delete(npc.id);
      if (this.ghosts.length >= MAX_GHOSTS) this.ghosts.shift();
      this.ghosts.push({ npc, leftAtSec: nowSec });
    }
  }

  /** Opacity of a ship at sea: rises from 0 to 1 over 1.5 s after it is first seen. */
  alpha(npcId: number, nowSec: number): number {
    let seen = this.firstSeenSec.get(npcId);
    if (seen === undefined) {
      seen = nowSec;
      this.firstSeenSec.set(npcId, seen);
    }
    return Math.min(1, Math.max(0, (nowSec - seen) / NPC_FADE_SEC));
  }

  /** Ships still fading out, with their opacity. Expired ones are forgotten. */
  fadingOut(nowSec: number, visit: (npc: NpcShip, alpha: number) => void): void {
    while (this.ghosts.length > 0 && nowSec - this.ghosts[0]!.leftAtSec >= NPC_FADE_SEC) {
      this.ghosts.shift();
    }
    for (const ghost of this.ghosts) {
      visit(ghost.npc, 1 - (nowSec - ghost.leftAtSec) / NPC_FADE_SEC);
    }
  }
}
