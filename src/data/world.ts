// SPDX-License-Identifier: GPL-3.0-only
// World projection constants (slice 1 spec §3.1). Equirectangular over the Caribbean.

export const LON_MIN = -98;
export const LON_MAX = -59;
export const LAT_MIN = 7;
export const LAT_MAX = 30;

/** World pixels per degree of latitude or longitude. */
export const PPD = 40;

export const WORLD_W = (LON_MAX - LON_MIN) * PPD;
export const WORLD_H = (LAT_MAX - LAT_MIN) * PPD;
