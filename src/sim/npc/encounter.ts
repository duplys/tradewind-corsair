// SPDX-License-Identifier: GPL-3.0-only
import {
  CAUGHT_RANGE_PX,
  ESCAPE_IGNORE_HOURS,
  ESCAPE_SEPARATION_PX,
  HAIL_RANGE_PX,
  LEAVE_IGNORE_HOURS,
} from '../../data/encounter';
import { hostileToPlayer } from '../../data/relations';
import { BOW_PROBE_PX } from '../../data/sailing';
import type { SailingShip } from '../sailing/ship';
import type { Voyage } from '../voyage';
import type { WorldPoint } from '../world/projection';
import { isLand, type World } from '../world/world';
import type { NpcShip } from './npc';

function nearestWithin(
  npcs: readonly NpcShip[],
  player: WorldPoint,
  rangePx: number,
  accept: (npc: NpcShip) => boolean,
): NpcShip | null {
  let best: NpcShip | null = null;
  let bestD = rangePx;
  for (const npc of npcs) {
    const d = Math.hypot(npc.ship.x - player.x, npc.ship.y - player.y);
    if (d <= bestD && accept(npc)) {
      best = npc;
      bestD = d;
    }
  }
  return best;
}

/** The closest ship the player can close with (within 16 px), for the prompt (§5.3). */
export function hailableNpc(npcs: readonly NpcShip[], player: WorldPoint): NpcShip | null {
  return nearestWithin(npcs, player, HAIL_RANGE_PX, () => true);
}

/** The closest chasing ship that has caught the player (within 12 px), if any (§5.3). */
export function caughtBy(npcs: readonly NpcShip[], player: WorldPoint): NpcShip | null {
  return nearestWithin(npcs, player, CAUGHT_RANGE_PX, (npc) => npc.intent === 'chase');
}

/** Replace one NPC in the voyage by id (unchanged if it is gone). */
export function updateNpc(voyage: Voyage, id: number, change: (npc: NpcShip) => NpcShip): Voyage {
  return { ...voyage, npcs: voyage.npcs.map((npc) => (npc.id === id ? change(npc) : npc)) };
}

/** Leave her be (§5.4): a ship that is not hostile ignores the player for 12 hours. */
export function leaveHerBe(voyage: Voyage, id: number): Voyage {
  const hours = voyage.elapsedHours;
  return updateNpc(voyage, id, (npc) =>
    hostileToPlayer(npc.nation)
      ? npc
      : { ...npc, ignorePlayerUntilHours: hours + LEAVE_IGNORE_HOURS },
  );
}

/** Make a ship stop hunting or running and go about its business, ignoring the player. */
export function breakContact(npc: NpcShip, untilHours: number, hours: number): NpcShip {
  return {
    ...npc,
    intent: 'travel',
    intentSinceHours: hours,
    ignorePlayerUntilHours: Math.max(npc.ignorePlayerUntilHours, untilHours),
    path: [],
  };
}

/**
 * Up to `px` along the ship's heading, stopping short of land (keeping the bow probe clear), so
 * a free separation never puts the ship aground.
 */
export function moveAlongHeading(world: World, ship: SailingShip, px: number): SailingShip {
  const cos = Math.cos(ship.headingRad);
  const sin = Math.sin(ship.headingRad);
  let moved = 0;
  for (let step = 1; step <= px; step++) {
    const x = ship.x + cos * step;
    const y = ship.y + sin * step;
    if (isLand(world, x, y) || isLand(world, x + cos * BOW_PROBE_PX, y + sin * BOW_PROBE_PX)) {
      break;
    }
    moved = step;
  }
  return { ...ship, x: ship.x + cos * moved, y: ship.y + sin * moved };
}

/**
 * A successful escape (§5.4): the chaser ignores the player for 72 hours, and the player gains
 * 20 px along their heading.
 */
export function escaped(voyage: Voyage, world: World, npcId: number): Voyage {
  const hours = voyage.elapsedHours;
  const after = updateNpc(voyage, npcId, (npc) =>
    breakContact(npc, hours + ESCAPE_IGNORE_HOURS, hours),
  );
  return {
    ...after,
    ship: { ...after.ship, ...moveAlongHeading(world, after.ship, ESCAPE_SEPARATION_PX) },
  };
}
