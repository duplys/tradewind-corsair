// SPDX-License-Identifier: GPL-3.0-only
import {
  GUN_REPLACEMENT_GOLD,
  HULL_REPAIR_GOLD_PER_PCT,
  REPAIR_HOURS_PER_25_PCT,
  RIGGING_REPAIR_GOLD_PER_PCT,
} from '../../data/shipyard';
import type { ShipClass } from '../../data/ships';
import type { ShipCondition } from './condition';

/** What a repair does to the ship, what it costs and how long it takes (slice 2 spec §3.4). */
export interface RepairPlan {
  readonly condition: ShipCondition;
  readonly costGold: number;
  readonly hours: number;
}

function hullGoldPerPct(cls: ShipClass): number {
  return cls.hullStrength * HULL_REPAIR_GOLD_PER_PCT;
}

function riggingGoldPerPct(cls: ShipClass): number {
  return cls.hullStrength * RIGGING_REPAIR_GOLD_PER_PCT;
}

/** 2 game days per 25 percentage points repaired, pro rata, rounded to the nearest hour. */
export function repairHours(hullPctAdded: number, riggingPctAdded: number): number {
  return Math.round(((hullPctAdded + riggingPctAdded) / 25) * REPAIR_HOURS_PER_25_PCT);
}

function plan(
  cls: ShipClass,
  condition: ShipCondition,
  hullPctAdded: number,
  riggingPctAdded: number,
): RepairPlan {
  return {
    condition: {
      ...condition,
      hullPct: Math.min(100, condition.hullPct + hullPctAdded),
      riggingPct: Math.min(100, condition.riggingPct + riggingPctAdded),
    },
    costGold: Math.round(
      hullPctAdded * hullGoldPerPct(cls) + riggingPctAdded * riggingGoldPerPct(cls),
    ),
    hours: repairHours(hullPctAdded, riggingPctAdded),
  };
}

/** Hull and rigging both back to 100 %. */
export function fullRepair(cls: ShipClass, condition: ShipCondition): RepairPlan {
  return plan(cls, condition, 100 - condition.hullPct, 100 - condition.riggingPct);
}

/**
 * As much repair as `gold` buys: the hull first, then the rigging. A part that cannot be fully
 * repaired is repaired by whole percentage points, so the cost never exceeds the gold.
 */
export function affordableRepair(
  cls: ShipClass,
  condition: ShipCondition,
  gold: number,
): RepairPlan {
  const full = fullRepair(cls, condition);
  if (full.costGold <= gold) return full;

  const hullMissing = 100 - condition.hullPct;
  const hullFullCost = hullMissing * hullGoldPerPct(cls);
  if (hullFullCost > gold) {
    const pct = Math.min(hullMissing, Math.floor(gold / hullGoldPerPct(cls)));
    return plan(cls, condition, pct, 0);
  }
  const rest = gold - hullFullCost;
  const riggingPct = Math.min(
    100 - condition.riggingPct,
    Math.floor(rest / riggingGoldPerPct(cls)),
  );
  return plan(cls, condition, hullMissing, riggingPct);
}

/** Replace as many lost guns as `gold` pays for, up to the class maximum. Takes no time. */
export function gunReplacement(cls: ShipClass, condition: ShipCondition, gold: number): RepairPlan {
  const missing = Math.max(0, cls.guns - condition.gunsIntact);
  const guns = Math.min(missing, Math.floor(gold / GUN_REPLACEMENT_GOLD));
  return {
    condition: { ...condition, gunsIntact: condition.gunsIntact + guns },
    costGold: guns * GUN_REPLACEMENT_GOLD,
    hours: 0,
  };
}

/** True when a plan changes nothing. */
export function isEmptyRepair(plan: RepairPlan, condition: ShipCondition): boolean {
  return (
    plan.condition.hullPct === condition.hullPct &&
    plan.condition.riggingPct === condition.riggingPct &&
    plan.condition.gunsIntact === condition.gunsIntact
  );
}
