// SPDX-License-Identifier: GPL-3.0-only
// NPC ships on the world map (slice 2 spec §4). Tuning lives here, not in the logic.
import type { NationId } from './nations';
import { GAME_HOURS_PER_SECOND } from './sailing';
import type { ShipClassId } from './ships';

// ---- Navigation grid (§4.2) ----
export const NAV_CELL_PX = 12;
/** A cell is navigable if its centre is this far from land ... */
export const NAV_MIN_DIST_TO_LAND_PX = 5;
/** ... and at least this share of its pixels is water. */
export const NAV_MIN_WATER_SHARE = 0.8;
/** Line of sight: sample a segment every few px and require this clearance from land. */
export const LOS_SAMPLE_PX = 3;
export const LOS_MIN_DIST_TO_LAND_PX = 3;
/** How far (in cells) to look for a navigable cell to join a harbour or other point to. */
export const SNAP_MAX_CELLS = 6;

// ---- Spawning and despawning (§4.3) ----
export const NPC_TARGET_NEARBY = 6;
export const NPC_NEARBY_RADIUS_PX = 250;
/** The chart shows NPCs this close to the player (§4.5). */
export const NPC_CHART_RANGE_PX = 250;
/** Never more NPCs than this on the map at once (performance budget, §12). */
export const NPC_MAX = 10;
export const NPC_SPAWN_CHECK_HOURS = 2;
export const NPC_SPAWN_MIN_PX = 140;
export const NPC_SPAWN_MAX_PX = 240;
/** Share of spawns placed on a sea lane between two ports. */
export const NPC_LANE_SHARE = 0.7;
/** Lanes are port-to-port paths between ports this close to the player. */
export const NPC_LANE_PORT_RADIUS_PX = 400;
/** Lane positions are sampled along the path this far apart. */
export const NPC_LANE_SAMPLE_PX = 12;
/** Ports within this distance of the spawn point decide its nation (weight 1 / distance). */
export const NPC_NATION_PORT_RADIUS_PX = 300;
export const NPC_PIRATE_CHANCE = 0.1;
/** A destination must be at least this far from the spawn point. */
export const NPC_MIN_TRIP_PX = 60;
export const NPC_DESPAWN_PX = 320;
/** A travelling NPC enters port within this distance of its destination harbour. */
export const NPC_ARRIVAL_PX = 12;
/** New NPCs start under way at this share of their class's top speed. */
export const NPC_SPAWN_SPEED_SHARE = 0.6;

export const NPC_HULL_PCT_RANGE = [85, 100] as const;
export const NPC_RIGGING_PCT_RANGE = [85, 100] as const;
/** Crew as a share of crewTypical (traders sail short-handed: 60 % × 80–110 %). */
export const NPC_CREW_SHARE_RANGE = [0.8, 1.1] as const;
export const NPC_TRADER_CREW_FACTOR = 0.6;

/** The galleon sails only to or from these treasure ports. */
export const GALLEON_PORT_IDS: readonly string[] = [
  'havana',
  'veracruz',
  'porto-bello',
  'cartagena',
];

export type NpcRole = 'trader' | 'warship' | 'pirate';
export type Weighted<T> = readonly (readonly [T, number])[];

export const ROLE_WEIGHTS: Readonly<Record<NationId, Weighted<'trader' | 'warship'>>> = {
  es: [
    ['trader', 60],
    ['warship', 40],
  ],
  en: [
    ['trader', 70],
    ['warship', 30],
  ],
  fr: [
    ['trader', 70],
    ['warship', 30],
  ],
  nl: [
    ['trader', 70],
    ['warship', 30],
  ],
};

const OTHER_TRADERS: Weighted<ShipClassId> = [
  ['fluyt', 4],
  ['sloop', 3],
  ['brigantine', 1],
];
const OTHER_WARSHIPS: Weighted<ShipClassId> = [
  ['frigate', 2],
  ['brigantine', 3],
];

export const TRADER_CLASS_WEIGHTS: Readonly<Record<NationId, Weighted<ShipClassId>>> = {
  es: [
    ['fluyt', 4],
    ['sloop', 2],
    ['galleon', 1],
  ],
  en: OTHER_TRADERS,
  fr: OTHER_TRADERS,
  nl: OTHER_TRADERS,
};

export const WARSHIP_CLASS_WEIGHTS: Readonly<Record<NationId, Weighted<ShipClassId>>> = {
  es: [
    ['frigate', 3],
    ['brigantine', 2],
  ],
  en: OTHER_WARSHIPS,
  fr: OTHER_WARSHIPS,
  nl: OTHER_WARSHIPS,
};

export const PIRATE_CLASS_WEIGHTS: Weighted<ShipClassId> = [
  ['sloop', 4],
  ['brigantine', 3],
  ['frigate', 1],
];

// ---- World-map sailing AI (§4.4) ----
/** The AI decides 10 times per real second; in game hours that is this interval. */
export const NPC_AI_TICK_HOURS = GAME_HOURS_PER_SECOND / 10;
export const WAYPOINT_REACHED_PX = 8;
/** The helm is left alone while the heading is within this of the wanted heading. */
export const STEER_DEAD_BAND_DEG = 4;
/** Tack when the wanted heading is closer than 180 − this to the wind's toward direction. */
export const TACK_REL_DEG = 140;
/** Close-hauled course on a tack: this far off the wind's eye. */
export const TACK_OFF_WIND_DEG = 45;
/** Change tack at the latest after this long on one tack. */
export const TACK_MAX_HOURS = 36;
/** Bearing must cross the wind axis by this much before tacking back (avoids dithering). */
export const TACK_HYSTERESIS_DEG = 3;
export const STUCK_WINDOW_HOURS = 12;
export const STUCK_MIN_MOVE_PX = 3;
export const PIRATE_LOITER_RADIUS_PX = 150;
/**
 * Pirates loiter this long, then sail off toward their named port and leave the map, so they
 * do not pile up around a player who stays in one area (ADR 010).
 */
export const PIRATE_LOITER_HOURS = 96;
