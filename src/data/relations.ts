// SPDX-License-Identifier: GPL-3.0-only
// Relations between nations (slice 2 spec §5.1). Static in this slice.
import type { NationId } from './nations';

/** A ship's colours: a nation, or none. */
export type Allegiance = NationId | 'pirate';

/** The player sails under an English letter of marque. */
export const PLAYER_NATION: NationId = 'en';

/** Pairs of nations at war in 1660. Every other pair of nations is at peace. */
const WARS: readonly (readonly [NationId, NationId])[] = [
  ['es', 'en'],
  ['es', 'fr'],
];

/** True when a and b are at war. Pirates are at war with everyone, including each other. */
export function atWar(a: Allegiance, b: Allegiance): boolean {
  if (a === 'pirate' || b === 'pirate') return true;
  return WARS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** Hostile to the player: at war with England, or pirate. */
export function hostileToPlayer(allegiance: Allegiance): boolean {
  return atWar(PLAYER_NATION, allegiance);
}
