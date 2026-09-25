// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { sparkleProgress } from '../../src/render/effects/sparkles';

describe('sparkleProgress', () => {
  it('is visible for the first 30% of each 2 s cycle', () => {
    expect(sparkleProgress(0, 0)).toBe(0);
    expect(sparkleProgress(0, 0.3)).toBeCloseTo(0.5);
    expect(sparkleProgress(0, 0.59)).toBeGreaterThan(0.9);
    expect(sparkleProgress(0, 0.6)).toBe(-1);
    expect(sparkleProgress(0, 1.99)).toBe(-1);
    expect(sparkleProgress(0, 2)).toBe(0);
  });

  it('offsets cycles by phase', () => {
    expect(sparkleProgress(0.5, 0)).toBe(-1);
    expect(sparkleProgress(0.5, 1)).toBe(0);
  });

  it('is visible about 30% of the time', () => {
    let visible = 0;
    for (let i = 0; i < 1000; i++) if (sparkleProgress(0.37, i * 0.0137) >= 0) visible++;
    expect(visible / 1000).toBeGreaterThan(0.25);
    expect(visible / 1000).toBeLessThan(0.35);
  });
});
