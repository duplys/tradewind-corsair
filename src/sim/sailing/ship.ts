// SPDX-License-Identifier: GPL-3.0-only
import {
  BOW_PROBE_PX,
  GAME_HOURS_PER_SECOND,
  PX_PER_NM,
  SAIL_FACTOR,
  SAIL_ORDER,
  STEER_FULL_WAY_KN,
  STEER_MIN_FRACTION,
  WIND_FACTOR_MAX,
  WIND_FACTOR_MIN,
  WIND_REF_KN,
  type SailSetting,
} from '../../data/sailing';
import { SHIP_CLASSES, type ShipClass, type ShipClassId } from '../../data/ships';
import { clamp, normaliseAngle } from '../math';
import { isLand, type World } from '../world/world';
import { polarFactor, relativeWindDeg } from './polar';
import type { Wind } from './wind';

export interface PlayerShip {
  /** World px (float). */
  readonly x: number;
  readonly y: number;
  /** Screen convention, normalised to (−π, π]. */
  readonly headingRad: number;
  readonly speedKn: number;
  readonly sail: SailSetting;
  readonly classId: ShipClassId;
}

export interface ShipInput {
  readonly turnLeft: boolean;
  readonly turnRight: boolean;
}

export type ShipEvent = { readonly type: 'shoal' };

export interface StepResult {
  readonly ship: PlayerShip;
  readonly events: readonly ShipEvent[];
}

const NO_EVENTS: readonly ShipEvent[] = Object.freeze([]);
const SHOAL_EVENTS: readonly ShipEvent[] = Object.freeze([{ type: 'shoal' } as const]);

/** Speed the ship tends toward for a heading relative to the wind (spec §6.3 step 2). */
export function targetSpeedKn(
  cls: ShipClass,
  relDeg: number,
  windSpeedKn: number,
  sail: SailSetting,
): number {
  const windFactor = clamp(windSpeedKn / WIND_REF_KN, WIND_FACTOR_MIN, WIND_FACTOR_MAX);
  return cls.maxSpeedKn * polarFactor(cls.polar, relDeg) * windFactor * SAIL_FACTOR[sail];
}

/** World px moved per second per knot. */
export const PX_PER_SEC_PER_KNOT = PX_PER_NM * GAME_HOURS_PER_SECOND;

/** One fixed simulation step for the player ship. Pure: returns the new state and events. */
export function stepShip(
  ship: PlayerShip,
  input: ShipInput,
  wind: Wind,
  world: World,
  dtSec: number,
): StepResult {
  const cls = SHIP_CLASSES[ship.classId];

  // 1. Steering: slower when nearly stopped, never blocked.
  const turn =
    cls.turnRateRadPerSec *
    (STEER_MIN_FRACTION +
      (1 - STEER_MIN_FRACTION) * Math.min(1, ship.speedKn / STEER_FULL_WAY_KN)) *
    dtSec;
  const steer = (input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0);
  const headingRad = normaliseAngle(ship.headingRad + steer * turn);

  // 2–3. Target speed from the polar, then ease toward it.
  const relDeg = relativeWindDeg(headingRad, wind.towardRad);
  const target = targetSpeedKn(cls, relDeg, wind.speedKn, ship.sail);
  let speedKn = ship.speedKn + (target - ship.speedKn) * Math.min(1, cls.accelPerSec * dtSec);

  // 4. Movement.
  const cos = Math.cos(headingRad);
  const sin = Math.sin(headingRad);
  const distPx = speedKn * PX_PER_SEC_PER_KNOT * dtSec;
  let { x, y } = ship;
  let events = NO_EVENTS;

  // 5–6. Collision with land (the map edge counts as land). A ship that is not trying to
  // move cannot run aground, so a furled, stopped ship facing a coast stays quiet.
  if (distPx > 0) {
    const nx = x + cos * distPx;
    const ny = y + sin * distPx;
    if (isLand(world, nx, ny) || isLand(world, nx + cos * BOW_PROBE_PX, ny + sin * BOW_PROBE_PX)) {
      speedKn = 0;
      events = SHOAL_EVENTS;
    } else {
      x = nx;
      y = ny;
    }
  }

  return { ship: { ...ship, x, y, headingRad, speedKn }, events };
}

/** Step the sail one setting up (hoist) or down (reef), stopping at the ends. */
export function changeSail(sail: SailSetting, direction: 1 | -1): SailSetting {
  const i = clamp(SAIL_ORDER.indexOf(sail) + direction, 0, SAIL_ORDER.length - 1);
  return SAIL_ORDER[i]!;
}
