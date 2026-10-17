// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { rumourText } from '../../src/ui/tavernText';

describe('rumourText', () => {
  it('names the goods and ports in a price rumour', () => {
    const text = rumourText({
      kind: 'prices',
      good: 'rum',
      dearPort: 'havana',
      cheapPort: 'nassau',
    });
    expect(text).toContain('Rum');
    expect(text).toContain('Havana');
    expect(text).toContain('Nassau');
  });

  it('says whether two nations are at war or at peace', () => {
    expect(rumourText({ kind: 'war', a: 'es', b: 'en', atWar: true })).toContain('throats');
    expect(rumourText({ kind: 'war', a: 'en', b: 'nl', atWar: false })).toContain('peace');
  });

  it('starts a sentence with a capital for the Dutch Republic', () => {
    const text = rumourText({ kind: 'war', a: 'nl', b: 'es', atWar: false });
    expect(text.startsWith('"The Dutch Republic')).toBe(true);
  });

  it('names the port for pirate and place rumours', () => {
    expect(rumourText({ kind: 'pirates', nearPort: 'tortuga' })).toContain('Tortuga');
    expect(rumourText({ kind: 'place', portId: 'havana' })).toContain('Havana');
  });
});
