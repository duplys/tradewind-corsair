// SPDX-License-Identifier: GPL-3.0-only
// Seeded randomness. All simulation randomness goes through here (CLAUDE.md rule 1).

/**
 * The generator's complete state: mulberry32's single unsigned 32-bit word. A plain number,
 * so it can be saved as JSON and restored exactly.
 */
export type RngState = number;

/** A seeded PRNG. Call it for a float in [0, 1). */
export interface Rng {
  (): number;
  /** The current state; `restoreRng(state)` continues the same sequence. */
  state(): RngState;
  /**
   * An independent child stream (e.g. one per encounter). Forking draws once from this stream
   * and mixes the label in, so it is deterministic, repeated forks with the same label differ,
   * and the child's draws never affect this stream.
   */
  fork(label: string): Rng;
}

/** mulberry32: small, fast, and good enough for games. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const nextUint32 = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const next = (): number => nextUint32() / 4294967296;
  return Object.assign(next, {
    state: (): RngState => a,
    fork: (label: string): Rng => createRng(mix32(nextUint32() ^ hashString(label))),
  });
}

/** Continue a sequence from a saved state. */
export function restoreRng(state: RngState): Rng {
  return createRng(state);
}

/** True for a value that can be an RNG state (an unsigned 32-bit integer). */
export function isRngState(value: unknown): value is RngState {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
}

/** murmur3's 32-bit finaliser: spreads every input bit over the output. */
function mix32(value: number): number {
  let h = value >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Stateless hash of an integer lattice point to a float in [0, 1). */
export function hash2(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** FNV-1a hash of a string to an unsigned 32-bit integer (for per-id seeds). */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
