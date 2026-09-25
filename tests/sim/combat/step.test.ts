// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SIM_STEP_SECONDS } from '../../../src/data/constants';
import { SHIP_CLASSES } from '../../../src/data/ships';
import { createCombat } from '../../../src/sim/combat/state';
import {
  HOLD,
  sideFacing,
  stepCombat,
  surrender,
  type CombatInput,
} from '../../../src/sim/combat/step';
import { createRng } from '../../../src/sim/rng';
import { reloadTimeSec } from '../../../src/sim/ships/condition';
import { beamFight, fireOnce, NORTHERLY, run, side } from './helpers';

describe('createCombat', () => {
  it('starts 220 px apart on the world bearing, keeping headings', () => {
    const s = createCombat({
      player: side('sloop', { headingRad: 0.3 }),
      enemy: side('frigate', { headingRad: -2, role: 'warship' }),
      wind: NORTHERLY,
      rng: createRng(1),
      bearingToEnemyRad: 1,
      escapeFailed: false,
    });
    const [p, e] = s.ships;
    expect(Math.hypot(e.ship.x - p.ship.x, e.ship.y - p.ship.y)).toBeCloseTo(220);
    expect(Math.atan2(e.ship.y - p.ship.y, e.ship.x - p.ship.x)).toBeCloseTo(1);
    expect(p.ship.headingRad).toBe(0.3);
    expect(e.ship.headingRad).toBe(-2);
    expect((p.ship.x + e.ship.x) / 2).toBeCloseTo(360);
    expect((p.ship.y + e.ship.y) / 2).toBeCloseTo(240);
  });

  it('after a failed escape starts 150 px apart with the enemy upwind', () => {
    const s = createCombat({
      player: side('sloop'),
      enemy: side('frigate', { role: 'warship' }),
      wind: NORTHERLY,
      rng: createRng(1),
      bearingToEnemyRad: 0,
      escapeFailed: true,
    });
    const [p, e] = s.ships;
    expect(Math.hypot(e.ship.x - p.ship.x, e.ship.y - p.ship.y)).toBeCloseTo(150);
    expect(e.ship.y).toBeLessThan(p.ship.y); // the wind blows south, so upwind is north
    expect(e.ship.x).toBeCloseTo(p.ship.x);
  });
});

describe('sailing in combat', () => {
  it('moves at 2.4 px per second per knot with the shared physics', () => {
    const s = beamFight();
    s.ships[0].ship = { ...s.ships[0].ship, speedKn: 5, sail: 'full' };
    const x0 = s.ships[0].ship.x;
    stepCombat(s, HOLD, HOLD, SIM_STEP_SECONDS);
    // Beam reach at 14 kn: the speed eases from 5 toward 9 kn.
    const moved = s.ships[0].ship.x - x0;
    expect(moved).toBeGreaterThan(5 * 2.4 * SIM_STEP_SECONDS);
    expect(moved).toBeLessThan(9 * 2.4 * SIM_STEP_SECONDS);
  });

  it('hoists and reefs one step per order', () => {
    const s = beamFight();
    stepCombat(s, { ...HOLD, sail: 1 }, HOLD, SIM_STEP_SECONDS);
    expect(s.ships[0].ship.sail).toBe('half');
    stepCombat(s, { ...HOLD, sail: -1 }, HOLD, SIM_STEP_SECONDS);
    expect(s.ships[0].ship.sail).toBe('furled');
  });
});

