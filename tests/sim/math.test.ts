// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import {
  angleDiff,
  bearingToCompass16,
  clamp,
  headingToBearingDeg,
  normaliseAngle,
  TAU,
} from '../../src/sim/math';

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

describe('angleDiff', () => {
  it('takes the short way across the ±π seam', () => {
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(-0.2);
    expect(angleDiff(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(0.2);
    expect(angleDiff(0.3, -0.3)).toBeCloseTo(0.6);
  });
});

describe('headingToBearingDeg', () => {
  it('converts screen angles to compass bearings', () => {
    expect(headingToBearingDeg(-Math.PI / 2)).toBeCloseTo(0); // north
    expect(headingToBearingDeg(0)).toBeCloseTo(90); // east
    expect(headingToBearingDeg(Math.PI / 2)).toBeCloseTo(180); // south
    expect(headingToBearingDeg(Math.PI)).toBeCloseTo(270); // west
    expect(headingToBearingDeg(-Math.PI)).toBeCloseTo(270);
  });

  it('never returns 360', () => {
    expect(headingToBearingDeg(-Math.PI / 2 - 1e-12)).toBe(0);
  });
});

describe('bearingToCompass16 and clamp', () => {
  it('names the 16 points', () => {
    expect(bearingToCompass16(0)).toBe('N');
    expect(bearingToCompass16(67.5)).toBe('ENE');
    expect(bearingToCompass16(270)).toBe('W');
    expect(bearingToCompass16(355)).toBe('N');
    expect(bearingToCompass16(-22.5)).toBe('NNW');
  });

  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});
