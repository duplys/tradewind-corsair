// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { PORTS } from '../../../src/data/ports';
import { applyCombatResult } from '../../../src/sim/combat/result';
import type { CombatOutcome } from '../../../src/sim/combat/state';
import { newVoyage, type Voyage } from '../../../src/sim/voyage';
import { derivePorts } from '../../../src/sim/world/ports';
import { buildWorld, type World } from '../../../src/sim/world/world';
import { makeNpc } from '../npc/helpers';
import { beamFight } from './helpers';

let world: World;
let voyage: Voyage;

beforeAll(() => {
  world = buildWorld();
  const v = newVoyage(world, derivePorts(world, PORTS));
  const npc = makeNpc({
    id: 5,
    nation: 'es',
    role: 'warship',
    classId: 'frigate',
    intent: 'chase',
    ship: { x: v.ship.x + 10, y: v.ship.y, headingRad: 0, speedKn: 3, sail: 'full' },
  });
  voyage = { ...v, elapsedHours: 100, npcs: [npc] };
});

function after(outcome: CombatOutcome): Voyage {
  const s = beamFight('sloop', 'frigate');
  s.ships[0].condition = { ...s.ships[0].condition, hullPct: 70, crew: 35 };
  s.ships[1].condition = { ...s.ships[1].condition, riggingPct: 40 };
  s.outcome = outcome;
  return applyCombatResult(voyage, world, 5, s);
}

describe('applyCombatResult (interim)', () => {
  it("keeps the player's damage and moves the clock on 6 hours", () => {
    const v = after({ type: 'sunk', shipIndex: 1 });
    expect(v.condition).toMatchObject({ hullPct: 70, crew: 35 });
    expect(v.elapsedHours).toBe(106);
  });

  it('removes a sunk or captured enemy', () => {
    expect(after({ type: 'sunk', shipIndex: 1 }).npcs).toHaveLength(0);
    expect(after({ type: 'captured' }).npcs).toHaveLength(0);
  });

  it('lets an escaped enemy keep its damage and leave the player alone for 48 hours', () => {
    const npc = after({ type: 'escaped', shipIndex: 1 }).npcs[0]!;
    expect(npc.condition.riggingPct).toBe(40);
    expect(npc.intent).toBe('travel');
    expect(npc.ignorePlayerUntilHours).toBe(106 + 48);
  });

  it('moves a player who slipped away 25 px and makes the enemy ignore them for a day', () => {
    const v = after({ type: 'escaped', shipIndex: 0 });
    expect(Math.hypot(v.ship.x - voyage.ship.x, v.ship.y - voyage.ship.y)).toBeCloseTo(25, 5);
    expect(v.npcs[0]!.ignorePlayerUntilHours).toBe(106 + 24);
  });

  it('leaves a sunk player afloat on 5 % hull until defeat exists', () => {
    expect(after({ type: 'sunk', shipIndex: 0 }).condition.hullPct).toBe(5);
  });
});
