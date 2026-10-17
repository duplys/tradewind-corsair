// SPDX-License-Identifier: GPL-3.0-only
import { HIRE_GOLD_PER_HAND } from '../../data/tavern';
import { SHIP_CLASSES } from '../../data/ships';
import type { Voyage } from '../voyage';

/** Berths free for new hands. */
export function freeBerths(voyage: Voyage): number {
  return Math.max(0, SHIP_CLASSES[voyage.ship.classId].crewMax - voyage.condition.crew);
}

/** The most hands the player can sign on now: limited by berths and gold. */
export function maxHires(voyage: Voyage): number {
  return Math.min(freeBerths(voyage), Math.floor(voyage.gold / HIRE_GOLD_PER_HAND));
}

/** Sign on up to `count` hands at the tavern price; fewer if berths or gold run out. */
export function hireCrew(voyage: Voyage, count: number): Voyage {
  const n = Math.min(count, maxHires(voyage));
  if (n <= 0) return voyage;
  return {
    ...voyage,
    gold: voyage.gold - n * HIRE_GOLD_PER_HAND,
    condition: { ...voyage.condition, crew: voyage.condition.crew + n },
  };
}
