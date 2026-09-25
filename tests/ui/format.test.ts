// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { displayPct, formatDuration, formatGold } from '../../src/ui/format';

describe('formatDuration', () => {
  it('writes days and hours', () => {
    expect(formatDuration(96)).toBe('4 days');
    expect(formatDuration(24)).toBe('1 day');
    expect(formatDuration(30)).toBe('1 day, 6 hours');
    expect(formatDuration(49)).toBe('2 days, 1 hour');
    expect(formatDuration(12)).toBe('12 hours');
    expect(formatDuration(0)).toBe('no time');
  });
});

describe('formatGold and displayPct', () => {
  it('formats gold with separators', () => {
    expect(formatGold(1000)).toBe('1,000');
    expect(formatGold(950)).toBe('950');
  });

  it('shows whole percentages and never 0 while something is left', () => {
    expect(displayPct(100)).toBe(100);
    expect(displayPct(71.9)).toBe(71);
    expect(displayPct(0.4)).toBe(1);
    expect(displayPct(0)).toBe(0);
  });
});
