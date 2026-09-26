// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { edgePointer } from '../../src/render/combatScene';
import { crewShown, reloadFraction, yards } from '../../src/ui/combatText';

describe('combat HUD helpers', () => {
  it('estimates the enemy crew to the nearest 10 beyond 100 px, exactly within', () => {
    expect(crewShown(147, 180)).toEqual({ crew: 150, estimate: true });
    expect(crewShown(18, 101)).toEqual({ crew: 20, estimate: true });
    expect(crewShown(147, 100)).toEqual({ crew: 147, estimate: false });
  });

  it('fills the reload bar as the guns reload', () => {
    expect(reloadFraction(0, 6)).toBe(1);
    expect(reloadFraction(6, 6)).toBe(0);
    expect(reloadFraction(1.5, 6)).toBeCloseTo(0.75);
    expect(reloadFraction(9, 6)).toBe(0);
  });

  it('shows combat px as yards', () => {
    expect(yards(40)).toBe(120);
  });
});

describe('edgePointer', () => {
  it('puts the arrow where the line to the enemy leaves the screen, inset by the margin', () => {
    const p = edgePointer(200, 100, 100, 50, 300, 0, 6); // enemy far to the east
    expect(p.x).toBeCloseTo(194);
    expect(p.y).toBeCloseTo(50);
    expect(p.angleRad).toBeCloseTo(0);
    const q = edgePointer(200, 100, 100, 50, -100, -100, 6); // north-west: the top edge first
    expect(q.y).toBeCloseTo(6);
    expect(q.x).toBeCloseTo(56);
  });
});
