// SPDX-License-Identifier: GPL-3.0-only
import { LAT_MAX, LON_MIN, PPD } from '../../data/world';

export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

export interface LonLatPoint {
  readonly lon: number;
  readonly lat: number;
}

/** Equirectangular projection from degrees to world pixels (slice 1 spec §3.1). */
export function lonLatToWorld(lon: number, lat: number): WorldPoint {
  return { x: (lon - LON_MIN) * PPD, y: (LAT_MAX - lat) * PPD };
}

export function worldToLonLat(x: number, y: number): LonLatPoint {
  return { lon: x / PPD + LON_MIN, lat: LAT_MAX - y / PPD };
}
