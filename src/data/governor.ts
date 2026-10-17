// SPDX-License-Identifier: GPL-3.0-only
// The Governor: bounties, standing and rank (slice 4 spec §4). Tuning lives here.
import type { NpcRole } from './npc';
import type { NationId } from './nations';
import type { ShipClassId } from './ships';

/** Bounty for an enemy ship taken or sunk, by her class, in gold. */
export const BOUNTY_BY_CLASS: Readonly<Record<ShipClassId, number>> = {
  sloop: 40,
  brigantine: 100,
  fluyt: 70,
  frigate: 250,
  galleon: 400,
};

/** Warships and pirates are worth more to a governor than merchantmen. */
export const BOUNTY_ROLE_FACTOR: Readonly<Record<NpcRole, number>> = {
  trader: 1,
  warship: 1.25,
  pirate: 1.5,
};

/** The crown pays for ships of nations at war with it; every friendly governor pays for pirates. */
export const CROWN_NATION: NationId = 'en';

/** Reputation gained with a governor's nation per gold of bounty claimed from them. */
export const REPUTATION_PER_GOLD = 0.01;

/** Gold claimed from a nation's governors needed for each rank after the first. */
export const RANK_THRESHOLDS: readonly number[] = [150, 500, 1200, 2500];
/** Gold paid on reaching each rank after the first. */
export const RANK_REWARDS: readonly number[] = [100, 200, 400, 800];

/** Rank titles, lowest first. Original wording; one ladder per nation that serves the player. */
export const RANK_TITLES: Readonly<Record<NationId, readonly string[]>> = {
  en: ['Adventurer', 'Sea-Captain', 'Commander of the Coast', 'Captain of the Fleet', 'Commodore'],
  fr: ['Aventurier', 'Capitaine de Mer', 'Capitaine du Roi', 'Chef de Flotte', 'Amiral des Isles'],
  nl: ['Zeevaarder', 'Kapitein', 'Kapitein ter Zee', 'Vlootvoogd', 'Admiraal van de Vaart'],
  es: ['Aventurero', 'Capitán', 'Capitán de Costa', 'General de Flota', 'Almirante'],
};

/** Standing is named by the first band whose upper bound it is at or below. */
export const STANDING_BANDS: readonly { readonly upTo: number; readonly label: string }[] = [
  { upTo: -3, label: 'Hated' },
  { upTo: -1, label: 'Distrusted' },
  { upTo: 0.99, label: 'Unknown' },
  { upTo: 2.99, label: 'Respected' },
  { upTo: Infinity, label: 'Honoured' },
];
