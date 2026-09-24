// SPDX-License-Identifier: GPL-3.0-only
import {
  HARBOUR_MIN_DIST_TO_LAND_PX,
  OPEN_WATER_DIRECTIONS,
  OPEN_WATER_PROBE_PX,
  PORT_SEARCH_MAX_RADIUS_PX,
} from '../../data/sailing';
import { TAU, normaliseAngle } from '../math';
import type { WorldPoint } from './projection';
import { distToLandAt, type World } from './world';

/**
 * Search outward ring by ring (square rings) from (x, y) for a pixel matching `accept`.
 * Returns the centre of the closest matching pixel in the first ring that has one.
 */
export function searchRings(
  world: World,
  x: number,
  y: number,
  maxRadiusPx: number,
  accept: (index: number) => boolean,
): WorldPoint | null {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  for (let r = 0; r <= maxRadiusPx; r++) {
    let best: WorldPoint | null = null;
    let bestD2 = Infinity;
    for (let py = cy - r; py <= cy + r; py++) {
      if (py < 0 || py >= world.height) continue;
      const onEdgeRow = py === cy - r || py === cy + r;
      const step = onEdgeRow ? 1 : 2 * r || 1;
      for (let px = cx - r; px <= cx + r; px += step) {
        if (px < 0 || px >= world.width) continue;
        if (!accept(py * world.width + px)) continue;
        const d2 = (px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = { x: px + 0.5, y: py + 0.5 };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Nearest land pixel (spec §4.1 step 1: the town). */
export function nearestLand(world: World, x: number, y: number): WorldPoint | null {
  return searchRings(world, x, y, PORT_SEARCH_MAX_RADIUS_PX, (i) => world.landMask[i] === 1);
}

/** Nearest water pixel with enough clearance from land (spec §4.1 step 2: the harbour). */
export function nearestHarbourWater(world: World, x: number, y: number): WorldPoint | null {
  return searchRings(
    world,
    x,
    y,
    PORT_SEARCH_MAX_RADIUS_PX,
    (i) => world.distToLand[i]! >= HARBOUR_MIN_DIST_TO_LAND_PX,
  );
}

/** Heading toward the most open water around a point (spec §4.2). */
export function openWaterHeading(world: World, x: number, y: number): number {
  let bestHeading = 0;
  let bestDist = -1;
  for (let i = 0; i < OPEN_WATER_DIRECTIONS; i++) {
    const heading = (i / OPEN_WATER_DIRECTIONS) * TAU;
    const d = distToLandAt(
      world,
      x + Math.cos(heading) * OPEN_WATER_PROBE_PX,
      y + Math.sin(heading) * OPEN_WATER_PROBE_PX,
    );
    if (d > bestDist) {
      bestDist = d;
      bestHeading = heading;
    }
  }
  return normaliseAngle(bestHeading);
}
