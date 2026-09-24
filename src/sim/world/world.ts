// SPDX-License-Identifier: GPL-3.0-only
import { WORLD_H, WORLD_W } from '../../data/world';
import { chamferDistance } from './distance';
import { rasteriseGeography } from './rasterise';

export interface World {
  readonly width: number;
  readonly height: number;
  /** 1 = land, 0 = water. Row-major, width × height. */
  readonly landMask: Uint8Array;
  /** Distance in world px from each water pixel to the nearest land pixel (0 on land). */
  readonly distToLand: Float32Array;
  /** Distance in world px from each land pixel to the nearest water pixel (0 on water). */
  readonly distToWater: Float32Array;
}

/** Build a world (with distance fields) from any land mask. */
export function createWorld(width: number, height: number, landMask: Uint8Array): World {
  return {
    width,
    height,
    landMask,
    distToLand: chamferDistance(landMask, width, height, 1),
    distToWater: chamferDistance(landMask, width, height, 0),
  };
}

/** Build the Caribbean from the geography data. Deterministic. */
export function buildWorld(): World {
  return createWorld(WORLD_W, WORLD_H, rasteriseGeography(WORLD_W, WORLD_H));
}

function indexAt(world: World, x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (!(xi >= 0 && yi >= 0 && xi < world.width && yi < world.height)) return -1;
  return yi * world.width + xi;
}

/** True on land and everywhere outside the map, so the map edge blocks ships. */
export function isLand(world: World, x: number, y: number): boolean {
  const i = indexAt(world, x, y);
  return i < 0 || world.landMask[i] === 1;
}

/** Distance to the nearest land in world px; 0 on land and outside the map. */
export function distToLandAt(world: World, x: number, y: number): number {
  const i = indexAt(world, x, y);
  return i < 0 ? 0 : world.distToLand[i]!;
}
