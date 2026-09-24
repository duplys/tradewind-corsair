// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { LAT_MAX, LAT_MIN, LON_MAX, LON_MIN, WORLD_H, WORLD_W } from '../../../src/data/world';
import { lonLatToWorld, worldToLonLat } from '../../../src/sim/world/projection';

describe('projection', () => {
  it('has the documented world size', () => {
    expect(WORLD_W).toBe(1560);
    expect(WORLD_H).toBe(920);
  });

  it('maps the corners of the map to the corners of the world', () => {
    expect(lonLatToWorld(LON_MIN, LAT_MAX)).toEqual({ x: 0, y: 0 });
    expect(lonLatToWorld(LON_MAX, LAT_MIN)).toEqual({ x: WORLD_W, y: WORLD_H });
  });

  it('round-trips', () => {
    const p = lonLatToWorld(-76.84, 17.94);
    const back = worldToLonLat(p.x, p.y);
    expect(back.lon).toBeCloseTo(-76.84, 10);
    expect(back.lat).toBeCloseTo(17.94, 10);
  });
});
