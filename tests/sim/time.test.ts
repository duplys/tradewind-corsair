// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { STRINGS } from '../../src/data/strings';
import { advanceClock, formatDate, START_ELAPSED_HOURS } from '../../src/sim/time';

const fmt = (hours: number) => formatDate(hours, STRINGS.months);
const DAY = 24;

describe('game clock', () => {
  it('starts at 08:00 and advances 4 game hours per real second', () => {
    expect(START_ELAPSED_HOURS).toBe(8);
    expect(advanceClock(START_ELAPSED_HOURS, 1)).toBe(12);
    expect(advanceClock(0, 6)).toBe(24);
  });
});

describe('formatDate', () => {
  it('formats the start date', () => {
    expect(fmt(START_ELAPSED_HOURS)).toBe('1 March 1660');
  });

  it('rolls over days at midnight', () => {
    expect(fmt(23.99)).toBe('1 March 1660');
    expect(fmt(24)).toBe('2 March 1660');
  });

  it('rolls over months and years', () => {
    expect(fmt(30 * DAY)).toBe('31 March 1660');
    expect(fmt(31 * DAY)).toBe('1 April 1660');
    expect(fmt(306 * DAY)).toBe('1 January 1661');
  });

  it('knows 1661 is not a leap year', () => {
    // 1 March 1660 + 364 days = 28 February 1661; one more day is 1 March.
    expect(fmt(364 * DAY)).toBe('28 February 1661');
    expect(fmt(365 * DAY)).toBe('1 March 1661');
  });
});
