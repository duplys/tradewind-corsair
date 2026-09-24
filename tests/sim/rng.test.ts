// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { createRng, hash2 } from '../../src/sim/rng';
import { fractalNoise, valueNoise } from '../../src/sim/noise';

describe('createRng', () => {
  it('is deterministic per seed and returns values in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seqA = Array.from({ length: 100 }, a);
    expect(Array.from({ length: 100 }, b)).toEqual(seqA);
    expect(Array.from({ length: 100 }, c)).not.toEqual(seqA);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('hash2 and noise', () => {
  it('hash2 is stable and in [0, 1)', () => {
    expect(hash2(3, -7, 1)).toBe(hash2(3, -7, 1));
    expect(hash2(3, -7, 1)).not.toBe(hash2(-7, 3, 1));
    for (let i = -50; i < 50; i++) {
      const v = hash2(i, i * 3, 9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('value noise matches the lattice hash at lattice points and stays in range', () => {
    expect(valueNoise(28 * 3, 28 * 5, 28, 7)).toBeCloseTo(hash2(3, 5, 7), 10);
    for (let i = 0; i < 500; i++) {
      const v = fractalNoise(
        i * 3.7,
        i * 1.3,
        [
          { scalePx: 28, weight: 0.65 },
          { scalePx: 9, weight: 0.35 },
        ],
        1,
      );
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
