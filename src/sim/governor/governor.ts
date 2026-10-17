// SPDX-License-Identifier: GPL-3.0-only
import {
  BOUNTY_BY_CLASS,
  BOUNTY_ROLE_FACTOR,
  CROWN_NATION,
  RANK_REWARDS,
  RANK_THRESHOLDS,
  RANK_TITLES,
  REPUTATION_PER_GOLD,
  STANDING_BANDS,
} from '../../data/governor';
import type { NationId } from '../../data/nations';
import { hostileToPlayer } from '../../data/relations';
import type { NpcShip } from '../npc/npc';
import type { Voyage } from '../voyage';

/** Bounty earned but not yet collected, split by who pays it. */
export interface Bounty {
  /** Pirate ships: any friendly governor pays. */
  readonly pirate: number;
  /** Ships of nations at war with the crown: only the crown's governors pay. */
  readonly crown: number;
}

export const NO_BOUNTY: Bounty = { pirate: 0, crown: 0 };

/** Gold claimed from each nation's governors over the career (drives rank). */
export type Claimed = Readonly<Record<NationId, number>>;

/** What taking or sinking `npc` is worth, and who pays it; null for a friendly ship. */
export function bountyFor(npc: NpcShip): { kind: keyof Bounty; gold: number } | null {
  const gold = Math.round(BOUNTY_BY_CLASS[npc.classId] * BOUNTY_ROLE_FACTOR[npc.role]);
  if (npc.nation === 'pirate') return { kind: 'pirate', gold };
  return hostileToPlayer(npc.nation) ? { kind: 'crown', gold } : null;
}

/** Add the bounty for a ship the player took or sank. */
export function addBounty(voyage: Voyage, npc: NpcShip): Voyage {
  const b = bountyFor(npc);
  if (!b) return voyage;
  return { ...voyage, bounty: { ...voyage.bounty, [b.kind]: voyage.bounty[b.kind] + b.gold } };
}

/** The bounty a governor of `nation` would pay now. */
export function claimable(voyage: Voyage, nation: NationId): number {
  return voyage.bounty.pirate + (nation === CROWN_NATION ? voyage.bounty.crown : 0);
}

/** Rank index 0..4: how many thresholds the claimed gold has reached. */
export function rankIndex(claimedGold: number): number {
  return RANK_THRESHOLDS.filter((t) => claimedGold >= t).length;
}

export interface Rank {
  readonly index: number;
  readonly title: string;
  /** The next title and the total claimed gold it needs, or null at the top. */
  readonly next: { readonly title: string; readonly atGold: number } | null;
}

export function rankOf(nation: NationId, claimedGold: number): Rank {
  const index = rankIndex(claimedGold);
  const titles = RANK_TITLES[nation];
  const atGold = RANK_THRESHOLDS[index];
  return {
    index,
    title: titles[index]!,
    next: atGold === undefined ? null : { title: titles[index + 1]!, atGold },
  };
}

/** The word for how a nation regards the player. */
export function standingLabel(reputation: number): string {
  return STANDING_BANDS.find((band) => reputation <= band.upTo)!.label;
}

export interface ClaimResult {
  readonly voyage: Voyage;
  /** Bounty paid. */
  readonly gold: number;
  /** Gold paid on top for promotion, 0 if none. */
  readonly promotionGold: number;
  /** The new rank title if promoted. */
  readonly promotedTo: string | null;
}

/** Collect what this governor pays; promotion is automatic when the career total allows. */
export function claimBounty(voyage: Voyage, nation: NationId): ClaimResult {
  const gold = claimable(voyage, nation);
  if (gold <= 0) return { voyage, gold: 0, promotionGold: 0, promotedTo: null };
  const before = rankIndex(voyage.claimed[nation]);
  const claimedGold = voyage.claimed[nation] + gold;
  const after = rankIndex(claimedGold);
  const promotionGold = RANK_REWARDS.slice(before, after).reduce((a, b) => a + b, 0);
  return {
    gold,
    promotionGold,
    promotedTo: after > before ? RANK_TITLES[nation][after]! : null,
    voyage: {
      ...voyage,
      gold: voyage.gold + gold + promotionGold,
      bounty: {
        pirate: 0,
        crown: nation === CROWN_NATION ? 0 : voyage.bounty.crown,
      },
      claimed: { ...voyage.claimed, [nation]: claimedGold },
      reputation: {
        ...voyage.reputation,
        [nation]: voyage.reputation[nation] + gold * REPUTATION_PER_GOLD,
      },
    },
  };
}
