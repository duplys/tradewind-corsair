// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SHIP_CLASSES } from '../../../src/data/ships';
import { fullCondition, type ShipCondition } from '../../../src/sim/ships/condition';
import {
  affordableRepair,
  fullRepair,
  gunReplacement,
  isEmptyRepair,
  repairHours,
} from '../../../src/sim/ships/repair';

const sloop = SHIP_CLASSES.sloop;
const damaged: ShipCondition = { hullPct: 70, riggingPct: 80, crew: 30, gunsIntact: 6 };

describe('fullRepair', () => {
  it('costs (100 − hull) × strength × 0.4 + (100 − rigging) × strength × 0.25', () => {
    // Sloop, strength 60: 30 × 24 + 20 × 15 = 720 + 300.
    const plan = fullRepair(sloop, damaged);
    expect(plan.costGold).toBe(1020);
    expect(plan.condition).toEqual({ ...damaged, hullPct: 100, riggingPct: 100 });
  });

  it('takes 2 days per 25 points repaired, hull and rigging together', () => {
    expect(fullRepair(sloop, damaged).hours).toBe(96); // 50 points = 4 days
    expect(repairHours(25, 0)).toBe(48);
    expect(repairHours(3, 0)).toBe(6);
    expect(repairHours(0.4, 0)).toBe(1);
    expect(repairHours(0, 0)).toBe(0);
  });

  it('scales the price with hull strength', () => {
    expect(fullRepair(SHIP_CLASSES.galleon, damaged).costGold).toBe(
      Math.round(30 * 220 * 0.4 + 20 * 220 * 0.25),
    );
  });

  it('is empty for a ship in full repair', () => {
    const sound = fullCondition(sloop, 40);
    const plan = fullRepair(sloop, sound);
    expect(plan.costGold).toBe(0);
    expect(plan.hours).toBe(0);
    expect(isEmptyRepair(plan, sound)).toBe(true);
  });
});

describe('affordableRepair', () => {
  it('does the full repair when there is enough gold', () => {
    expect(affordableRepair(sloop, damaged, 5000)).toEqual(fullRepair(sloop, damaged));
  });

  it('repairs the hull first, by whole points', () => {
    const plan = affordableRepair(sloop, damaged, 500); // 24 gold per hull point
    expect(plan.condition.hullPct).toBe(90); // 20 points = 480 gold
    expect(plan.condition.riggingPct).toBe(80);
    expect(plan.costGold).toBe(480);
    expect(plan.hours).toBe(Math.round((20 / 25) * 48));
  });

  it('spends what is left on the rigging', () => {
    const plan = affordableRepair(sloop, damaged, 800); // hull 720, then 80 → 5 rigging points
    expect(plan.condition.hullPct).toBe(100);
    expect(plan.condition.riggingPct).toBe(85);
    expect(plan.costGold).toBe(795);
  });

  it('never costs more than the gold available', () => {
    const odd: ShipCondition = { ...damaged, hullPct: 61.3, riggingPct: 12.7 };
    for (let gold = 0; gold < 4000; gold += 37) {
      expect(affordableRepair(sloop, odd, gold).costGold).toBeLessThanOrEqual(gold);
    }
  });

  it('does nothing without gold', () => {
    expect(isEmptyRepair(affordableRepair(sloop, damaged, 0), damaged)).toBe(true);
  });
});

describe('gunReplacement', () => {
  it('replaces lost guns at 60 gold each, up to the class maximum', () => {
    const plan = gunReplacement(sloop, damaged, 1000);
    expect(plan.condition.gunsIntact).toBe(8);
    expect(plan.costGold).toBe(120);
    expect(plan.hours).toBe(0);
  });

  it('replaces only as many as the gold pays for', () => {
    expect(gunReplacement(sloop, { ...damaged, gunsIntact: 2 }, 150).condition.gunsIntact).toBe(4);
    expect(gunReplacement(sloop, damaged, 59).costGold).toBe(0);
  });
});
