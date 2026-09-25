// SPDX-License-Identifier: GPL-3.0-only
// The one stepShip drives the player, world-map NPCs and combat ships (slice 2 spec §2).
import { describe, expect, it } from 'vitest';
import { SIM_STEP_SECONDS } from '../../../src/data/constants';
import { WORLD_SAILING_SCALE, type SailingScale } from '../../../src/data/sailing';
import { SHIP_CLASSES } from '../../../src/data/ships';
import {
  stepShip,
  type PlayerShip,
  type SailingShip,
  type ShipInput,
} from '../../../src/sim/sailing/ship';
import type { Wind } from '../../../src/sim/sailing/wind';
import { createWorld } from '../../../src/sim/world/world';

const NO_INPUT: ShipInput = { turnLeft: false, turnRight: false };
const EAST_WIND: Wind = { towardRad: 0, speedKn: 14 };
/** A scale like the combat arena's (spec §6.2); the real one lives in data/combat.ts from M4. */
const ARENA_SCALE: SailingScale = { pxPerSecPerKnot: 2.4, bowProbePx: 0 };
const sloop = SHIP_CLASSES.sloop;

function player(overrides: Partial<PlayerShip> = {}): PlayerShip {
  return { x: 50, y: 50, headingRad: 0, speedKn: 0, sail: 'full', classId: 'sloop', ...overrides };
}

describe('stepShip defaults', () => {
  it('without params equals the player class at world scale, exactly', () => {
    const world = createWorld(400, 100, new Uint8Array(400 * 100));
    let a = player({ headingRad: 0.3, speedKn: 3 });
    let b = a;
    const input = { turnLeft: false, turnRight: true };
    for (let i = 0; i < 120; i++) {
      a = stepShip(a, input, EAST_WIND, world, SIM_STEP_SECONDS).ship;
      b = stepShip(b, input, EAST_WIND, world, SIM_STEP_SECONDS, {
        performance: sloop,
        scale: WORLD_SAILING_SCALE,
      }).ship;
    }
    expect(b).toEqual(a);
  });
});

describe('stepShip with explicit params', () => {
  it('moves at the given scale', () => {
    const s = { x: 0, y: 0, headingRad: 0, speedKn: 5, sail: 'full' as const };
    const noAccel = { ...sloop, accelPerSec: 0 };
    const r = stepShip(s, NO_INPUT, EAST_WIND, null, 1, {
      performance: noAccel,
      scale: ARENA_SCALE,
    });
    expect(r.ship.x).toBeCloseTo(5 * 2.4);
    expect(r.ship.y).toBeCloseTo(0);
  });

  it('with no terrain never shoals, even beyond any map edge', () => {
    let s: SailingShip = { x: -5, y: -5, headingRad: Math.PI, speedKn: 8, sail: 'full' };
    for (let i = 0; i < 60; i++) {
      const r = stepShip(s, NO_INPUT, EAST_WIND, null, SIM_STEP_SECONDS, {
        performance: sloop,
        scale: ARENA_SCALE,
      });
      expect(r.events).toHaveLength(0);
      s = r.ship;
    }
    expect(s.x).toBeLessThan(-5);
  });

  it('scales steady speed with the performance it is given', () => {
    const steady = (maxSpeedKn: number) => {
      let s: SailingShip = { x: 0, y: 0, headingRad: Math.PI / 2, speedKn: 0, sail: 'full' };
      for (let i = 0; i < 60 * 30; i++) {
        s = stepShip(s, NO_INPUT, EAST_WIND, null, SIM_STEP_SECONDS, {
          performance: { ...sloop, maxSpeedKn },
          scale: ARENA_SCALE,
        }).ship;
      }
      return s.speedKn;
    };
    expect(steady(9)).toBeCloseTo(9, 3);
    expect(steady(4.5)).toBeCloseTo(4.5, 3);
  });

  it('turns at the given turn rate', () => {
    const s = { x: 0, y: 0, headingRad: 0, speedKn: 6, sail: 'full' as const };
    const r = stepShip(s, { turnLeft: false, turnRight: true }, EAST_WIND, null, 0.1, {
      performance: { ...sloop, turnRateRadPerSec: 0.8 },
      scale: ARENA_SCALE,
    });
    expect(r.ship.headingRad).toBeCloseTo(0.08);
  });

  it('keeps extra fields of the ship it steps', () => {
    const npcShip = { x: 0, y: 0, headingRad: 0, speedKn: 3, sail: 'half' as const, tag: 'npc-7' };
    const r = stepShip(npcShip, NO_INPUT, EAST_WIND, null, SIM_STEP_SECONDS, {
      performance: sloop,
      scale: ARENA_SCALE,
    });
    expect(r.ship.tag).toBe('npc-7');
    expect(r.ship.sail).toBe('half');
  });
});
