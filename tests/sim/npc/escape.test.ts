// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SHIP_CLASSES } from '../../../src/data/ships';
import { escapeChance, speedMadeGoodKn } from '../../../src/sim/npc/escape';
import type { Wind } from '../../../src/sim/sailing/wind';
import { fullCondition } from '../../../src/sim/ships/condition';

/** Blowing toward the west: east is upwind. */
const EASTERLY: Wind = { towardRad: Math.PI, speedKn: 14 };
const sloop = { cls: SHIP_CLASSES.sloop, condition: fullCondition(SHIP_CLASSES.sloop, 40) };
const frigate = { cls: SHIP_CLASSES.frigate, condition: fullCondition(SHIP_CLASSES.frigate, 150) };

describe('speedMadeGoodKn', () => {
  it('equals the best straight-line speed when the bearing is a good point of sail', () => {
    // Due south with an easterly is a beam reach: factor 1.0 at 9 kn.
    expect(speedMadeGoodKn(sloop.cls, sloop.condition, EASTERLY, Math.PI / 2)).toBeCloseTo(9, 5);
  });

  it('beats upwind at an angle, so the sloop out-points the frigate', () => {
    const sloopUp = speedMadeGoodKn(sloop.cls, sloop.condition, EASTERLY, 0);
    const frigateUp = speedMadeGoodKn(frigate.cls, frigate.condition, EASTERLY, 0);
    expect(sloopUp).toBeGreaterThan(3);
    expect(sloopUp).toBeLessThan(9);
    expect(sloopUp).toBeGreaterThan(frigateUp + 1);
  });

  it('is slower for a damaged ship', () => {
    const battered = { ...sloop.condition, riggingPct: 30 };
    expect(speedMadeGoodKn(sloop.cls, battered, EASTERLY, Math.PI / 2)).toBeLessThan(9 * 0.6);
  });
});

describe('escapeChance', () => {
  it('usually lets a sloop escape a frigate by running upwind', () => {
    // The frigate is downwind (west) of the sloop, so the sloop runs east, into the wind.
    const p = escapeChance(
      { ...sloop, at: { x: 100, y: 0 } },
      { ...frigate, at: { x: 0, y: 0 } },
      EASTERLY,
    );
    expect(p).toBeGreaterThan(0.6);
  });

  it('makes running downwind from a frigate a poor bet', () => {
    const p = escapeChance(
      { ...sloop, at: { x: 0, y: 0 } },
      { ...frigate, at: { x: 100, y: 0 } },
      EASTERLY,
    );
    expect(p).toBeLessThan(0.5);
  });

  it('is 0.5 for identical ships and stays within 0.1–0.9', () => {
    expect(
      escapeChance({ ...sloop, at: { x: 0, y: 0 } }, { ...sloop, at: { x: 50, y: 30 } }, EASTERLY),
    ).toBeCloseTo(0.5);
    const hopeless = { ...sloop, condition: { ...sloop.condition, riggingPct: 0, crew: 1 } };
    expect(
      escapeChance(
        { ...hopeless, at: { x: 0, y: 0 } },
        { ...sloop, at: { x: 50, y: 0 } },
        EASTERLY,
      ),
    ).toBe(0.1);
    expect(
      escapeChance(
        { ...sloop, at: { x: 0, y: 0 } },
        { ...hopeless, at: { x: 50, y: 0 } },
        EASTERLY,
      ),
    ).toBe(0.9);
  });
});
