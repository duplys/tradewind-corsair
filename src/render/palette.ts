// SPDX-License-Identifier: GPL-3.0-only
// The single source of truth for colours drawn on canvas. CSS mirrors the UI tokens as custom
// properties. Map thresholds (slice 1 spec §3.5) live here so they can be tuned by eye.
import type { NoiseOctave } from '../sim/noise';

/** Deep sea: page background, theme-color and the empty canvas. */
export const DEEP_SEA = '#0b1a2e';

export interface Band {
  /** The band applies while the value is below this threshold. */
  readonly below: number;
  readonly color: string;
}

/** Water bands by dithered distance to land `t`. The last band catches everything else. */
export const WATER_BANDS: readonly Band[] = [
  { below: 1.5, color: '#cfe6d6' }, // surf
  { below: 5, color: '#4aa3a8' }, // shallows
  { below: 11, color: '#2f7d97' }, // reef shelf
  { below: 22, color: '#23608a' }, // coastal sea
  { below: 45, color: '#1c4c78' }, // open sea
  { below: Infinity, color: '#173f69' }, // deep ocean
];

/** Beyond this distance to land, noise adds gentle patches to the open ocean. */
export const WATER_NOISE_FROM_PX = 22;
export const WATER_NOISE_AMOUNT = 10;
/** How far (in distance units) the Bayer offset spreads band edges in water. */
export const WATER_DITHER_SPREAD = 3;

export const SAND = '#dcc68e';
/** Land pixels with distToWater below this (plus dither) are beach. */
export const BEACH_WIDTH_PX = 2.2;

/** Elevation e = min(dw, ELEV_DIST_CAP)·ELEV_DIST_WEIGHT + n·ELEV_NOISE_WEIGHT + dither. */
export const ELEV_DIST_CAP = 30;
export const ELEV_DIST_WEIGHT = 0.55;
export const ELEV_NOISE_WEIGHT = 22;
export const ELEV_DITHER_SPREAD = 3;

export const TERRAIN_BANDS: readonly Band[] = [
  { below: 9, color: '#6f9a45' }, // grass
  { below: 15, color: '#4f7f3a' }, // scrub
  { below: 21, color: '#3a6630' }, // forest
  { below: 27, color: '#2e5028' }, // jungle
  { below: 31, color: '#76703f' }, // hills
  { below: 35, color: '#8b6b47' }, // mountain
  { below: Infinity, color: '#b3a07f' }, // peaks
];

/** Terrain noise: two octaves (spec §3.5). */
export const TERRAIN_NOISE: readonly NoiseOctave[] = [
  { scalePx: 28, weight: 0.65 },
  { scalePx: 9, weight: 0.35 },
];

/** Bayer 4×4 ordered-dither matrix, values 0..15 (divide by 16 for [0, 1)). */
// prettier-ignore
export const BAYER4: readonly number[] = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
];

/** Parse '#rrggbb' to [r, g, b]. */
export function hexToRgb(hex: string): readonly [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Ship sprite colours (spec §8.4). Every sprite pixel is quantised to one of these. */
export const SHIP_COLORS = {
  hull: '#5a3a1e',
  deck: '#8a5a2c',
  sail: '#f2ead2',
  sailShade: '#cfc3a0',
  mast: '#2b1a0e',
} as const;
export const SPRITE_OUTLINE = '#10213a';

export const WAKE_COLOR = '#cfe6ea';
export const PENNANT_COLOR = '#b3261e';

/** Compass colours (spec §9.1). Brass matches the --brass UI token. */
export const COMPASS_COLORS = {
  face: 'rgba(9, 22, 40, 0.9)',
  ring: '#c9a24a',
  tick: '#c9a24a',
  north: '#eadcb4',
  noGo: 'rgba(200, 48, 36, 0.5)',
  wind: '#a8d4ef',
  needle: '#e3c26a',
  hub: '#2a1d12',
} as const;

/** Towns stamped onto the map (spec §3.5). */
export const TOWN_COLORS = {
  fort: '#8c8a86',
  gate: '#2e2a26',
  roof: '#b04a2e',
  wall: '#e8e0cc',
} as const;

export const FLAG_POLE = '#2b1a0e';

/** Port labels on the native-resolution label canvas (spec §8.3 step 6). */
export const LABEL_FILL = '#eadcb4';
export const LABEL_STROKE = '#0b1a2e';

/** Chart overlay colours (spec §9.3). */
export const CHART_COLORS = {
  ink: '#2a1d12',
  grid: 'rgba(42, 29, 18, 0.22)',
  frame: '#c9a24a',
  halo: 'rgba(234, 220, 180, 0.9)',
  ship: '#c9a24a',
  roseFill: 'rgba(234, 220, 180, 0.85)',
  wind: '#2f6f9a',
} as const;

/** Sea sparkle highlight (spec §8.3 step 2). */
export const SPARKLE_COLOR = '#6fa8c8';
