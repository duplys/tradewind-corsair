// SPDX-License-Identifier: GPL-3.0-only

/**
 * A fresh random seed for a new voyage. Lives outside sim/ (which may not use ambient
 * randomness); from here on the voyage's own RNG makes everything deterministic.
 */
export function freshSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}
