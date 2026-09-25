// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { HINT_FIRST_DELAY_SEC, HINT_INTERVAL_SEC } from '../../src/data/voyage';
import { hintDue } from '../../src/game/hints';

describe('hintDue', () => {
  it('shows the first hint shortly after the start', () => {
    expect(hintDue(0, HINT_FIRST_DELAY_SEC - 0.01, 3)).toBe(false);
    expect(hintDue(0, HINT_FIRST_DELAY_SEC, 3)).toBe(true);
  });

  it('spaces later hints 5 s apart', () => {
    expect(HINT_INTERVAL_SEC).toBe(5);
    expect(hintDue(1, 4.99, 3)).toBe(false);
    expect(hintDue(1, 5, 3)).toBe(true);
    expect(hintDue(2, 5, 3)).toBe(true);
  });

  it('stops once every hint has been shown', () => {
    expect(hintDue(3, 100, 3)).toBe(false);
  });
});
