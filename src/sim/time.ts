// SPDX-License-Identifier: GPL-3.0-only
import { GAME_HOURS_PER_SECOND } from '../data/sailing';

/**
 * Game clock (slice 1 spec §7). `elapsedHours` counts from 1 March 1660, 00:00; a new voyage
 * starts at 08:00 that day. The sim never reads the wall clock.
 */
export const START_ELAPSED_HOURS = 8;

const EPOCH_YEAR = 1660;
const EPOCH_MONTH_INDEX = 2; // March
const MS_PER_HOUR = 3_600_000;

/** Advance the clock by a real-time step. Only the sailing mode calls this. */
export function advanceClock(elapsedHours: number, dtSec: number): number {
  return elapsedHours + dtSec * GAME_HOURS_PER_SECOND;
}

/**
 * Format the game date as "1 March 1660". Uses `Date` purely as a proleptic Gregorian
 * calendar (UTC, no time zone, never the current time); month names are passed in so the
 * text stays translatable.
 */
export function formatDate(elapsedHours: number, monthNames: readonly string[]): string {
  const ms = Date.UTC(EPOCH_YEAR, EPOCH_MONTH_INDEX, 1) + Math.floor(elapsedHours) * MS_PER_HOUR;
  const date = new Date(ms);
  return `${date.getUTCDate()} ${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
