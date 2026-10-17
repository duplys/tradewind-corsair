// SPDX-License-Identifier: GPL-3.0-only
// Tavern prices and buried treasure (slice 4 spec §3). Tuning lives here, not in the logic.

/** Gold to sign on one hand. */
export const HIRE_GOLD_PER_HAND = 8;
/** The hire buttons offer these numbers of hands, and always "fill the ship". */
export const HIRE_STEPS: readonly number[] = [5, 10];

/** Gold for a round and the talk that comes with it. */
export const RUMOUR_GOLD = 10;
/** Gold for a treasure tip. */
export const TIP_GOLD = 80;

/** A tip points at a spot this far from the port where it is bought, in world px. */
export const TREASURE_MIN_DIST_PX = 120;
export const TREASURE_MAX_DIST_PX = 450;
/** A site keeps this far from every harbour and from other sites, in world px. */
export const TREASURE_PORT_CLEARANCE_PX = 60;
export const TREASURE_SITE_CLEARANCE_PX = 40;
/** How many random spots to try before the tavern has "nothing worth telling". */
export const TREASURE_PLACEMENT_TRIES = 60;
/** The player can have this many unclaimed tips at once. */
export const TREASURE_MAX_ACTIVE = 3;
/** The ship can dig within this distance of the site (the site is on land), in world px. */
export const TREASURE_DIG_RADIUS_PX = 22;
/** Digging takes this many game hours. */
export const TREASURE_DIG_HOURS = 6;
/** Some tips are false, or someone got there first. */
export const TREASURE_EMPTY_CHANCE = 0.2;
/** Gold found, inclusive range. */
export const TREASURE_GOLD_MIN = 250;
export const TREASURE_GOLD_MAX = 700;
