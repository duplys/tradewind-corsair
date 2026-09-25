// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import type { Weighted } from '../../src/data/npc';
import { pick, pickWeighted, randInt, randRange } from '../../src/sim/random';
import { createRng } from '../../src/sim/rng';

describe('random helpers', () => {
  it('draws ranges and integers inside their bounds', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const r = randRange(rng, 85, 100);
      expect(r).toBeGreaterThanOrEqual(85);
      expect(r).toBeLessThan(100);
      const n = randInt(rng, 1, 3);
      expect([1, 2, 3]).toContain(n);
    }
  });

  it('picks by weight, roughly in proportion', () => {
    const rng = createRng(2);
    const counts: Record<'a' | 'b' | 'c', number> = { a: 0, b: 0, c: 0 };
    const weights: Weighted<'a' | 'b' | 'c'> = [
      ['a', 4],
      ['b', 2],
      ['c', 1],
    ];
    for (let i = 0; i < 7000; i++) counts[pickWeighted(rng, weights)!]++;
    expect(counts.a / 7000).toBeCloseTo(4 / 7, 1);
    expect(counts.c / 7000).toBeCloseTo(1 / 7, 1);
  });

  it('never picks zero weights and returns null when nothing can be picked', () => {
    const rng = createRng(3);
    for (let i = 0; i < 200; i++)
      expect(
        pickWeighted(rng, [
          ['x', 0],
          ['y', 1],
        ]),
      ).toBe('y');
    expect(pickWeighted(rng, [['x', 0]])).toBeNull();
    expect(pickWeighted(rng, [])).toBeNull();
    expect(() => pick(rng, [])).toThrow();
  });
});
