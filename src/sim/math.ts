// SPDX-License-Identifier: GPL-3.0-only

export const TAU = Math.PI * 2;

/** Normalise an angle in radians to the half-open interval (−π, π]. */
export function normaliseAngle(rad: number): number {
  const wrapped = rad - TAU * Math.floor(rad / TAU); // [0, 2π)
  return wrapped > Math.PI ? wrapped - TAU : wrapped;
}
