// SPDX-License-Identifier: GPL-3.0-only
import { fractalNoise } from '../../sim/noise';
import type { World } from '../../sim/world/world';
import {
  BAYER4,
  BEACH_WIDTH_PX,
  ELEV_DIST_CAP,
  ELEV_DIST_WEIGHT,
  ELEV_DITHER_SPREAD,
  ELEV_NOISE_WEIGHT,
  SAND,
  TERRAIN_BANDS,
  TERRAIN_NOISE,
  WATER_BANDS,
  WATER_DITHER_SPREAD,
  WATER_NOISE_AMOUNT,
  WATER_NOISE_FROM_PX,
  hexToRgb,
  type Band,
} from '../palette';

function bandIndex(bands: readonly Band[], value: number): number {
  for (let i = 0; i < bands.length - 1; i++) if (value < bands[i]!.below) return i;
  return bands.length - 1;
}

/**
 * Colour every world pixel (slice 1 spec §3.5): dithered water bands by distance to land,
 * beach, then noisy terrain elevation bands. Pure and deterministic for a given seed.
 */
export function computeMapPixels(world: World, seed: number): Uint8ClampedArray {
  const { width, height, landMask, distToLand, distToWater } = world;
  const out = new Uint8ClampedArray(width * height * 4);
  const water = WATER_BANDS.map((b) => hexToRgb(b.color));
  const terrain = TERRAIN_BANDS.map((b) => hexToRgb(b.color));
  const sand = hexToRgb(SAND);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const b = BAYER4[(y & 3) * 4 + (x & 3)]! / 16;
      let rgb: readonly [number, number, number];
      if (landMask[i] === 0) {
        const d = distToLand[i]!;
        let t = d + (b - 0.5) * WATER_DITHER_SPREAD;
        if (d > WATER_NOISE_FROM_PX)
          t += fractalNoise(x, y, TERRAIN_NOISE, seed) * WATER_NOISE_AMOUNT;
        rgb = water[bandIndex(WATER_BANDS, t)]!;
      } else {
        const dw = distToWater[i]!;
        if (dw < BEACH_WIDTH_PX + (b - 0.5)) {
          rgb = sand;
        } else {
          const n = fractalNoise(x, y, TERRAIN_NOISE, seed + 1);
          const e =
            Math.min(dw, ELEV_DIST_CAP) * ELEV_DIST_WEIGHT +
            n * ELEV_NOISE_WEIGHT +
            (b - 0.5) * ELEV_DITHER_SPREAD;
          rgb = terrain[bandIndex(TERRAIN_BANDS, e)]!;
        }
      }
      const o = i * 4;
      out[o] = rgb[0];
      out[o + 1] = rgb[1];
      out[o + 2] = rgb[2];
      out[o + 3] = 255;
    }
  }
  return out;
}
