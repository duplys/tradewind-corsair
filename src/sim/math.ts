// SPDX-License-Identifier: GPL-3.0-only

export const TAU = Math.PI * 2;

// prettier-ignore
const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

export type Compass16 = (typeof COMPASS_16)[number];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Normalise an angle in radians to the half-open interval (−π, π]. */
export function normaliseAngle(rad: number): number {
  const wrapped = rad - TAU * Math.floor(rad / TAU); // [0, 2π)
  return wrapped > Math.PI ? wrapped - TAU : wrapped;
}

/** Signed smallest difference a − b, in (−π, π]. */
export function angleDiff(a: number, b: number): number {
  return normaliseAngle(a - b);
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Screen-convention angle (0 = east, clockwise positive) to a compass bearing in degrees
 * (0 = north, clockwise), in [0, 360).
 */
export function headingToBearingDeg(headingRad: number): number {
  const deg = radToDeg(headingRad) + 90;
  const wrapped = ((deg % 360) + 360) % 360;
  return wrapped >= 359.9999999 ? 0 : wrapped;
}

/** 16-point compass name for a bearing in degrees. */
export function bearingToCompass16(bearingDeg: number): Compass16 {
  const i = Math.round((((bearingDeg % 360) + 360) % 360) / 22.5) % 16;
  return COMPASS_16[i]!;
}
