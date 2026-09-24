// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { advanceClock, START_ELAPSED_HOURS } from '../../src/sim/time';

describe('game clock', () => {
  it('starts at 08:00 and advances 4 game hours per real second', () => {
    expect(START_ELAPSED_HOURS).toBe(8);
    expect(advanceClock(START_ELAPSED_HOURS, 1)).toBe(12);
    expect(advanceClock(0, 6)).toBe(24);
  });
});
