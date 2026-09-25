// SPDX-License-Identifier: GPL-3.0-only
// Sailing balance (slice 1 spec §3.2, §5, §6). Tuning lives here, not in the logic.

/** 1° of latitude = 60 nm and 40 world px, so one nautical mile is 2/3 of a world px. */
export const PX_PER_NM = 40 / 60;
/** 1 real second = 4 game hours; one game day is about 6 real seconds. */
export const GAME_HOURS_PER_SECOND = 4;

export type SailSetting = 'furled' | 'half' | 'full';
export const SAIL_ORDER: readonly SailSetting[] = ['furled', 'half', 'full'];
export const SAIL_FACTOR: Readonly<Record<SailSetting, number>> = {
  furled: 0,
  half: 0.55,
  full: 1,
};

/** Steering: turn = rate · (STEER_MIN_FRACTION + (1 − MIN) · min(1, speed / STEER_FULL_WAY_KN)). */
export const STEER_MIN_FRACTION = 0.4;
export const STEER_FULL_WAY_KN = 4;

/** Wind strength scales target speed by clamp(windKn / WIND_REF_KN, MIN, MAX). */
export const WIND_REF_KN = 14;
export const WIND_FACTOR_MIN = 0.45;
export const WIND_FACTOR_MAX = 1.3;

/** Collision probe ahead of the ship, in world px. */
export const BOW_PROBE_PX = 7;

/**
 * The scale that turns knots into movement for one kind of map. The ship physics is the same
 * everywhere (player, NPCs, combat); only these constants differ.
 */
export interface SailingScale {
  /** Map pixels moved per second of simulation per knot of speed. */
  readonly pxPerSecPerKnot: number;
  /** Collision probe ahead of the bow, in map pixels. */
  readonly bowProbePx: number;
}

/** The world map (slice 1 spec §3.2): about 2.67 world px per second per knot. */
export const WORLD_SAILING_SCALE: SailingScale = {
  pxPerSecPerKnot: PX_PER_NM * GAME_HOURS_PER_SECOND,
  bowProbePx: BOW_PROBE_PX,
};

/** Wind model (spec §5): the trades blow toward the WSW, i.e. from the ENE. */
export const WIND_BASE_TOWARD_RAD = Math.PI - 0.35;
export const WIND_SPEED_MIN_KN = 5;
export const WIND_SPEED_MAX_KN = 20;

/** Point-of-sail labels by relative angle to the wind's toward direction (spec §6.4). */
export type PointOfSail = 'running' | 'broadReach' | 'beamReach' | 'closeHauled' | 'inIrons';
export const POINT_OF_SAIL_BANDS: readonly {
  readonly belowDeg: number;
  readonly id: PointOfSail;
}[] = [
  { belowDeg: 30, id: 'running' },
  { belowDeg: 70, id: 'broadReach' },
  { belowDeg: 110, id: 'beamReach' },
  { belowDeg: 145, id: 'closeHauled' },
  { belowDeg: Infinity, id: 'inIrons' },
];

/** Harbour search (spec §4.1): nearest land, then nearest water this far from land. */
export const HARBOUR_MIN_DIST_TO_LAND_PX = 3;
export const PORT_SEARCH_MAX_RADIUS_PX = 40;
/** Open-water heading (spec §4.2): sample directions, probe this far out. */
export const OPEN_WATER_DIRECTIONS = 32;
export const OPEN_WATER_PROBE_PX = 20;

/** A ship is near a port (and may drop anchor) within this distance of its harbour. */
export const DOCK_RADIUS_PX = 18;

/** Half-width of the no-go wedge drawn on the compass around the upwind direction. */
export const NO_GO_HALF_ANGLE_DEG = 35;
