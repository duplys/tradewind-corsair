// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import {
  aShip,
  describeShip,
  relationLine,
  strengthHint,
  theShip,
} from '../../src/ui/encounterText';
import { makeNpc } from '../sim/npc/helpers';

const fluyt = makeNpc({ classId: 'fluyt', nation: 'es', role: 'trader', name: 'San Telmo' });

describe('encounter phrasing', () => {
  it('names ships in period style', () => {
    expect(theShip(fluyt)).toBe('the Spanish fluyt');
    expect(aShip(makeNpc({ classId: 'frigate', nation: 'es', role: 'warship' }))).toBe(
      'A Spanish frigate',
    );
    expect(aShip(makeNpc({ classId: 'sloop', nation: 'en' }))).toBe('An English sloop');
    expect(theShip(makeNpc({ classId: 'brigantine', nation: 'pirate', role: 'pirate' }))).toBe(
      'the pirate brigantine',
    );
  });

  it('describes the ship with her name set apart', () => {
    expect(describeShip(fluyt)).toEqual({
      before: 'The Spanish merchantman ',
      name: 'San Telmo',
      after: ', fluyt, 10 guns.',
    });
    const pirate = makeNpc({
      classId: 'brigantine',
      nation: 'pirate',
      role: 'pirate',
      name: 'Black Gull',
    });
    expect(describeShip(pirate).before).toBe('The pirate ');
  });

  it('hints at strength from the crews', () => {
    expect(strengthHint(61, 40)).toBe('She looks heavily crewed.');
    expect(strengthHint(60, 40)).toBeNull();
    expect(strengthHint(23, 40)).toBe('She looks undermanned.');
    expect(strengthHint(24, 40)).toBeNull();
  });

  it("states the relation from England's side", () => {
    expect(relationLine(fluyt)).toBe('Spain is at war with England.');
    expect(relationLine(makeNpc({ nation: 'nl' }))).toBe(
      'The Dutch Republic is at peace with England.',
    );
    expect(relationLine(makeNpc({ nation: 'pirate', role: 'pirate' }))).toBe(
      'Pirates are at war with everyone.',
    );
  });
});
