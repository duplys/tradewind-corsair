// SPDX-License-Identifier: GPL-3.0-only
// Small helpers for drawing from a seeded Rng.
import type { Weighted } from '../data/npc';
import type { Rng } from './rng';

/** Uniform float in [min, max). */
export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Uniform integer in [min, max], both included. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element, uniformly. Throws on an empty list. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from an empty list');
  return items[Math.floor(rng() * items.length)]!;
}

/** One value by weight; entries with weight ≤ 0 are never picked. Null if nothing can be. */
export function pickWeighted<T>(rng: Rng, entries: Weighted<T>): T | null {
  let total = 0;
  for (const [, w] of entries) if (w > 0) total += w;
  if (total <= 0) return null;
  let r = rng() * total;
  for (const [value, w] of entries) {
    if (w <= 0) continue;
    r -= w;
    if (r < 0) return value;
  }
  return entries.filter(([, w]) => w > 0).at(-1)![0];
}
