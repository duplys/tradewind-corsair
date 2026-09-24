// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SHIP_CLASSES } from '../../../src/data/ships';
import { pointOfSail, polarFactor, relativeWindDeg } from '../../../src/sim/sailing/polar';

const polar = SHIP_CLASSES.sloop.polar;

describe('polarFactor', () => {
  it('returns the table values at the rows', () => {
    for (const [deg, factor] of polar) expect(polarFactor(polar, deg)).toBeCloseTo(factor);
  });

  it('interpolates linearly between rows', () => {
    expect(polarFactor(polar, 15)).toBeCloseTo(0.75);
    expect(polarFactor(polar, 105)).toBeCloseTo(0.93);
    expect(polarFactor(polar, 165)).toBeCloseTo(0.115);
  });

  it('clamps outside the table', () => {
    expect(polarFactor(polar, -5)).toBeCloseTo(0.72);
    expect(polarFactor(polar, 190)).toBeCloseTo(0.05);
  });
});

describe('relativeWindDeg and pointOfSail', () => {
  it('measures the angle to the wind across the seam', () => {
    expect(relativeWindDeg(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo((0.2 * 180) / Math.PI);
    expect(relativeWindDeg(0, Math.PI)).toBeCloseTo(180);
  });

  it('labels each band', () => {
    expect(pointOfSail(0)).toBe('running');
    expect(pointOfSail(29.9)).toBe('running');
    expect(pointOfSail(30)).toBe('broadReach');
    expect(pointOfSail(90)).toBe('beamReach');
    expect(pointOfSail(110)).toBe('closeHauled');
    expect(pointOfSail(145)).toBe('inIrons');
    expect(pointOfSail(180)).toBe('inIrons');
  });
});
