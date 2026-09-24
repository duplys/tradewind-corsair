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
