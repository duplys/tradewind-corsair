// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { angleDiff } from '../../../src/sim/math';
import { createStartShip } from '../../../src/sim/sailing/start';
import { fillPolygon } from '../../../src/sim/world/rasterise';
import { nearestHarbourWater, nearestLand, openWaterHeading } from '../../../src/sim/world/search';
import { buildWorld, createWorld, distToLandAt, isLand } from '../../../src/sim/world/world';

function blockWorld() {
  const w = 100;
  const h = 100;
  const mask = new Uint8Array(w * h);
  fillPolygon(mask, w, h, [
    { x: 60, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 60, y: 100 },
  ]);
  return createWorld(w, h, mask);
}

describe('search', () => {
  const world = blockWorld();

  it('finds the nearest land pixel', () => {
    expect(nearestLand(world, 50.5, 40.5)).toEqual({ x: 60.5, y: 40.5 });
    expect(nearestLand(world, 70.5, 40.5)).toEqual({ x: 70.5, y: 40.5 });
  });

  it('finds the nearest water with at least 3 px clearance', () => {
    expect(nearestHarbourWater(world, 60.5, 40.5)).toEqual({ x: 57.5, y: 40.5 });
  });

  it('returns null when nothing is in range', () => {
    expect(nearestLand(createWorld(10, 10, new Uint8Array(100)), 5, 5)).toBeNull();
  });

  it('points away from the coast toward open water', () => {
    const heading = openWaterHeading(world, 55, 50);
    expect(Math.abs(angleDiff(heading, Math.PI))).toBeLessThan(Math.PI / 2);
  });
});

describe('createStartShip', () => {
  it('starts off Bridgetown in clear water, facing open water, sail full, stopped', () => {
    const world = buildWorld();
    const s = createStartShip(world);
    expect(isLand(world, s.x, s.y)).toBe(false);
    expect(distToLandAt(world, s.x, s.y)).toBeGreaterThanOrEqual(3);
    const ahead = distToLandAt(
      world,
      s.x + Math.cos(s.headingRad) * 20,
      s.y + Math.sin(s.headingRad) * 20,
    );
    expect(ahead).toBeGreaterThan(distToLandAt(world, s.x, s.y));
    expect(s).toMatchObject({ sail: 'full', speedKn: 0, classId: 'sloop' });
  });
});
