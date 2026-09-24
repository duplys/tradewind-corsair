// SPDX-License-Identifier: GPL-3.0-only
import { GAME_HOURS_PER_SECOND } from '../data/sailing';

/**
 * Game clock (slice 1 spec §7). `elapsedHours` counts from 1 March 1660, 00:00; a new voyage
 * starts at 08:00 that day. The date formatter arrives with the HUD (M4).
 */
export const START_ELAPSED_HOURS = 8;

/** Advance the clock by a real-time step. Only the sailing mode calls this. */
export function advanceClock(elapsedHours: number, dtSec: number): number {
  return elapsedHours + dtSec * GAME_HOURS_PER_SECOND;
}
