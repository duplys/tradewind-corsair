// SPDX-License-Identifier: GPL-3.0-only
// How a ship's condition affects it (slice 2 spec §3.2).

/** Speed keeps this fraction with the rigging shot away; the rest scales with riggingPct. */
export const RIGGING_SPEED_FLOOR = 0.4;
/** A ship needs this share of its typical crew to handle the sails properly. */
export const SAIL_CREW_SHARE = 0.25;
/** Short-handed ships keep at least this fraction of their speed. */
export const CREW_SAIL_FACTOR_MIN = 0.3;
/** Turn rate keeps this fraction with the rigging shot away. */
export const RIGGING_TURN_FLOOR = 0.6;
/** Hands needed to work one gun. */
export const HANDS_PER_GUN = 4;
/** Reload time of a fully manned broadside, and the slowest it can get, in combat seconds. */
export const BASE_RELOAD_S = 6;
export const MAX_RELOAD_S = 20;

/** Dev builds only: what the damage key (K) takes off the player's ship each press. */
export const DEV_DAMAGE_STEP = { hullPct: 12, riggingPct: 12, crew: 4, guns: 1 } as const;
