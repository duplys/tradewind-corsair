// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SHIP_CLASSES } from '../../../src/data/ships';
import { hullsTouch, insideHull, resolveHit } from '../../../src/sim/combat/hits';
import { createRng } from '../../../src/sim/rng';
import { fullCondition } from '../../../src/sim/ships/condition';

const sloop = SHIP_CLASSES.sloop;
const galleon = SHIP_CLASSES.galleon;

describe('resolveHit', () => {
  it('lands on hull, rigging and crew roughly 55 : 30 : 15', () => {
    const rng = createRng(1);
    const counts = { hull: 0, rigging: 0, crew: 0 };
    for (let i = 0; i < 5000; i++)
      counts[resolveHit(sloop, fullCondition(sloop, 40), rng, false).location]++;
    expect(counts.hull / 5000).toBeCloseTo(0.55, 1);
    expect(counts.rigging / 5000).toBeCloseTo(0.3, 1);
    expect(counts.crew / 5000).toBeCloseTo(0.15, 1);
  });

  it('scales hull and rigging damage by 60 / hull strength', () => {
    const rng = createRng(2);
    for (let i = 0; i < 500; i++) {
      const hit = resolveHit(sloop, fullCondition(sloop, 40), rng, false);
      if (hit.location === 'hull') {
        expect(100 - hit.condition.hullPct).toBeGreaterThanOrEqual(4);
        expect(100 - hit.condition.hullPct).toBeLessThanOrEqual(7);
      }
      if (hit.location === 'rigging') {
        expect(100 - hit.condition.riggingPct).toBeGreaterThanOrEqual(5);
        expect(100 - hit.condition.riggingPct).toBeLessThanOrEqual(9);
      }
      if (hit.location === 'crew') expect([37, 38, 39]).toContain(hit.condition.crew);
    }
    for (let i = 0; i < 500; i++) {
      const hit = resolveHit(galleon, fullCondition(galleon, 200), rng, false);
      if (hit.location === 'hull')
        expect(100 - hit.condition.hullPct).toBeLessThanOrEqual(7 * (60 / 220) + 1e-9);
    }
  });

  it('destroys a gun on about one hull hit in ten', () => {
    const rng = createRng(3);
    let hullHits = 0;
    let gunsLost = 0;
    for (let i = 0; i < 6000; i++) {
      const hit = resolveHit(sloop, fullCondition(sloop, 40), rng, false);
      if (hit.location === 'hull') hullHits++;
      if (hit.gunLost) {
        gunsLost++;
        expect(hit.condition.gunsIntact).toBe(7);
      }
    }
    expect(gunsLost / hullHits).toBeCloseTo(0.1, 1);
  });

  it('never lets low, spent shot hit the rigging', () => {
    const rng = createRng(4);
    for (let i = 0; i < 1000; i++)
      expect(resolveHit(sloop, fullCondition(sloop, 40), rng, true).location).not.toBe('rigging');
  });

  it('clamps everything at 0', () => {
    const rng = createRng(5);
    let c = { hullPct: 1, riggingPct: 1, crew: 1, gunsIntact: 0 };
    for (let i = 0; i < 50; i++) c = resolveHit(sloop, c, rng, false).condition;
    expect(c).toEqual({ hullPct: 0, riggingPct: 0, crew: 0, gunsIntact: 0 });
  });
});

describe('hull shapes', () => {
  const ship = { x: 100, y: 100, headingRad: 0, speedKn: 0, sail: 'full' as const };

  it('tests points against the oriented ellipse', () => {
    expect(insideHull(ship, 22, 8, 110, 100)).toBe(true); // near the bow
    expect(insideHull(ship, 22, 8, 100, 103)).toBe(true); // inside the beam
    expect(insideHull(ship, 22, 8, 100, 105)).toBe(false); // outside the beam
    const turned = { ...ship, headingRad: Math.PI / 2 };
    expect(insideHull(turned, 22, 8, 100, 110)).toBe(true);
    expect(insideHull(turned, 22, 8, 110, 100)).toBe(false);
  });

  it('knows when two hulls touch', () => {
    const hull = (x: number, y: number, h = 0) => ({
      ship: { ...ship, x, y, headingRad: h },
      lengthPx: 22,
      beamPx: 8,
    });
    expect(hullsTouch(hull(100, 100), hull(120, 100))).toBe(true); // bow to stern, overlapping
    expect(hullsTouch(hull(100, 100), hull(123, 100))).toBe(false);
    expect(hullsTouch(hull(100, 100), hull(100, 107))).toBe(true); // side by side
    expect(hullsTouch(hull(100, 100), hull(100, 109))).toBe(false);
    expect(hullsTouch(hull(100, 100), hull(100, 100, Math.PI / 2))).toBe(true); // crossed
  });
});
