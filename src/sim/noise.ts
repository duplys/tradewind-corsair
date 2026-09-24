// SPDX-License-Identifier: GPL-3.0-only
import { hash2 } from './rng';

export interface NoiseOctave {
  /** Lattice spacing in world px. */
  readonly scalePx: number;
  readonly weight: number;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Seeded 2-D value noise in [0, 1), with lattice points spaced `scalePx` apart. */
export function valueNoise(x: number, y: number, scalePx: number, seed: number): number {
  const fx = x / scalePx;
  const fy = y / scalePx;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

/** Weighted sum of value-noise octaves. With weights summing to 1 the result lies in [0, 1). */
export function fractalNoise(
  x: number,
  y: number,
  octaves: readonly NoiseOctave[],
  seed: number,
): number {
  let sum = 0;
  for (let i = 0; i < octaves.length; i++) {
    const o = octaves[i]!;
    sum += valueNoise(x, y, o.scalePx, seed + i * 7919) * o.weight;
  }
  return sum;
}
