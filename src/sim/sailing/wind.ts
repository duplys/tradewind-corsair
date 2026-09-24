// SPDX-License-Identifier: GPL-3.0-only
import { WIND_BASE_TOWARD_RAD, WIND_SPEED_MAX_KN, WIND_SPEED_MIN_KN } from '../../data/sailing';
import { clamp, headingToBearingDeg, normaliseAngle } from '../math';

export interface Wind {
  /** Direction the wind blows toward, screen convention, in (−π, π]. */
  readonly towardRad: number;
  readonly speedKn: number;
}

/**
 * Global wind as a pure function of game time (slice 1 spec §5). Position is accepted but
 * ignored for now so regional wind can come later without changing callers.
 */
export function windAt(_x: number, _y: number, elapsedHours: number): Wind {
  const days = elapsedHours / 24;
  const towardRad = normaliseAngle(
    WIND_BASE_TOWARD_RAD + 0.45 * Math.sin(days / 9) + 0.25 * Math.sin(days / 2.3 + 1),
  );
  const speedKn = clamp(
    12 + 4 * Math.sin(days / 5 + 2) + 2 * Math.sin(days * 1.7),
    WIND_SPEED_MIN_KN,
    WIND_SPEED_MAX_KN,
  );
  return { towardRad, speedKn };
}

/** Compass bearing the wind comes from, for display. */
export function fromBearingDeg(wind: Wind): number {
  return headingToBearingDeg(wind.towardRad + Math.PI);
}
