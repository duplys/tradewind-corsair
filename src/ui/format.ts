// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';

/** Game hours as "4 days", "1 day, 6 hours" or "12 hours". */
export function formatDuration(hours: number): string {
  const whole = Math.round(hours);
  const days = Math.floor(whole / 24);
  const rest = whole % 24;
  const d = STRINGS.duration;
  if (days > 0 && rest > 0) return d.join(d.days(days), d.hours(rest));
  if (days > 0) return d.days(days);
  if (rest > 0) return d.hours(rest);
  return d.none;
}

/** Gold with thousands separators: "1,250". */
export function formatGold(gold: number): string {
  return Math.round(gold).toLocaleString('en');
}

/** A percentage for display: whole numbers, and never 0 while something is left. */
export function displayPct(pct: number): number {
  if (pct > 0 && pct < 1) return 1;
  return Math.floor(pct);
}
