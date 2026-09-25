// SPDX-License-Identifier: GPL-3.0-only
import { HINT_FIRST_DELAY_SEC, HINT_INTERVAL_SEC } from '../data/voyage';

/**
 * Whether the next first-voyage hint is due (slice 1 spec §9.6): the first one shortly after
 * the voyage starts, then one every few seconds, until all have been shown.
 */
export function hintDue(hintsShown: number, secondsSinceLast: number, total: number): boolean {
  if (hintsShown >= total) return false;
  const wait = hintsShown === 0 ? HINT_FIRST_DELAY_SEC : HINT_INTERVAL_SEC;
  return secondsSinceLast >= wait;
}
