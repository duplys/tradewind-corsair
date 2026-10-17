// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { PORTS } from '../../../src/data/ports';
import { RANK_REWARDS, RANK_THRESHOLDS, REPUTATION_PER_GOLD } from '../../../src/data/governor';
import {
  addBounty,
  bountyFor,
  claimable,
  claimBounty,
  rankIndex,
  rankOf,
  standingLabel,
} from '../../../src/sim/governor/governor';
import { newVoyage, type Voyage } from '../../../src/sim/voyage';
import { derivePorts } from '../../../src/sim/world/ports';
import { buildWorld } from '../../../src/sim/world/world';
import { makeNpc } from '../npc/helpers';

let voyage: Voyage;

beforeAll(() => {
  const world = buildWorld();
  voyage = newVoyage(world, derivePorts(world, PORTS));
});

const pirate = (classId: 'sloop' | 'frigate' = 'sloop') =>
  makeNpc({ nation: 'pirate', role: 'pirate', classId });

describe('bounty', () => {
  it('is paid for pirates and for nations at war with England, not for friends', () => {
    expect(bountyFor(pirate())?.kind).toBe('pirate');
    expect(bountyFor(makeNpc({ nation: 'es', role: 'warship' }))?.kind).toBe('crown');
    expect(bountyFor(makeNpc({ nation: 'fr' }))).toBeNull();
    expect(bountyFor(makeNpc({ nation: 'en' }))).toBeNull();
    expect(bountyFor(makeNpc({ nation: 'nl' }))).toBeNull();
  });

  it('is worth more for bigger ships and for pirates than for merchantmen', () => {
    const small = bountyFor(pirate('sloop'))!.gold;
    expect(bountyFor(pirate('frigate'))!.gold).toBeGreaterThan(small);
    const trader = bountyFor(makeNpc({ nation: 'es', role: 'trader', classId: 'sloop' }))!.gold;
    expect(small).toBeGreaterThan(trader);
  });

  it('accumulates in the right pool', () => {
    let v = addBounty(voyage, pirate());
    v = addBounty(v, makeNpc({ nation: 'es', role: 'trader' }));
    v = addBounty(v, makeNpc({ nation: 'fr' }));
    expect(v.bounty.pirate).toBeGreaterThan(0);
    expect(v.bounty.crown).toBeGreaterThan(0);
    expect(claimable(v, 'en')).toBe(v.bounty.pirate + v.bounty.crown);
    expect(claimable(v, 'fr')).toBe(v.bounty.pirate);
    expect(claimable(v, 'nl')).toBe(v.bounty.pirate);
  });
});

describe('claiming', () => {
  it('pays out, clears only what that governor paid, and raises standing', () => {
    const v = { ...voyage, bounty: { pirate: 40, crown: 70 } };
    const french = claimBounty(v, 'fr');
    expect(french.gold).toBe(40);
    expect(french.voyage.gold).toBe(v.gold + 40);
    expect(french.voyage.bounty).toEqual({ pirate: 0, crown: 70 });
    expect(french.voyage.reputation.fr).toBeCloseTo(40 * REPUTATION_PER_GOLD);
    const english = claimBounty(french.voyage, 'en');
    expect(english.gold).toBe(70);
    expect(english.voyage.bounty).toEqual({ pirate: 0, crown: 0 });
    expect(english.voyage.claimed).toMatchObject({ fr: 40, en: 70 });
  });

  it('does nothing when nothing is owed', () => {
    const r = claimBounty(voyage, 'en');
    expect(r.voyage).toBe(voyage);
    expect(r.gold).toBe(0);
  });

  it('promotes at the thresholds and pays the reward, even across several ranks', () => {
    const first = claimBounty(
      { ...voyage, bounty: { pirate: RANK_THRESHOLDS[0]!, crown: 0 } },
      'en',
    );
    expect(first.promotedTo).toBe(rankOf('en', RANK_THRESHOLDS[0]!).title);
    expect(first.promotionGold).toBe(RANK_REWARDS[0]);
    expect(first.voyage.gold).toBe(voyage.gold + RANK_THRESHOLDS[0]! + RANK_REWARDS[0]!);
    const jump = claimBounty(
      { ...voyage, bounty: { pirate: RANK_THRESHOLDS[1]!, crown: 0 } },
      'en',
    );
    expect(jump.promotionGold).toBe(RANK_REWARDS[0]! + RANK_REWARDS[1]!);
    const below = claimBounty(
      { ...voyage, bounty: { pirate: RANK_THRESHOLDS[0]! - 1, crown: 0 } },
      'en',
    );
    expect(below.promotedTo).toBeNull();
    expect(below.promotionGold).toBe(0);
  });

  it('keeps a separate rank for each nation', () => {
    const v = claimBounty({ ...voyage, bounty: { pirate: 600, crown: 0 } }, 'fr').voyage;
    expect(rankIndex(v.claimed.fr)).toBeGreaterThan(0);
    expect(rankIndex(v.claimed.nl)).toBe(0);
  });
});

describe('rank and standing', () => {
  it('names ranks and the next step, and ends at the top', () => {
    expect(rankOf('en', 0).index).toBe(0);
    expect(rankOf('en', 0).next?.atGold).toBe(RANK_THRESHOLDS[0]);
    const top = rankOf('en', 1e9);
    expect(top.index).toBe(RANK_THRESHOLDS.length);
    expect(top.next).toBeNull();
  });

  it('labels standing from hated to honoured', () => {
    expect(standingLabel(-5)).toBe('Hated');
    expect(standingLabel(-1.5)).toBe('Distrusted');
    expect(standingLabel(0)).toBe('Unknown');
    expect(standingLabel(1.5)).toBe('Respected');
    expect(standingLabel(10)).toBe('Honoured');
  });
});
