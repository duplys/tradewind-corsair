// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SHIP_CLASSES } from '../../../src/data/ships';
import { fullCondition } from '../../../src/sim/ships/condition';

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
