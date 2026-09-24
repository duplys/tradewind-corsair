// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { normaliseAngle, TAU } from '../../src/sim/math';

describe('normaliseAngle', () => {
  it('leaves angles inside (−π, π] unchanged', () => {
    expect(normaliseAngle(0)).toBe(0);
    expect(normaliseAngle(1)).toBeCloseTo(1);
    expect(normaliseAngle(-1)).toBeCloseTo(-1);
    expect(normaliseAngle(Math.PI)).toBeCloseTo(Math.PI);
  });

  it('maps −π to π across the seam', () => {
    expect(normaliseAngle(-Math.PI)).toBeCloseTo(Math.PI);
  });

  it('wraps angles just past the seam', () => {
    expect(normaliseAngle(Math.PI + 0.1)).toBeCloseTo(-Math.PI + 0.1);
    expect(normaliseAngle(-Math.PI - 0.1)).toBeCloseTo(Math.PI - 0.1);
  });

  it('wraps multiples of a full turn', () => {
    expect(normaliseAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(normaliseAngle((-3 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2);
    expect(normaliseAngle(0.5 + 10 * TAU)).toBeCloseTo(0.5);
    expect(normaliseAngle(0.5 - 10 * TAU)).toBeCloseTo(0.5);
  });
});
