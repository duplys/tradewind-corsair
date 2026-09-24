// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { WIND_BASE_TOWARD_RAD } from '../../../src/data/sailing';
import { angleDiff, radToDeg } from '../../../src/sim/math';
import { fromBearingDeg, windAt } from '../../../src/sim/sailing/wind';

describe('windAt', () => {
  it('is deterministic and ignores position', () => {
    expect(windAt(0, 0, 1234)).toEqual(windAt(0, 0, 1234));
    expect(windAt(10, 900, 1234)).toEqual(windAt(0, 0, 1234));
  });

  it('keeps speed within [5, 20] kn', () => {
    for (let h = 0; h < 24 * 365 * 3; h += 3) {
      const { speedKn } = windAt(0, 0, h);
      expect(speedKn).toBeGreaterThanOrEqual(5);
      expect(speedKn).toBeLessThanOrEqual(20);
    }
  });

  it('averages within ±20° of the base direction over a year', () => {
    let sx = 0;
    let sy = 0;
    for (let h = 0; h < 24 * 365; h += 1) {
      const { towardRad } = windAt(0, 0, h);
      sx += Math.cos(towardRad);
      sy += Math.sin(towardRad);
    }
    const mean = Math.atan2(sy, sx);
    expect(Math.abs(radToDeg(angleDiff(mean, WIND_BASE_TOWARD_RAD)))).toBeLessThan(20);
  });

  it('reports the base wind as coming from the east-north-east', () => {
    const bearing = fromBearingDeg({ towardRad: WIND_BASE_TOWARD_RAD, speedKn: 12 });
    expect(bearing).toBeGreaterThan(60);
    expect(bearing).toBeLessThan(80);
  });
});
