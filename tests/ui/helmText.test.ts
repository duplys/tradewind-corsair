// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import type { PlayerShip } from '../../src/sim/sailing/ship';
import { helmLines } from '../../src/ui/helmText';

const ship: PlayerShip = {
  x: 0,
  y: 0,
  headingRad: Math.PI,
  speedKn: 7.44,
  sail: 'full',
  classId: 'sloop',
};

describe('helmLines', () => {
  it('formats course, speed, point of sail, wind and sail', () => {
    // Wind blowing toward the south comes from the north: heading west is a beam reach.
    expect(helmLines(ship, { towardRad: Math.PI / 2, speedKn: 14.4 })).toEqual([
      'Course 270° W',
      '7.4 kn · Beam reach',
      'Wind N 14 kn',
      'Full sail',
    ]);
  });

  it('pads the course and names the trade wind', () => {
    const north = { ...ship, headingRad: -Math.PI / 2 + 0.1, sail: 'furled' as const };
    const lines = helmLines(north, { towardRad: Math.PI - 0.35, speedKn: 12 });
    expect(lines[0]).toBe('Course 006° N');
    expect(lines[2]).toBe('Wind ENE 12 kn');
    expect(lines[3]).toBe('Sail furled');
  });
});
