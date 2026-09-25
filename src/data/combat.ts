// SPDX-License-Identifier: GPL-3.0-only
// Ship combat (slice 2 spec §6). Tuning lives here, not in the logic.
import type { SailingScale } from './sailing';

// ---- Arena (§6.2) ----
/**
 * Open sea with no fixed edge: a ship escapes "over the horizon" when it gets this far from the
 * other ship (1,350 yds). A fixed 720 × 480 rectangle made escaping far too easy (ADR 013).
 */
export const ESCAPE_DISTANCE_PX = 450;
/** Combat px moved per second per knot; the arena has no land, so no bow probe. */
export const COMBAT_SAILING_SCALE: SailingScale = { pxPerSecPerKnot: 2.4, bowProbePx: 0 };
/** Start distance for most fights, and after a failed escape (enemy upwind). */
export const START_DISTANCE_PX = 220;
export const CAUGHT_START_DISTANCE_PX = 150;
/** Within this of the horizon the view darkens as a warning (drawn from M6). */
export const EDGE_WARNING_PX = 40;

// ---- Broadsides and projectiles (§6.4) ----
/** Balls leave along the middle 70 % of the hull, one every 60 ms. */
export const BROADSIDE_SPAN_SHARE = 0.7;
export const RIPPLE_INTERVAL_SEC = 0.06;
export const BALL_SPEED_PX_PER_SEC = 110;
export const BALL_RANGE_PX = 150;
export const BALL_SPREAD_DEG = 6;
/** In the last 20 % of its flight a ball is low, spent shot that cannot hit the rigging. */
export const BALL_LOW_SHARE = 0.2;
/** The most balls in flight at once (pool size). */
export const MAX_BALLS = 64;

// ---- Hit resolution (§6.5) ----
export const HIT_WEIGHTS = { hull: 55, rigging: 30, crew: 15 } as const;
/** Damage in percentage points for a ship of DAMAGE_REF_HULL_STRENGTH (the sloop). */
export const HULL_DAMAGE_RANGE = [4, 7] as const;
export const RIGGING_DAMAGE_RANGE = [5, 9] as const;
export const DAMAGE_REF_HULL_STRENGTH = 60;
export const CREW_LOSS_RANGE = [1, 3] as const;
export const GUN_LOSS_CHANCE = 0.1;

// ---- End conditions (§6.6) ----
export const SINKING_SEC = 3;
/** An NPC strikes with fewer than 25 % of its starting crew ... */
export const STRIKE_CREW_SHARE = 0.25;
/** ... or below 20 % hull when the player has 1.5 × its crew. */
export const STRIKE_HULL_PCT = 20;
export const STRIKE_CREW_ADVANTAGE = 1.5;
/** Traders strike below 40 % hull, or at the first rigging hit below 50 % within 80 px. */
export const TRADER_STRIKE_HULL_PCT = 40;
export const TRADER_STRIKE_RIGGING_PCT = 50;
export const TRADER_STRIKE_RANGE_PX = 80;
/**
 * Additions for traders (ADR 013), so that "a fluyt usually strikes after a few hits" (spec
 * §14): a merchant strikes after this many hits, and strikes rather than fight off boarders
 * who outnumber her crew.
 */
export const TRADER_STRIKE_HITS = 4;
/** Touching hulls board when slower than 4 kn relative, or after 1.5 s of contact. */
export const BOARDING_REL_SPEED_KN = 4;
export const BOARDING_CONTACT_SEC = 1.5;
/** Points sampled on each hull ellipse to test for contact. */
export const CONTACT_SAMPLES = 24;

/** A fight advances the world clock by this much, applied at the end (§6.1). */
export const COMBAT_GAME_HOURS = 6;
/** Range is shown in yards: combat px × 3 (flavour only). */
export const YARDS_PER_COMBAT_PX = 3;

