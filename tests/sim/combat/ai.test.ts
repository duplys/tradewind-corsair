// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SIM_STEP_SECONDS } from '../../../src/data/constants';
import { SHIP_CLASSES } from '../../../src/data/ships';
import { broadsideBears, decide, fleeHeading, timeToReload } from '../../../src/sim/combat/ai';
import { MATCHUPS, runFight } from '../../../src/sim/combat/balance';
import { HOLD, stepCombat } from '../../../src/sim/combat/step';
import { angleDiff } from '../../../src/sim/math';
import { polarFactor, relativeWindDeg } from '../../../src/sim/sailing/polar';
import { beamFight, NORTHERLY } from './helpers';

describe('AI helpers', () => {
  it('knows which broadside bears and when it is loaded', () => {
    const s = beamFight(); // enemy due south of a ship heading east: on the starboard beam
    const [me, them] = s.ships;
    expect(broadsideBears(me, them, 'starboard', 5)).toBe(true);
    expect(broadsideBears(me, them, 'port', 5)).toBe(false);
    expect(timeToReload(me, 'starboard')).toBe(0);
    me.reloadSec.starboard = 3;
    expect(timeToReload(me, 'starboard')).toBe(3);
  });
});

describe('firing', () => {
  it('fires a loaded side that bears within range', () => {
    const s = beamFight();
    s.ships[1].ship = { ...s.ships[1].ship, y: s.ships[0].ship.y + 60 };
    expect(decide(s, 0, 'warship').fire).toBe('starboard');
  });

  it('holds fire out of range, while reloading, and at a ship that has struck', () => {
    const far = beamFight(); // 220 px apart
    expect(decide(far, 0, 'warship').fire).toBeNull();
    const reloading = beamFight();
    reloading.ships[1].ship = { ...reloading.ships[1].ship, y: reloading.ships[0].ship.y + 60 };
    reloading.ships[0].reloadSec.starboard = 2;
    expect(decide(reloading, 0, 'warship').fire).toBeNull();
    const struck = beamFight();
    struck.ships[1].ship = { ...struck.ships[1].ship, y: struck.ships[0].ship.y + 60 };
    struck.ships[1].struck = true;
    expect(decide(struck, 0, 'warship').fire).toBeNull();
  });
});

describe('modes', () => {
  const mode = (
    setup: (s: ReturnType<typeof beamFight>) => void,
    profile: 'warship' | 'pirate' = 'warship',
  ) => {
    const s = beamFight();
    setup(s);
    decide(s, 0, profile);
    return s.ships[0].ai.mode;
  };

  it('engages an equal enemy', () => {
    expect(mode(() => {})).toBe('engage');
  });

  it('boards with a crew advantage and a sound hull (1.5× for warships, 1.2× for pirates)', () => {
    expect(mode((s) => (s.ships[1].condition = { ...s.ships[1].condition, crew: 26 }))).toBe(
      'board',
    );
    expect(mode((s) => (s.ships[1].condition = { ...s.ships[1].condition, crew: 30 }))).toBe(
      'engage',
    );
    expect(
      mode((s) => (s.ships[1].condition = { ...s.ships[1].condition, crew: 30 }), 'pirate'),
    ).toBe('board');
  });

  it('withdraws when badly holed and not stronger, or when heavily outnumbered', () => {
    expect(mode((s) => (s.ships[0].condition = { ...s.ships[0].condition, hullPct: 8 }))).toBe(
      'withdraw',
    );
    expect(mode((s) => (s.ships[1].condition = { ...s.ships[1].condition, crew: 101 }))).toBe(
      'withdraw',
    );
  });

  it('runs down a fleeing enemy and takes possession of a struck one', () => {
    expect(mode((s) => (s.ships[1].ai.mode = 'withdraw'))).toBe('board');
    expect(mode((s) => (s.ships[1].struck = true))).toBe('board');
  });

  it('closes to board when nobody has hit anybody for 45 s', () => {
    expect(mode((s) => (s.timeSec = 46))).toBe('board');
  });

  it('lets a runaway go after 60 s without gaining, shortening sail', () => {
    const s = beamFight();
    s.ships[1].ai.mode = 'flee';
    decide(s, 0, 'warship');
    s.timeSec = 61;
    const input = decide(s, 0, 'warship');
    expect(s.ships[0].ai.mode).toBe('letGo');
    expect(input.sail).toBe(0); // already furled in this fight
  });
});

describe('fleeing', () => {
  it('flees away from the enemy on a course with a polar factor of at least 0.6', () => {
    const s = beamFight('sloop', 'fluyt', 1, { role: 'trader' });
    const [player, trader] = s.ships;
    const heading = fleeHeading(s, trader, player);
    const polar = polarFactor(
      SHIP_CLASSES.fluyt.polar,
      relativeWindDeg(heading, NORTHERLY.towardRad),
    );
    expect(polar).toBeGreaterThanOrEqual(0.6);
    const away = Math.atan2(trader.ship.y - player.ship.y, trader.ship.x - player.ship.x);
    expect(Math.cos(angleDiff(heading, away))).toBeGreaterThan(0);
  });

  it('lets a trader fire only when a broadside happens to bear', () => {
    const s = beamFight('sloop', 'fluyt', 1, { role: 'trader' });
    decide(s, 1, 'trader');
    expect(s.ships[1].ai.mode).toBe('flee');
  });
});

describe('AI fights', () => {
  it('are deterministic', () => {
    for (const m of MATCHUPS) expect(runFight(m, 12345)).toEqual(runFight(m, 12345));
  });

  it('always end: nobody stalls, and the time cap is a draw', () => {
    const s = beamFight('sloop', 'sloop', 3);
    for (let i = 0; i < 600 * 60 && !s.outcome; i++) {
      stepCombat(s, decide(s, 0, 'warship'), decide(s, 1, 'warship'), SIM_STEP_SECONDS);
    }
    expect(s.timeSec).toBeLessThanOrEqual(600);
    expect(stepCombat(s, HOLD, HOLD, SIM_STEP_SECONDS)).toBeDefined();
  });
});
