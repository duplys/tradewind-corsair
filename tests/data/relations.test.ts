// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { atWar, hostileToPlayer, PLAYER_NATION, type Allegiance } from '../../src/data/relations';

const ALL: Allegiance[] = ['es', 'en', 'fr', 'nl', 'pirate'];

describe('relations in 1660', () => {
  it('puts Spain at war with England and France, and at peace with the Dutch', () => {
    expect(atWar('es', 'en')).toBe(true);
    expect(atWar('es', 'fr')).toBe(true);
    expect(atWar('es', 'nl')).toBe(false);
  });

  it('keeps England, France and the Dutch at peace', () => {
    expect(atWar('en', 'fr')).toBe(false);
    expect(atWar('en', 'nl')).toBe(false);
    expect(atWar('fr', 'nl')).toBe(false);
  });

  it('puts pirates at war with everyone', () => {
    for (const a of ALL) expect(atWar('pirate', a)).toBe(true);
  });

  it('is symmetric, and no nation is at war with itself', () => {
    for (const a of ALL) {
      for (const b of ALL) expect(atWar(a, b), `${a}/${b}`).toBe(atWar(b, a));
      if (a !== 'pirate') expect(atWar(a, a)).toBe(false);
    }
  });

  it('makes Spain and pirates hostile to the English player', () => {
    expect(PLAYER_NATION).toBe('en');
    expect(ALL.filter(hostileToPlayer)).toEqual(['es', 'pirate']);
  });
});