// ---- Returning to the world map (interim until the outcome screens, ADR 012) ----
/** The player moves this far along their heading after slipping away (spec §8.4). */
export const PLAYER_ESCAPE_SEPARATION_PX = 25;
/** How long an enemy that got away, or that the player escaped from, ignores the player. */
export const ENEMY_ESCAPED_IGNORE_HOURS = 48;
export const PLAYER_ESCAPED_IGNORE_HOURS = 24;
/** Until boarding and defeat exist (M7): the hull a sunk player's ship is left with. */
export const INTERIM_DEFEAT_HULL_PCT = 5;

// ---- Combat AI (§7) ----
/** Fire a side when the target is within this angle of its beam and this close. */
export const AI_FIRE_ARC_DEG = 5;
export const AI_FIRE_RANGE_PX = 130;
/** Reaction delay (0.4 s / difficulty) and aim noise ((1 − difficulty) × 8°) below 1.0. */
export const AI_REACTION_SEC = 0.4;
export const AI_AIM_NOISE_DEG = 8;
/** Global AI difficulty; only the default is exposed in this slice. */
export const DIFFICULTY = 1.0;
/** The helm is left alone within this of the wanted course. */
export const AI_DEAD_BAND_DEG = 3;
/**
 * Beyond this range a fighting ship closes with the enemy directly; within it, it turns to bring
 * the chosen broadside to bear. (Replaces the spec's moving station point 80 px abeam, which
 * made two ships sail side by side for ever, ADR 013.)
 */
export const AI_ENGAGE_RANGE_PX = 70;
/** A tack in combat lasts at most this long (spec §7: the §4.4 rule in combat seconds). */
export const AI_TACK_MAX_SEC = 20;
/** Headings are sampled this far apart when looking for the best course to flee. */
export const AI_FLEE_SAMPLE_DEG = 10;
/** Fleeing ships only use headings with at least this polar factor (never into the wind). */
export const AI_FLEE_MIN_POLAR = 0.6;
/** A ship the enemy outnumbers this much stands off and withdraws rather than be boarded. */
export const AI_OUTNUMBERED_RATIO = 2.5;
/** Board when this much stronger in crew and above this hull. */
export const AI_BOARD_HULL_PCT = 50;
export const AI_ROLE_THRESHOLDS = {
  warship: { boardCrewRatio: 1.5, withdrawHullPct: 10 },
  pirate: { boardCrewRatio: 1.2, withdrawHullPct: 6 },
} as const;
/** Closing to board, a ship turns up to this far off its course to fire a loaded broadside. */
export const AI_YAW_TO_FIRE_DEG = 60;
/** With no hit on either side for this long, the ship with the larger (or equal) crew boards. */
export const AI_STALEMATE_SEC = 45;
/** A chase that has not gained 5 px in this long is given up: the pursuer lets her go. */
export const AI_CHASE_GIVE_UP_SEC = 60;
export const AI_CHASE_GAIN_PX = 5;
/** Lead pursuit looks at most this far ahead when intercepting. */
export const AI_LEAD_MAX_SEC = 5;

// ---- Boarding (§9, placeholder resolver) ----
export const BOARDING_KILL_RATE = 0.08;
/**
 * The defender fights harder. The spec's 10 % turns an even fight into a 75/25 win for the
 * defender, against its own target of 35–65 % for the attacker; 2 % keeps a clear edge
 * (about 57/43) and meets the target (ADR 013).
 */
export const BOARDING_DEFENDER_BONUS = 1.02;
export const BOARDING_ROLL_RANGE = [0.5, 1.5] as const;
/** A side yields below 30 % of its starting crew or below 50 % of the other side's crew. */
export const BOARDING_YIELD_START_SHARE = 0.3;
export const BOARDING_YIELD_OTHER_SHARE = 0.5;
export const BOARDING_MAX_ROUNDS = 30;

// ---- Balance harness (§10.4) ----
/** Fights longer than this are stopped and count as a draw (an escape). */
export const FIGHT_TIME_CAP_SEC = 600;