describe('broadsides', () => {
  it('picks the side that bears: port when the enemy is to the left', () => {
    const s = beamFight(); // enemy due south of a ship heading east: starboard
    expect(sideFacing(s.ships[0], s.ships[1])).toBe('starboard');
    s.ships[0].ship = { ...s.ships[0].ship, headingRad: Math.PI };
    expect(sideFacing(s.ships[0], s.ships[1])).toBe('port');
  });

  it('ripples the manned guns out one every 60 ms, then reloads', () => {
    const s = beamFight();
    const events = run(s, 1, fireOnce('starboard'));
    const shots = events.filter((e) => e.type === 'shot');
    expect(shots).toHaveLength(4); // sloop, 8 guns and 40 crew: 4 per side
    expect(s.ships[0].reloadSec.starboard).toBeGreaterThan(reloadTimeSec(s.ships[0].condition) - 1);
    expect(s.ships[0].reloadSec.port).toBe(0);
  });

  it('refuses to fire a side that is still reloading', () => {
    const s = beamFight();
    run(s, 0.5, fireOnce('starboard'));
    const events = run(s, 0.1, fireOnce('starboard'));
    expect(events.filter((e) => e.type === 'shot')).toHaveLength(0);
    expect(events).toContainEqual({ type: 'notReady', ship: 0, side: 'starboard' });
  });

  it('fires balls across the beam that hit a ship lying there, and never the firer', () => {
    const s = beamFight('sloop', 'sloop', 7, {});
    s.ships[1].ship = { ...s.ships[1].ship, y: s.ships[0].ship.y + 60 };
    const events = run(s, 3, fireOnce('starboard'));
    const hits = events.filter((e) => e.type === 'hit');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.type === 'hit' && h.ship === 1)).toBe(true);
    expect(s.balls.count()).toBe(0);
  });

  it('splashes balls after 150 px, with each ball hitting at most once', () => {
    const s = beamFight();
    s.ships[1].ship = { ...s.ships[1].ship, x: 50, y: 50 }; // well out of the line of fire
    const events = run(s, 3, fireOnce('port'));
    const splashes = events.filter((e) => e.type === 'splash');
    expect(splashes).toHaveLength(4);
    for (const splash of splashes) {
      if (splash.type !== 'splash') continue;
      const d = Math.hypot(splash.x - s.ships[0].ship.x, splash.y - s.ships[0].ship.y);
      expect(d).toBeGreaterThan(130);
      expect(d).toBeLessThan(170);
    }
  });

  it('cannot fire with nobody at the guns', () => {
    const s = beamFight();
    s.ships[0].condition = { ...s.ships[0].condition, crew: 3 };
    const events = run(s, 0.2, fireOnce('starboard'));
    expect(events.filter((e) => e.type === 'shot')).toHaveLength(0);
  });
});

