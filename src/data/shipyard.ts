// SPDX-License-Identifier: GPL-3.0-only
// Shipwright prices and times (slice 2 spec §3.4).

/** Gold per percentage point of hull repaired, per point of hullStrength. */
export const HULL_REPAIR_GOLD_PER_PCT = 0.4;
/** Gold per percentage point of rigging repaired, per point of hullStrength. */
export const RIGGING_REPAIR_GOLD_PER_PCT = 0.25;
/** Game hours per 25 percentage points repaired (hull and rigging counted together). */
export const REPAIR_HOURS_PER_25_PCT = 48;
/** Gold per replacement gun. Replacing guns takes no time. */
export const GUN_REPLACEMENT_GOLD = 60;
