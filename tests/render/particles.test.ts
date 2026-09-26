// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { MAX_PARTICLES, ParticlePool } from '../../src/render/effects/particles';
import { sailHoles, combatDims, shipGeometry } from '../../src/render/sprites/ship';
import { SHIP_CLASSES } from '../../src/data/ships';

describe('ParticlePool', () => {
  it('keeps particles for their lifetime and moves them', () => {
    const pool = new ParticlePool();
    pool.spawn('smoke', 10, 10, 2, 0, 0, 2.5, 3, 1);
    expect(pool.countAlive(1)).toBe(1);
    pool.update(1, 1);
    expect(pool.x[0]).toBeCloseTo(12);
    expect(pool.countAlive(2.6)).toBe(0);
  });

  it('keeps debris until cleared', () => {
    const pool = new ParticlePool();
    pool.spawn('debris', 0, 0, 0, 0, 0, Infinity);
    expect(pool.countAlive(1e6)).toBe(1);
    pool.clear();
    expect(pool.countAlive(1)).toBe(0);
  });

  it('never holds more than its capacity, replacing the oldest', () => {
    const pool = new ParticlePool();
    for (let i = 0; i < MAX_PARTICLES + 50; i++) pool.spawn('bubble', i, 0, 0, 0, 0, 10);
    expect(pool.countAlive(1)).toBe(MAX_PARTICLES);
    expect(pool.x[0]).toBe(MAX_PARTICLES);
  });
});

describe('sailHoles', () => {
  it('punches 2–4 holes inside the sails, the same for the same seed', () => {
    for (const cls of Object.values(SHIP_CLASSES)) {
      const dims = combatDims(cls);
      const sails = shipGeometry(cls, dims).sails;
      for (let seed = 1; seed < 30; seed++) {
        const holes = sailHoles(cls, dims, seed);
        expect(holes.length).toBeGreaterThanOrEqual(2);
        expect(holes.length).toBeLessThanOrEqual(4);
        expect(sailHoles(cls, dims, seed)).toEqual(holes);
        for (const h of holes) {
          expect(sails.some((r) => h.x >= r.x0 && h.x <= r.x1 && h.y >= r.y0 && h.y <= r.y1)).toBe(
            true,
          );
        }
      }
    }
  });
});
