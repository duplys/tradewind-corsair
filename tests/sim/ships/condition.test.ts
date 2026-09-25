// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SHIP_CLASSES } from '../../../src/data/ships';
import {
  crewSailFactor,
  damageCondition,
  effectiveMaxSpeedKn,
  effectiveTurnRateRadPerSec,
  fullCondition,
  gunsMannedPerBroadside,
  performanceOf,
  reloadTimeSec,
  type ShipCondition,
} from '../../../src/sim/ships/condition';

const sloop = SHIP_CLASSES.sloop;
const full = (crew = 40): ShipCondition => fullCondition(sloop, crew);

describe('fullCondition', () => {
  it('is fully repaired with every gun and the given crew', () => {
    expect(fullCondition(SHIP_CLASSES.sloop, 40)).toEqual({
      hullPct: 100,
      riggingPct: 100,
      crew: 40,
      gunsIntact: 8,
    });
  });
});

describe('speed and turning', () => {
  it('leaves a sound, manned ship at its class values', () => {
    expect(effectiveMaxSpeedKn(sloop, full())).toBe(9);
    expect(effectiveTurnRateRadPerSec(sloop, full())).toBe(1.6);
    expect(performanceOf(sloop, full())).toEqual({
      maxSpeedKn: sloop.maxSpeedKn,
      turnRateRadPerSec: sloop.turnRateRadPerSec,
      accelPerSec: sloop.accelPerSec,
      polar: sloop.polar,
    });
  });

  it('slows with rigging damage: 0.4 + 0.6 × rigging', () => {
    expect(effectiveMaxSpeedKn(sloop, { ...full(), riggingPct: 50 })).toBeCloseTo(9 * 0.7);
    expect(effectiveMaxSpeedKn(sloop, { ...full(), riggingPct: 0 })).toBeCloseTo(9 * 0.4);
  });

  it('needs a quarter of the typical crew to handle the sails', () => {
    // Sloop: typical 40, so 10 hands give full speed and fewer slow her.
    expect(crewSailFactor(sloop, full(10))).toBe(1);
    expect(crewSailFactor(sloop, full(60))).toBe(1);
    expect(crewSailFactor(sloop, full(5))).toBeCloseTo(0.5);
    expect(crewSailFactor(sloop, full(1))).toBe(0.3);
    expect(crewSailFactor(sloop, full(0))).toBe(0.3);
    expect(effectiveMaxSpeedKn(sloop, { ...full(5), riggingPct: 50 })).toBeCloseTo(9 * 0.7 * 0.5);
  });

  it('turns slower with rigging damage: 0.6 + 0.4 × rigging', () => {
    expect(effectiveTurnRateRadPerSec(sloop, { ...full(), riggingPct: 0 })).toBeCloseTo(0.96);
    expect(effectiveTurnRateRadPerSec(sloop, { ...full(), riggingPct: 50 })).toBeCloseTo(1.28);
  });

  it('ignores hull damage and lost guns for sailing', () => {
    const battered = { ...full(), hullPct: 10, gunsIntact: 2 };
    expect(effectiveMaxSpeedKn(sloop, battered)).toBe(9);
    expect(effectiveTurnRateRadPerSec(sloop, battered)).toBe(1.6);
  });
});

describe('gunnery', () => {
  it('mans half the guns per broadside when there are enough hands', () => {
    expect(gunsMannedPerBroadside(full(40))).toBe(4);
    expect(gunsMannedPerBroadside(fullCondition(SHIP_CLASSES.galleon, 200))).toBe(18);
  });

  it('is limited by crew: four hands per gun, each side manned from half the crew', () => {
    expect(gunsMannedPerBroadside(full(16))).toBe(2);
    expect(gunsMannedPerBroadside(full(12))).toBe(1);
    expect(gunsMannedPerBroadside(full(7))).toBe(0);
    expect(gunsMannedPerBroadside(full(0))).toBe(0);
  });

  it('rounds down with an odd number of guns', () => {
    expect(gunsMannedPerBroadside({ ...full(40), gunsIntact: 7 })).toBe(3);
    expect(gunsMannedPerBroadside({ ...full(40), gunsIntact: 0 })).toBe(0);
  });

  it('reloads in 6 s when fully manned and slower when short-handed, capped at 20 s', () => {
    expect(reloadTimeSec(full(40))).toBe(6);
    expect(reloadTimeSec(full(32))).toBe(6);
    expect(reloadTimeSec(full(16))).toBe(12);
    expect(reloadTimeSec(full(4))).toBe(20);
    expect(reloadTimeSec(full(0))).toBe(20);
    expect(reloadTimeSec({ ...full(0), gunsIntact: 0 })).toBe(6);
  });
});

describe('damageCondition', () => {
  it('subtracts losses and clamps every value at 0', () => {
    expect(damageCondition(full(), { hullPct: 12, riggingPct: 5, crew: 3, guns: 1 })).toEqual({
      hullPct: 88,
      riggingPct: 95,
      crew: 37,
      gunsIntact: 7,
    });
    expect(damageCondition(full(2), { hullPct: 150, riggingPct: 101, crew: 5, guns: 9 })).toEqual({
      hullPct: 0,
      riggingPct: 0,
      crew: 0,
      gunsIntact: 0,
    });
    expect(damageCondition(full(), {})).toEqual(full());
  });
});
