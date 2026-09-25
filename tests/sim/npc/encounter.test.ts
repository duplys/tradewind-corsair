// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { PORTS } from '../../../src/data/ports';
import {
  caughtBy,
  escaped,
  hailableNpc,
  leaveHerBe,
  moveAlongHeading,
} from '../../../src/sim/npc/encounter';
import { fillPolygon } from '../../../src/sim/world/rasterise';
import { adjustReputation, newVoyage, type Voyage } from '../../../src/sim/voyage';
import { derivePorts } from '../../../src/sim/world/ports';
import { buildWorld, createWorld, isLand, type World } from '../../../src/sim/world/world';
import { makeNpc } from './helpers';

let world: World;
let voyage: Voyage;

beforeAll(() => {
  world = buildWorld();
  voyage = newVoyage(world, derivePorts(world, PORTS));
});

const near = (dx: number, overrides = {}) =>
  makeNpc({
    ship: { x: voyage.ship.x + dx, y: voyage.ship.y, headingRad: 0, speedKn: 4, sail: 'full' },
    ...overrides,
  });

describe('who can be hailed and who has caught you', () => {
  it('offers the closest ship within 16 px', () => {
    const a = near(15, { id: 1 });
    const b = near(10, { id: 2 });
    expect(hailableNpc([a, b], voyage.ship)?.id).toBe(2);
    expect(hailableNpc([near(17)], voyage.ship)).toBeNull();
  });

  it('forces an encounter only with a chaser within 12 px', () => {
    expect(caughtBy([near(11, { intent: 'chase' })], voyage.ship)).not.toBeNull();
    expect(caughtBy([near(11, { intent: 'travel' })], voyage.ship)).toBeNull();
    expect(caughtBy([near(13, { intent: 'chase' })], voyage.ship)).toBeNull();
  });
});

describe('encounter outcomes', () => {
  it('Leave her be: a friendly ship ignores you for 12 hours, a hostile one does not', () => {
    const v = {
      ...voyage,
      elapsedHours: 100,
      npcs: [near(10, { id: 1, nation: 'nl' }), near(12, { id: 2, nation: 'es' })],
    };
    const after = leaveHerBe(leaveHerBe(v, 1), 2);
    expect(after.npcs[0]!.ignorePlayerUntilHours).toBe(112);
    expect(after.npcs[1]!.ignorePlayerUntilHours).toBe(0);
  });

  it('a successful escape makes the chaser ignore you for 72 hours and gains 20 px', () => {
    const v = {
      ...voyage,
      elapsedHours: 100,
      npcs: [near(10, { id: 3, intent: 'chase', role: 'pirate', nation: 'pirate' })],
    };
    const after = escaped(v, world, 3);
    expect(after.npcs[0]).toMatchObject({
      intent: 'travel',
      ignorePlayerUntilHours: 172,
      path: [],
    });
    const moved = Math.hypot(after.ship.x - v.ship.x, after.ship.y - v.ship.y);
    expect(moved).toBeCloseTo(20, 6); // open water ahead of the start harbour
    expect(isLand(world, after.ship.x, after.ship.y)).toBe(false);
  });

  it('never moves the ship onto land', () => {
    const w = 100;
    const mask = new Uint8Array(w * w);
    fillPolygon(mask, w, w, [
      { x: 60, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 60, y: 100 },
    ]);
    const coast = createWorld(w, w, mask);
    const ship = { x: 40, y: 50, headingRad: 0, speedKn: 0, sail: 'full' as const };
    const moved = moveAlongHeading(coast, ship, 20);
    expect(moved.x).toBeLessThan(60 - 7);
    expect(moveAlongHeading(coast, { ...ship, headingRad: Math.PI }, 20).x).toBe(20);
  });

  it('adjusts reputation with one nation only', () => {
    const after = adjustReputation(voyage, 'nl', -1);
    expect(after.reputation).toEqual({ ...voyage.reputation, nl: -1 });
  });
});
