// SPDX-License-Identifier: GPL-3.0-only
import {
  SAIL_FACTOR,
  SAIL_ORDER,
  STEER_FULL_WAY_KN,
  STEER_MIN_FRACTION,
  WIND_FACTOR_MAX,
  WIND_FACTOR_MIN,
  WIND_REF_KN,
  WORLD_SAILING_SCALE,
  type SailingScale,
  type SailSetting,
} from '../../data/sailing';
import { SHIP_CLASSES, type ShipClass, type ShipClassId } from '../../data/ships';
import { clamp, normaliseAngle } from '../math';
import { isLand, type World } from '../world/world';
import { polarFactor, relativeWindDeg } from './polar';
import type { Wind } from './wind';

/** Where a ship is and how it is sailing. Shared by the player, NPCs and combat ships. */
export interface SailingShip {
  /** Map px (float): world px on the world map, combat px in the arena. */
  readonly x: number;
  readonly y: number;
  /** Screen convention, normalised to (−π, π]. */
  readonly headingRad: number;
  readonly speedKn: number;
  readonly sail: SailSetting;
}

/** The player's ship on the world map. */
export interface PlayerShip extends SailingShip {
  readonly classId: ShipClassId;
}

/**
 * The sailing qualities the physics needs. A ShipClass is one; damage produces reduced copies
 * (slice 2 spec §3.2).
 */
export type ShipPerformance = Pick<
  ShipClass,
  'maxSpeedKn' | 'turnRateRadPerSec' | 'accelPerSec' | 'polar'
>;

export interface StepParams {
  readonly performance: ShipPerformance;
  readonly scale: SailingScale;
}

export interface ShipInput {
  readonly turnLeft: boolean;
  readonly turnRight: boolean;
}

export type ShipEvent = { readonly type: 'shoal' };

export interface StepResult<S extends SailingShip = PlayerShip> {
  readonly ship: S;
  readonly events: readonly ShipEvent[];
}

const NO_EVENTS: readonly ShipEvent[] = Object.freeze([]);
const SHOAL_EVENTS: readonly ShipEvent[] = Object.freeze([{ type: 'shoal' } as const]);

/** Speed the ship tends toward for a heading relative to the wind (slice 1 spec §6.3 step 2). */
export function targetSpeedKn(
  performance: ShipPerformance,
  relDeg: number,
  windSpeedKn: number,
  sail: SailSetting,
): number {
  const windFactor = clamp(windSpeedKn / WIND_REF_KN, WIND_FACTOR_MIN, WIND_FACTOR_MAX);
  return (
    performance.maxSpeedKn * polarFactor(performance.polar, relDeg) * windFactor * SAIL_FACTOR[sail]
  );
}

/** World px moved per second per knot. */
export const PX_PER_SEC_PER_KNOT = WORLD_SAILING_SCALE.pxPerSecPerKnot;

/**
 * One fixed simulation step for any sailing ship. Pure: returns the new state and events.
 *
 * Without `params`, the ship is the player's on the world map: its class's performance at the
 * world scale. NPCs and combat ships pass their own performance and scale. `terrain` is the
 * land to collide with, or null for open water with no edges (the combat arena).
 */
export function stepShip(
  ship: PlayerShip,
  input: ShipInput,
  wind: Wind,
  terrain: World | null,
  dtSec: number,
): StepResult<PlayerShip>;
export function stepShip<S extends SailingShip>(
  ship: S,
  input: ShipInput,
  wind: Wind,
  terrain: World | null,
  dtSec: number,
  params: StepParams,
): StepResult<S>;
export function stepShip<S extends SailingShip>(
  ship: S,
  input: ShipInput,
  wind: Wind,
  terrain: World | null,
  dtSec: number,
  params?: StepParams,
): StepResult<S> {
  const { performance, scale } = params ?? {
    performance: SHIP_CLASSES[(ship as SailingShip as PlayerShip).classId],
    scale: WORLD_SAILING_SCALE,
  };

  // 1. Steering: slower when nearly stopped, never blocked.
  const turn =
    performance.turnRateRadPerSec *
    (STEER_MIN_FRACTION +
      (1 - STEER_MIN_FRACTION) * Math.min(1, ship.speedKn / STEER_FULL_WAY_KN)) *
    dtSec;
  const steer = (input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0);
  const headingRad = normaliseAngle(ship.headingRad + steer * turn);

  // 2–3. Target speed from the polar, then ease toward it.
  const relDeg = relativeWindDeg(headingRad, wind.towardRad);
  const target = targetSpeedKn(performance, relDeg, wind.speedKn, ship.sail);
  let speedKn =
    ship.speedKn + (target - ship.speedKn) * Math.min(1, performance.accelPerSec * dtSec);

  // 4. Movement.
  const cos = Math.cos(headingRad);
  const sin = Math.sin(headingRad);
  const distPx = speedKn * scale.pxPerSecPerKnot * dtSec;
  let { x, y } = ship;
  let events = NO_EVENTS;

  // 5–6. Collision with land (the map edge counts as land). A ship that is not trying to
  // move cannot run aground, so a furled, stopped ship facing a coast stays quiet.
  if (distPx > 0) {
    const nx = x + cos * distPx;
    const ny = y + sin * distPx;
    const probe = scale.bowProbePx;
    if (
      terrain &&
      (isLand(terrain, nx, ny) || isLand(terrain, nx + cos * probe, ny + sin * probe))
    ) {
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
