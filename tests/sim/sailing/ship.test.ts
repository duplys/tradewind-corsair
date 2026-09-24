// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SIM_STEP_SECONDS } from '../../../src/data/constants';
import {
  changeSail,
  stepShip,
  type PlayerShip,
  type ShipInput,
} from '../../../src/sim/sailing/ship';
import type { Wind } from '../../../src/sim/sailing/wind';
import { fillPolygon } from '../../../src/sim/world/rasterise';
import { createWorld, isLand, type World } from '../../../src/sim/world/world';

const NO_INPUT: ShipInput = { turnLeft: false, turnRight: false };
/** Wind blowing toward the east at the reference strength. */
const EAST_WIND: Wind = { towardRad: 0, speedKn: 14 };

function openWorld(w = 800, h = 200): World {
  return createWorld(w, h, new Uint8Array(w * h));
}

function ship(overrides: Partial<PlayerShip> = {}): PlayerShip {
  return { x: 20, y: 100, headingRad: 0, speedKn: 0, sail: 'full', classId: 'sloop', ...overrides };
}

/** Steady-state speed on a heading relative to an east wind, re-centring to stay in open water. */
function steadySpeed(relRad: number, sail: PlayerShip['sail'] = 'full'): number {
  const world = openWorld(200, 200);
  let s = ship({ x: 100, y: 100, headingRad: relRad, sail });
  for (let i = 0; i < 60 * 30; i++) {
    s = { ...stepShip(s, NO_INPUT, EAST_WIND, world, SIM_STEP_SECONDS).ship, x: 100, y: 100 };
  }
  return s.speedKn;
}

describe('stepShip speed', () => {
  it('running downwind at full sail in 14 kn converges to 9 · 0.72 kn', () => {
    expect(steadySpeed(0)).toBeCloseTo(9 * 0.72, 3);
  });

  it('decelerates to about 0 with the sail furled', () => {
    const world = openWorld();
    let s = ship({ speedKn: 8, sail: 'furled' });
    for (let i = 0; i < 60 * 15; i++)
      s = stepShip(s, NO_INPUT, EAST_WIND, world, SIM_STEP_SECONDS).ship;
    expect(s.speedKn).toBeLessThan(0.01);
  });

  it('orders beam reach > running > close-hauled > in irons', () => {
    const deg = (d: number) => (d * Math.PI) / 180;
    const beam = steadySpeed(deg(90));
    const running = steadySpeed(deg(0));
    // 135° is inside the close-hauled band; at 120° the table (0.86) would beat running (0.72).
    const closeHauled = steadySpeed(deg(135));
    const irons = steadySpeed(deg(170));
    expect(beam).toBeGreaterThan(running);
    expect(running).toBeGreaterThan(closeHauled);
    expect(closeHauled).toBeGreaterThan(irons);
  });

  it('half sail is slower than full sail', () => {
    expect(steadySpeed(Math.PI / 2, 'half')).toBeLessThan(steadySpeed(Math.PI / 2, 'full'));
  });
});

describe('stepShip steering', () => {
  it('turning left decreases the heading, right increases it', () => {
    const world = openWorld();
    const left = stepShip(ship(), { turnLeft: true, turnRight: false }, EAST_WIND, world, 0.1);
    const right = stepShip(ship(), { turnLeft: false, turnRight: true }, EAST_WIND, world, 0.1);
    expect(left.ship.headingRad).toBeLessThan(0);
    expect(right.ship.headingRad).toBeGreaterThan(0);
  });

  it('turns slower when stopped than at full way', () => {
    const world = openWorld();
    const input = { turnLeft: false, turnRight: true };
    const stopped = stepShip(ship({ speedKn: 0 }), input, EAST_WIND, world, 0.1).ship.headingRad;
    const moving = stepShip(ship({ speedKn: 6 }), input, EAST_WIND, world, 0.1).ship.headingRad;
    expect(stopped).toBeCloseTo(1.6 * 0.4 * 0.1);
    expect(moving).toBeCloseTo(1.6 * 0.1);
  });

  it('keeps the heading normalised across the seam', () => {
    const world = openWorld();
    const s = stepShip(
      ship({ headingRad: Math.PI - 0.01, speedKn: 6 }),
      { turnLeft: false, turnRight: true },
      EAST_WIND,
      world,
      0.1,
    );
    expect(s.ship.headingRad).toBeLessThan(0);
    expect(s.ship.headingRad).toBeGreaterThan(-Math.PI);
  });
});

describe('stepShip collision', () => {
  function worldWithBlock(): World {
    const w = 200;
    const h = 200;
    const mask = new Uint8Array(w * h);
    fillPolygon(mask, w, h, [
      { x: 100, y: 50 },
      { x: 140, y: 50 },
      { x: 140, y: 150 },
      { x: 100, y: 150 },
    ]);
    return createWorld(w, h, mask);
  }

  it('stops before land, emits shoal, and sails off after turning away', () => {
    const world = worldWithBlock();
    // Beam reach toward the block: wind blows south, ship heads east.
    const wind: Wind = { towardRad: Math.PI / 2, speedKn: 14 };
    let s = ship({ x: 40, y: 100, speedKn: 5 });
    let shoals = 0;
    for (let i = 0; i < 60 * 20; i++) {
      const r = stepShip(s, NO_INPUT, wind, world, SIM_STEP_SECONDS);
      s = r.ship;
      shoals += r.events.filter((e) => e.type === 'shoal').length;
      expect(isLand(world, s.x, s.y)).toBe(false);
    }
    expect(shoals).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(100);
    expect(s.x).toBeGreaterThan(90);
    expect(s.speedKn).toBeLessThan(1);

    // Turn to head west, then sail away.
    const stuckX = s.x;
    for (let i = 0; i < 60 * 10; i++) {
      s = stepShip(s, { turnLeft: true, turnRight: false }, wind, world, SIM_STEP_SECONDS).ship;
      if (Math.abs(Math.abs(s.headingRad) - Math.PI) < 0.05) break;
    }
    for (let i = 0; i < 60 * 3; i++) s = stepShip(s, NO_INPUT, wind, world, SIM_STEP_SECONDS).ship;
    expect(s.x).toBeLessThan(stuckX - 5);
  });

  it('treats the map edge as land', () => {
    const world = openWorld(100, 100);
    let s = ship({ x: 80, y: 50, speedKn: 8 });
    let shoal = false;
    for (let i = 0; i < 60 * 10; i++) {
      const r = stepShip(s, NO_INPUT, EAST_WIND, world, SIM_STEP_SECONDS);
      s = r.ship;
      shoal ||= r.events.length > 0;
    }
    expect(shoal).toBe(true);
    expect(s.x).toBeLessThan(100);
  });

  it('a stopped, furled ship facing land emits nothing', () => {
    const world = worldWithBlock();
    const r = stepShip(
      ship({ x: 96, y: 100, sail: 'furled' }),
      NO_INPUT,
      EAST_WIND,
      world,
      SIM_STEP_SECONDS,
    );
    expect(r.events).toHaveLength(0);
  });
});

describe('changeSail', () => {
  it('steps between furled, half and full and stops at the ends', () => {
    expect(changeSail('furled', 1)).toBe('half');
    expect(changeSail('half', 1)).toBe('full');
    expect(changeSail('full', 1)).toBe('full');
    expect(changeSail('full', -1)).toBe('half');
    expect(changeSail('furled', -1)).toBe('furled');
  });
});
