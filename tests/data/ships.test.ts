// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SHIP_CLASS_IDS, SHIP_CLASSES } from '../../src/data/ships';
import { SHIP_SPRITE_SIZE } from '../../src/render/sprites/ship';
import { polarFactor } from '../../src/sim/sailing/polar';

describe('ship classes', () => {
  it('has the five classes of slice 2', () => {
    expect(SHIP_CLASS_IDS).toEqual(['sloop', 'brigantine', 'fluyt', 'frigate', 'galleon']);
    for (const id of SHIP_CLASS_IDS) expect(SHIP_CLASSES[id].id).toBe(id);
  });

  it('has consistent numbers', () => {
    for (const cls of Object.values(SHIP_CLASSES)) {
      expect(cls.guns % 2, cls.id).toBe(0);
      expect(cls.crewTypical, cls.id).toBeLessThanOrEqual(cls.crewMax);
      expect(cls.accelPerSec, cls.id).toBeGreaterThan(0);
      // The world sprite plus its 1-px outline fits the sprite canvas.
      expect(cls.worldLengthPx + 2, cls.id).toBeLessThanOrEqual(SHIP_SPRITE_SIZE);
    }
  });

  it('has polars from dead downwind (0°) to head to wind (180°)', () => {
    for (const cls of Object.values(SHIP_CLASSES)) {
      const degs = cls.polar.map(([deg]) => deg);
      expect(degs[0], cls.id).toBe(0);
      expect(degs.at(-1), cls.id).toBe(180);
      for (let i = 1; i < degs.length; i++) expect(degs[i]!).toBeGreaterThan(degs[i - 1]!);
      for (const [, factor] of cls.polar) {
        expect(factor).toBeGreaterThan(0);
        expect(factor).toBeLessThanOrEqual(1);
      }
    }
  });

  it('makes the sloop the only ship that points well upwind', () => {
    for (const deg of [120, 135, 150]) {
      const sloop = polarFactor(SHIP_CLASSES.sloop.polar, deg);
      for (const cls of Object.values(SHIP_CLASSES)) {
        if (cls.id === 'sloop') continue;
        expect(sloop, `${cls.id} at ${deg}°`).toBeGreaterThan(polarFactor(cls.polar, deg));
      }
    }
  });
});
