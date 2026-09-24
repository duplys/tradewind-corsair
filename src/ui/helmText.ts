// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import { bearingToCompass16, headingToBearingDeg } from '../sim/math';
import { pointOfSail, relativeWindDeg } from '../sim/sailing/polar';
import type { PlayerShip } from '../sim/sailing/ship';
import { fromBearingDeg, type Wind } from '../sim/sailing/wind';

/** The four helm text lines (slice 1 spec §9.1), e.g. "Course 270° W". */
export function helmLines(ship: PlayerShip, wind: Wind): readonly [string, string, string, string] {
  const course = Math.round(headingToBearingDeg(ship.headingRad)) % 360;
  const windFrom = fromBearingDeg(wind);
  const rel = relativeWindDeg(ship.headingRad, wind.towardRad);
  return [
    STRINGS.hud.course(course.toString().padStart(3, '0'), bearingToCompass16(course)),
    STRINGS.hud.speed(ship.speedKn.toFixed(1), STRINGS.pointOfSail[pointOfSail(rel)]),
    STRINGS.hud.wind(bearingToCompass16(windFrom), Math.round(wind.speedKn)),
    STRINGS.sail[ship.sail],
  ];
}
