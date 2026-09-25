// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { createRng, hash2, isRngState, restoreRng } from '../../src/sim/rng';
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

describe('RNG state (save and restore)', () => {
  const draw = (rng: () => number, n: number) => Array.from({ length: n }, () => rng());

  it('restores mid-sequence from its state', () => {
    const rng = createRng(1660);
    draw(rng, 17);
    const saved = rng.state();
    const expected = draw(rng, 50);
    expect(draw(restoreRng(saved), 50)).toEqual(expected);
  });

  it('survives a JSON round-trip', () => {
    const rng = createRng(7);
    draw(rng, 3);
    const json = JSON.stringify({ rngState: rng.state() });
    const parsed = JSON.parse(json) as { rngState: unknown };
    expect(isRngState(parsed.rngState)).toBe(true);
    expect(draw(restoreRng(parsed.rngState as number), 20)).toEqual(draw(rng, 20));
  });

  it('keeps a valid state through many draws', () => {
    const rng = createRng(0xffffffff);
    for (let i = 0; i < 1000; i++) rng();
    expect(isRngState(rng.state())).toBe(true);
  });

  it('recognises valid states', () => {
    expect(isRngState(0)).toBe(true);
    expect(isRngState(0xffffffff)).toBe(true);
    expect(isRngState(-1)).toBe(false);
    expect(isRngState(2 ** 32)).toBe(false);
    expect(isRngState(1.5)).toBe(false);
    expect(isRngState('1')).toBe(false);
    expect(isRngState(NaN)).toBe(false);
  });
});

describe('RNG fork', () => {
  const draw = (rng: () => number, n: number) => Array.from({ length: n }, () => rng());

  it('is deterministic for the same parent state and label', () => {
    expect(draw(createRng(99).fork('combat'), 30)).toEqual(draw(createRng(99).fork('combat'), 30));
    const a = createRng(99);
    draw(a, 5);
    expect(draw(restoreRng(a.state()).fork('npc'), 10)).toEqual(draw(a.fork('npc'), 10));
  });

  it("does not let the child's draws affect the parent", () => {
    const withBusyChild = createRng(5);
    const child = withBusyChild.fork('combat');
    draw(child, 1000);
    const withIdleChild = createRng(5);
    withIdleChild.fork('combat');
    expect(draw(withBusyChild, 20)).toEqual(draw(withIdleChild, 20));
  });

  it('consumes exactly one draw from the parent', () => {
    const forked = createRng(5);
    forked.fork('x');
    const plain = createRng(5);
    plain();
    expect(forked.state()).toBe(plain.state());
  });

  it('gives different streams for different labels and for repeated forks', () => {
    const labels = draw(createRng(3).fork('combat'), 10);
    expect(draw(createRng(3).fork('spawn'), 10)).not.toEqual(labels);
    const parent = createRng(3);
    const first = draw(parent.fork('combat'), 10);
    const second = draw(parent.fork('combat'), 10);
    expect(second).not.toEqual(first);
  });

  it("differs from the parent's own continuation", () => {
    const parent = createRng(11);
    const child = parent.fork('combat');
    expect(draw(child, 10)).not.toEqual(draw(parent, 10));
  });

  it('produces values in [0, 1) with a plausible mean', () => {
    const values = draw(createRng(1).fork('stats'), 5000);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });
});
