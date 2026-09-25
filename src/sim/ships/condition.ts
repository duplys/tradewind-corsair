// SPDX-License-Identifier: GPL-3.0-only
import {
  BASE_RELOAD_S,
  CREW_SAIL_FACTOR_MIN,
  HANDS_PER_GUN,
  MAX_RELOAD_S,
  RIGGING_SPEED_FLOOR,
  RIGGING_TURN_FLOOR,
  SAIL_CREW_SHARE,
} from '../../data/condition';
import type { ShipClass } from '../../data/ships';
import { clamp } from '../math';
import type { ShipPerformance } from '../sailing/ship';

/**
 * A ship's state of repair and manning (slice 2 spec §3.2). Applies to the player and every
 * NPC.
 */
export interface ShipCondition {
  /** 0..100 */
  readonly hullPct: number;
  /** 0..100 */
  readonly riggingPct: number;
  /** Integer ≥ 0. */
  readonly crew: number;
  /** 0..class guns */
  readonly gunsIntact: number;
}

/** A ship in perfect repair with every gun, manned by `crew` hands. */
export function fullCondition(cls: ShipClass, crew: number): ShipCondition {
  return { hullPct: 100, riggingPct: 100, crew, gunsIntact: cls.guns };
}

/** 1 with enough hands to work the sails (a quarter of typical crew), down to 0.3 with none. */
export function crewSailFactor(cls: ShipClass, condition: ShipCondition): number {
  return clamp(condition.crew / (SAIL_CREW_SHARE * cls.crewTypical), CREW_SAIL_FACTOR_MIN, 1);
}

/** maxSpeed × (0.4 + 0.6 × rigging) × crewSailFactor. */
export function effectiveMaxSpeedKn(cls: ShipClass, condition: ShipCondition): number {
  const rigging = RIGGING_SPEED_FLOOR + (1 - RIGGING_SPEED_FLOOR) * (condition.riggingPct / 100);
  return cls.maxSpeedKn * rigging * crewSailFactor(cls, condition);
}

/** turnRate × (0.6 + 0.4 × rigging). */
export function effectiveTurnRateRadPerSec(cls: ShipClass, condition: ShipCondition): number {
  const rigging = RIGGING_TURN_FLOOR + (1 - RIGGING_TURN_FLOOR) * (condition.riggingPct / 100);
  return cls.turnRateRadPerSec * rigging;
}

/**
 * The sailing qualities a damaged or short-handed ship actually has, for `stepShip`. At full
 * condition with at least a quarter of the typical crew, these are the class's own values.
 */
export function performanceOf(cls: ShipClass, condition: ShipCondition): ShipPerformance {
  return {
    maxSpeedKn: effectiveMaxSpeedKn(cls, condition),
    turnRateRadPerSec: effectiveTurnRateRadPerSec(cls, condition),
    accelPerSec: cls.accelPerSec,
    polar: cls.polar,
  };
}

/**
 * Guns that can fire in one broadside: half the intact guns, limited by crew (four hands per
 * gun, each side manned from half the crew), rounded down.
 */
export function gunsMannedPerBroadside(condition: ShipCondition): number {
  const byGuns = condition.gunsIntact / 2;
  const byCrew = Math.floor(condition.crew / HANDS_PER_GUN) / 2;
  return Math.floor(Math.min(byGuns, byCrew));
}

/** Seconds to reload one broadside: 6 s when fully manned, slower when short of hands, max 20 s. */
export function reloadTimeSec(condition: ShipCondition): number {
  const shortHanded = (condition.gunsIntact * HANDS_PER_GUN) / Math.max(condition.crew, 1);
  return Math.min(MAX_RELOAD_S, BASE_RELOAD_S * Math.max(1, shortHanded));
}

/** Losses to apply to a condition. All values are amounts to subtract (≥ 0). */
export interface ConditionLoss {
  readonly hullPct?: number;
  readonly riggingPct?: number;
  readonly crew?: number;
  readonly guns?: number;
}

/** Subtract losses, clamping every value at 0. */
export function damageCondition(condition: ShipCondition, loss: ConditionLoss): ShipCondition {
  return {
    hullPct: Math.max(0, condition.hullPct - (loss.hullPct ?? 0)),
    riggingPct: Math.max(0, condition.riggingPct - (loss.riggingPct ?? 0)),
    crew: Math.max(0, condition.crew - (loss.crew ?? 0)),
    gunsIntact: Math.max(0, condition.gunsIntact - (loss.guns ?? 0)),
  };
}
