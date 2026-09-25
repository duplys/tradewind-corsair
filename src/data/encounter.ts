// SPDX-License-Identifier: GPL-3.0-only
// Encounters on the world map (slice 2 spec §5). Tuning lives here, not in the logic.

/** Pirates and hostile warships start a chase within this range ... */
export const CHASE_START_PX = 70;
/** ... and give up beyond this range, or after this long. */
export const CHASE_GIVE_UP_PX = 140;
export const CHASE_MAX_HOURS = 72;
/** A chaser that gave up after the time limit leaves the player alone this long. */
export const CHASE_REST_HOURS = 24;
/** Traders flee a hostile player within this range and resume their voyage beyond the other. */
export const FLEE_START_PX = 50;
export const FLEE_END_PX = 110;

/** The player can close with a ship within this range (the prompt button). */
export const HAIL_RANGE_PX = 16;
/** A chasing ship this close forces an encounter. */
export const CAUGHT_RANGE_PX = 12;

/** "Leave her be" makes a ship that is not hostile ignore the player this long. */
export const LEAVE_IGNORE_HOURS = 12;
/** A chaser the player escaped from ignores the player this long. */
export const ESCAPE_IGNORE_HOURS = 72;
/** A successful escape gives the player this much free separation along their heading. */
export const ESCAPE_SEPARATION_PX = 20;

/** Escape chance = clamp(BASE + (vPlayer − vEnemy) / DIVISOR, MIN, MAX). Speeds in knots. */
export const ESCAPE_BASE = 0.5;
export const ESCAPE_SPEED_DIVISOR_KN = 6;
export const ESCAPE_MIN = 0.1;
export const ESCAPE_MAX = 0.9;
/** Headings are sampled this far apart when finding the best speed made good. */
export const ESCAPE_SAMPLE_DEG = 5;

/** Until ship combat exists (M4), a fight ends at once and the enemy keeps away this long. */
export const PLACEHOLDER_FIGHT_IGNORE_HOURS = 24;
