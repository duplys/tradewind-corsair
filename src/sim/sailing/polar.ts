// SPDX-License-Identifier: GPL-3.0-only
import { POINT_OF_SAIL_BANDS, type PointOfSail } from '../../data/sailing';
import type { ShipClass } from '../../data/ships';
import { angleDiff, radToDeg } from '../math';

/** Angle between heading and the wind's toward direction, in degrees [0, 180]. */
export function relativeWindDeg(headingRad: number, windTowardRad: number): number {
  return Math.abs(radToDeg(angleDiff(headingRad, windTowardRad)));
}

/** Speed factor from the polar table, linearly interpolated (and clamped to its ends). */
export function polarFactor(polar: ShipClass['polar'], relDeg: number): number {
  const first = polar[0]!;
  if (relDeg <= first[0]) return first[1];
  for (let i = 1; i < polar.length; i++) {
    const [d1, f1] = polar[i]!;
    if (relDeg <= d1) {
      const [d0, f0] = polar[i - 1]!;
      return f0 + ((relDeg - d0) / (d1 - d0)) * (f1 - f0);
    }
  }
  return polar[polar.length - 1]![1];
}

export function pointOfSail(relDeg: number): PointOfSail {
  for (const band of POINT_OF_SAIL_BANDS) if (relDeg < band.belowDeg) return band.id;
  return 'inIrons';
}
