// SPDX-License-Identifier: GPL-3.0-only
// Small pure helpers for the combat HUD (slice 2 spec §10.3).
import { YARDS_PER_COMBAT_PX } from '../data/combat';

/** Beyond this range the enemy's crew is only estimated. */
export const CREW_ESTIMATE_RANGE_PX = 100;

/** The enemy's crew as the HUD shows it: to the nearest 10 while far off, exact up close. */
export function crewShown(crew: number, rangePx: number): { crew: number; estimate: boolean } {
  if (rangePx <= CREW_ESTIMATE_RANGE_PX) return { crew, estimate: false };
  return { crew: Math.round(crew / 10) * 10, estimate: true };
}

/** How far a side has reloaded, 0..1 (1 = ready). */
export function reloadFraction(reloadSec: number, totalSec: number): number {
  if (reloadSec <= 0 || totalSec <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - reloadSec / totalSec));
}

/** Combat px as yards (flavour only, but the same everywhere). */
export function yards(combatPx: number): number {
  return Math.round(combatPx * YARDS_PER_COMBAT_PX);
}
