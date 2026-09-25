// SPDX-License-Identifier: GPL-3.0-only
// Ship combat (slice 2 spec §6). Tuning lives here, not in the logic.
import type { SailingScale } from './sailing';

// ---- Arena (§6.2) ----
export const ARENA_W_PX = 720;
export const ARENA_H_PX = 480;
/** Combat px moved per second per knot; the arena has no land, so no bow probe. */
export const COMBAT_SAILING_SCALE: SailingScale = { pxPerSecPerKnot: 2.4, bowProbePx: 0 };
/** Start distance for most fights, and after a failed escape (enemy upwind). */
export const START_DISTANCE_PX = 220;
export const CAUGHT_START_DISTANCE_PX = 150;
/** Near the edge the view darkens as a warning (drawn from M6). */
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
