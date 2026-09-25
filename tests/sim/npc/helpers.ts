// SPDX-License-Identifier: GPL-3.0-only
// Shared helpers for NPC tests (not a test file itself).
import { PORTS } from '../../../src/data/ports';
import { SIM_STEP_SECONDS } from '../../../src/data/constants';
import { WORLD_SAILING_SCALE } from '../../../src/data/sailing';
import { SHIP_CLASSES, type ShipClassId } from '../../../src/data/ships';
import { advanceClock } from '../../../src/sim/time';
import { Navigator } from '../../../src/sim/npc/navigator';
import type { NpcShip } from '../../../src/sim/npc/npc';
import { decideSailing, helmInput, type SailDecision } from '../../../src/sim/npc/sail';
import { createRng } from '../../../src/sim/rng';
import { stepShip } from '../../../src/sim/sailing/ship';
import type { Wind } from '../../../src/sim/sailing/wind';
import { fullCondition, performanceOf } from '../../../src/sim/ships/condition';
import type { Port } from '../../../src/sim/world/ports';
import type { WorldPoint } from '../../../src/sim/world/projection';
import { createWorld } from '../../../src/sim/world/world';

/** Open water of the given size, with one fake port whose harbour is at `harbour`. */
export function openSea(width: number, height: number, harbour: WorldPoint): Navigator {
  const world = createWorld(width, height, new Uint8Array(width * height));
  const port: Port = { def: { ...PORTS[0]!, id: 'test-port' }, town: harbour, harbour };
  return new Navigator(world, [port]);
}

export function makeNpc(overrides: Partial<NpcShip> & { classId?: ShipClassId } = {}): NpcShip {
  const classId = overrides.classId ?? 'sloop';
  const at = overrides.ship ?? { x: 100, y: 200, headingRad: 0, speedKn: 0, sail: 'full' as const };
  return {
    id: 1,
    classId,
    nation: 'en',
    role: 'trader',
    name: 'Test',
    condition: fullCondition(SHIP_CLASSES[classId], SHIP_CLASSES[classId].crewTypical),
    destPortId: 'test-port',
    path: [],
    tack: null,
    intent: 'travel',
    ignorePlayerUntilHours: 0,
    home: { x: at.x, y: at.y },
    loiterUntilHours: 0,
    targetHeadingRad: at.headingRad,
    progress: { x: at.x, y: at.y, atHours: 0 },
    ...overrides,
    ship: at,
  };
}

/**
 * Sail one NPC on its own: AI every 0.4 game hours, physics every step. Returns the final ship
 * and why it stopped.
 */
export function sailAlone(
  nav: Navigator,
  start: NpcShip,
  wind: Wind,
  maxHours: number,
): { npc: NpcShip; left: SailDecision | null; hours: number } {
  let npc = start;
  let hours = 0;
  const rng = createRng(9);
  const cls = SHIP_CLASSES[npc.classId];
  while (hours < maxHours) {
    const next = advanceClock(hours, SIM_STEP_SECONDS);
    if (Math.floor(next / 0.4) !== Math.floor(hours / 0.4)) {
      const d = decideSailing(npc, { wind, hours: next, nav, rng: () => rng });
      if ('leave' in d) return { npc, left: d, hours: next };
      npc = d.npc;
    }
    const r = stepShip(npc.ship, helmInput(npc), wind, nav.world, SIM_STEP_SECONDS, {
      performance: performanceOf(cls, npc.condition),
      scale: WORLD_SAILING_SCALE,
    });
    npc = { ...npc, ship: r.ship };
    hours = next;
  }
  return { npc, left: null, hours };
}