describe('end conditions', () => {
  const pounding = (): ((t: number) => CombatInput) => () => ({ ...HOLD, fire: 'bearing' });

  it('sinks a ship at 0 % hull after 3 seconds', () => {
    const s = beamFight();
    s.ships[1].ship = { ...s.ships[1].ship, y: s.ships[0].ship.y + 60 };
    s.ships[1].condition = { ...s.ships[1].condition, hullPct: 0.5, crew: 40 };
    const events = run(s, 30, pounding());
    const sinking = events.findIndex((e) => e.type === 'sinking');
    expect(sinking).toBeGreaterThanOrEqual(0);
    expect(s.outcome).toEqual({ type: 'sunk', shipIndex: 1 });
  });

  it('makes the enemy strike when its crew falls below a quarter', () => {
    const s = beamFight();
    s.ships[1].condition = { ...s.ships[1].condition, crew: 9 };
    const events = run(s, 0.1);
    expect(events).toContainEqual({ type: 'struck', ship: 1 });
    expect(s.ships[1].ship.sail).toBe('furled');
  });

  it('makes a battered enemy strike when heavily outnumbered', () => {
    const s = beamFight('sloop', 'sloop', 1);
    s.ships[1].condition = { ...s.ships[1].condition, hullPct: 19, crew: 26 };
    s.ships[0].condition = { ...s.ships[0].condition, crew: 40 };
    run(s, 0.1);
    expect(s.ships[1].struck).toBe(true);
    const fair = beamFight('sloop', 'sloop', 1);
    fair.ships[1].condition = { ...fair.ships[1].condition, hullPct: 19, crew: 27 };
    run(fair, 0.1);
    expect(fair.ships[1].struck).toBe(false);
  });

  it('makes traders strike below 40 % hull', () => {
    const s = beamFight('sloop', 'fluyt', 1, { role: 'trader' });
    s.ships[1].condition = { ...s.ships[1].condition, hullPct: 39 };
    run(s, 0.1);
    expect(s.ships[1].struck).toBe(true);
  });

  it('never makes the player strike', () => {
    const s = beamFight();
    s.ships[0].condition = { ...s.ships[0].condition, crew: 2, hullPct: 5 };
    run(s, 0.1);
    expect(s.ships[0].struck).toBe(false);
  });

  it('captures a struck enemy when the player comes alongside', () => {
    const s = beamFight();
    s.ships[1].struck = true;
    s.ships[1].ship = { ...s.ships[1].ship, sail: 'furled', y: s.ships[0].ship.y + 6 };
    run(s, 0.1);
    expect(s.outcome).toEqual({ type: 'captured' });
  });

  it('boards when the hulls meet slowly, before the enemy has struck', () => {
    const s = beamFight();
    s.ships[1].ship = { ...s.ships[1].ship, y: s.ships[0].ship.y + 6 };
    run(s, 0.1);
    expect(s.outcome).toEqual({ type: 'boarding' });
  });

  it('keeps fast ships apart, but boards after 1.5 s of contact', () => {
    const s = beamFight();
    s.ships[0].ship = { ...s.ships[0].ship, speedKn: 9, sail: 'full' };
    s.ships[1].ship = {
      ...s.ships[1].ship,
      x: s.ships[0].ship.x + 30,
      y: s.ships[0].ship.y,
      headingRad: Math.PI,
      speedKn: 9,
      sail: 'full',
    };
    for (let i = 0; i < 60 && !s.outcome; i++) {
      stepCombat(s, HOLD, HOLD, SIM_STEP_SECONDS);
      // They must never pass through each other.
      expect(s.ships[1].ship.x).toBeGreaterThan(s.ships[0].ship.x);
    }
    const t = s.timeSec;
    run(s, 3);
    expect(s.outcome?.type).toBe('boarding');
    expect(s.timeSec - t).toBeLessThanOrEqual(1.6);
  });

  it('ends the fight when a ship crosses the arena edge', () => {
    const s = beamFight();
    s.ships[1].ship = { ...s.ships[1].ship, x: 719.9, speedKn: 8, sail: 'full' };
    run(s, 2);
    expect(s.outcome).toEqual({ type: 'escaped', shipIndex: 1 });
  });

  it('lets the player surrender', () => {
    const s = beamFight();
    surrender(s);
    expect(s.outcome).toEqual({ type: 'surrendered' });
    expect(stepCombat(s, HOLD, HOLD, SIM_STEP_SECONDS)).toHaveLength(0);
  });
});

describe('determinism', () => {
  it('gives the same fight for the same seed and the same inputs', () => {
    const script = (t: number): CombatInput => ({
      turnLeft: t % 7 < 2,
      turnRight: t % 11 > 9,
      sail: t < 0.02 ? 1 : 0,
      fire: Math.floor(t * 3) % 5 === 0 ? 'bearing' : null,
    });
    const fight = () => {
      const s = beamFight('brigantine', 'sloop', 42);
      s.ships[1].ship = { ...s.ships[1].ship, y: s.ships[0].ship.y + 70 };
      const events = run(s, 40, script);
      return {
        outcome: s.outcome,
        ships: s.ships.map((sh) => ({ ship: sh.ship, condition: sh.condition })),
        events: events.length,
      };
    };
    const a = fight();
    expect(fight()).toEqual(a);
    expect(a.events).toBeGreaterThan(10);
  });

  it('gives a different fight for a different seed', () => {
    const volley = (seed: number) => {
      const s = beamFight('sloop', 'sloop', seed);
      s.ships[1].ship = { ...s.ships[1].ship, y: s.ships[0].ship.y + 60 };
      run(s, 5, () => ({ ...HOLD, fire: 'bearing' }));
      return s.ships[1].condition;
    };
    expect(volley(1)).not.toEqual(volley(2));
  });

  it('uses the class stats from the data', () => {
    const s = beamFight('galleon', 'sloop');
    const events = run(s, 2, fireOnce('starboard'));
    expect(events.filter((e) => e.type === 'shot')).toHaveLength(SHIP_CLASSES.galleon.guns / 2);
  });
});
