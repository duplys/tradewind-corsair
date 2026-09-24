// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { fillPolygon } from '../../../src/sim/world/rasterise';
import { lonLatToWorld } from '../../../src/sim/world/projection';
import {
  buildWorld,
  createWorld,
  distToLandAt,
  isLand,
  type World,
} from '../../../src/sim/world/world';

function squareWorld(): World {
  const w = 30;
  const h = 30;
  const mask = new Uint8Array(w * h);
  fillPolygon(mask, w, h, [
    { x: 10, y: 10 },
    { x: 20, y: 10 },
    { x: 20, y: 20 },
    { x: 10, y: 20 },
  ]);
  return createWorld(w, h, mask);
}

describe('synthetic world', () => {
  const world = squareWorld();

  it('fills exactly the pixels whose centres are inside', () => {
    let count = 0;
    for (const v of world.landMask) count += v;
    expect(count).toBe(100);
    expect(isLand(world, 10, 10)).toBe(true);
    expect(isLand(world, 19.9, 19.9)).toBe(true);
    expect(isLand(world, 9.9, 15)).toBe(false);
    expect(isLand(world, 20, 15)).toBe(false);
  });

  it('computes chamfer distances to land and to water', () => {
    const at = (field: Float32Array, x: number, y: number) => field[y * world.width + x];
    expect(at(world.distToLand, 15, 15)).toBe(0);
    expect(at(world.distToLand, 9, 15)).toBe(1);
    expect(at(world.distToLand, 5, 15)).toBe(5);
    expect(at(world.distToLand, 5, 5)).toBeCloseTo(5 * Math.SQRT2, 5);
    expect(at(world.distToWater, 5, 5)).toBe(0);
    expect(at(world.distToWater, 10, 15)).toBe(1);
    expect(at(world.distToWater, 14, 15)).toBe(5);
  });

  it('treats out-of-bounds positions as land', () => {
    expect(isLand(world, -0.1, 5)).toBe(true);
    expect(isLand(world, 5, -1)).toBe(true);
    expect(isLand(world, 30, 5)).toBe(true);
    expect(isLand(world, 5, 30)).toBe(true);
    expect(isLand(world, 29.9, 29.9)).toBe(false);
    expect(distToLandAt(world, -5, -5)).toBe(0);
  });
});

describe('Caribbean world', () => {
  let world: World;
  beforeAll(() => {
    world = buildWorld();
  });

  const landAt = (lon: number, lat: number) => {
    const p = lonLatToWorld(lon, lat);
    return isLand(world, p.x, p.y);
  };

  it('has land and water at known places', () => {
    expect(landAt(-77.3, 18.1)).toBe(true); // Jamaica
    expect(landAt(-79.0, 21.8)).toBe(true); // Cuba
    expect(landAt(-90.0, 17.0)).toBe(true); // Central America
    expect(landAt(-74.0, 19.6)).toBe(false); // Windward Passage
    expect(landAt(-75.0, 15.0)).toBe(false); // Caribbean Sea
    expect(landAt(-90.0, 25.0)).toBe(false); // Gulf of Mexico
    expect(landAt(-59.55, 13.15)).toBe(true); // Barbados
  });

  it('keeps Tortuga separated from Hispaniola by at least 3 px of water', () => {
    const c = lonLatToWorld(-72.8, 20.14);
    let checked = 0;
    for (let x = Math.floor(c.x - 8); x <= Math.ceil(c.x + 8); x++) {
      // Find Tortuga's southernmost land pixel in this column, if any.
      let y = Math.floor(c.y);
      if (!isLand(world, x, y)) continue;
      while (isLand(world, x, y + 1)) y++;
      let gap = 0;
      while (!isLand(world, x, y + 1 + gap)) gap++;
      expect(gap, `column ${x}`).toBeGreaterThanOrEqual(3);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  /** Flood fill over water inside a lon/lat box; true if b is reachable from a. */
  function connected(
    box: { lonMin: number; lonMax: number; latMin: number; latMax: number },
    a: readonly [number, number],
    b: readonly [number, number],
  ): boolean {
    const tl = lonLatToWorld(box.lonMin, box.latMax);
    const br = lonLatToWorld(box.lonMax, box.latMin);
    const x0 = Math.floor(tl.x);
    const y0 = Math.floor(tl.y);
    const x1 = Math.ceil(br.x);
    const y1 = Math.ceil(br.y);
    const pa = lonLatToWorld(a[0], a[1]);
    const pb = lonLatToWorld(b[0], b[1]);
    const start = [Math.floor(pa.x), Math.floor(pa.y)] as const;
    const goal = `${Math.floor(pb.x)},${Math.floor(pb.y)}`;
    expect(isLand(world, start[0], start[1])).toBe(false);
    expect(isLand(world, pb.x, pb.y)).toBe(false);
    const seen = new Set<string>([`${start[0]},${start[1]}`]);
    const queue: (readonly [number, number])[] = [start];
    while (queue.length > 0) {
      const [x, y] = queue.pop()!;
      if (`${x},${y}` === goal) return true;
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ] as const) {
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
        const key = `${nx},${ny}`;
        if (seen.has(key) || isLand(world, nx, ny)) continue;
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
    return false;
  }

  it.each([
    {
      name: 'Florida Straits',
      box: { lonMin: -82.5, lonMax: -79.3, latMin: 23.0, latMax: 26.0 },
      a: [-82.3, 24.3],
      b: [-79.5, 25.0],
    },
    {
      name: 'Windward Passage',
      box: { lonMin: -75.5, lonMax: -72.5, latMin: 18.8, latMax: 21.0 },
      a: [-75.0, 19.5],
      b: [-73.5, 20.6],
    },
    {
      name: 'Mona Passage',
      box: { lonMin: -68.6, lonMax: -66.8, latMin: 17.3, latMax: 19.2 },
      a: [-67.8, 17.5],
      b: [-67.8, 19.0],
    },
    {
      name: 'Yucatán Channel',
      box: { lonMin: -86.5, lonMax: -84.5, latMin: 20.0, latMax: 23.0 },
      a: [-85.8, 20.3],
      b: [-85.8, 22.8],
    },
  ] as const)('$name is sailable', ({ box, a, b }) => {
    expect(connected(box, a, b)).toBe(true);
  });
});
