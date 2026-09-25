// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { SHIP_CLASS_IDS } from '../../../src/data/ships';
import { angleDiff, radToDeg } from '../../../src/sim/math';
import { courseFor, decideSailing, helmInput } from '../../../src/sim/npc/sail';
import { createRng } from '../../../src/sim/rng';
import type { Wind } from '../../../src/sim/sailing/wind';
import { makeNpc, openSea, sailAlone } from './helpers';

/** Wind blowing toward the west, i.e. from the east: east is upwind. */
const EASTERLY: Wind = { towardRad: Math.PI, speedKn: 14 };
const deg = (d: number) => (d * Math.PI) / 180;

describe('courseFor', () => {
  it('steers straight for a bearing outside the no-go zone', () => {
    const c = courseFor(deg(90), null, EASTERLY, 0); // south: beam reach
    expect(c.headingRad).toBeCloseTo(deg(90));
    expect(c.tack).toBeNull();
  });

  it('tacks 45° off the wind when the bearing is within 40° of the wind', () => {
    const c = courseFor(deg(10), null, EASTERLY, 0); // a little south of dead upwind (east)
    expect(c.tack?.side).toBe(1);
    expect(Math.abs(radToDeg(angleDiff(c.headingRad, 0)))).toBeCloseTo(45);
    expect(c.tack?.untilHours).toBe(36);
  });

  it('keeps its tack until the bearing crosses the wind axis', () => {
    const tack = { side: 1 as const, untilHours: 36 };
    expect(courseFor(deg(-2), tack, EASTERLY, 5).tack?.side).toBe(1); // within hysteresis
    expect(courseFor(deg(-5), tack, EASTERLY, 5).tack?.side).toBe(-1); // crossed
  });

  it('changes tack after 1.5 days at the latest', () => {
    const tack = { side: 1 as const, untilHours: 36 };
    const c = courseFor(deg(20), tack, EASTERLY, 36);
    expect(c.tack).toEqual({ side: -1, untilHours: 72 });
  });
});

describe('helmInput', () => {
  it('leaves the helm alone within ±4° and turns toward the course otherwise', () => {
    const at = { x: 0, y: 0, headingRad: 0, speedKn: 5, sail: 'full' as const };
    expect(helmInput(makeNpc({ ship: at, targetHeadingRad: deg(3) }))).toEqual({
      turnLeft: false,
      turnRight: false,
    });
    expect(helmInput(makeNpc({ ship: at, targetHeadingRad: deg(10) })).turnRight).toBe(true);
    expect(helmInput(makeNpc({ ship: at, targetHeadingRad: deg(-10) })).turnLeft).toBe(true);
  });
});

describe('world-map sailing', () => {
  it('gets every class to a destination directly upwind', () => {
    const nav = openSea(1000, 400, { x: 700, y: 200 });
    for (const classId of SHIP_CLASS_IDS) {
      const npc = makeNpc({ classId, path: [{ x: 700, y: 200 }] });
      const result = sailAlone(nav, npc, EASTERLY, 24 * 60);
      expect(result.left, classId).toEqual({ leave: 'arrived' });
    }
  });

  it('reaches a destination downwind quickly without tacking', () => {
    const nav = openSea(1000, 400, { x: 100, y: 200 });
    const npc = makeNpc({
      ship: { x: 700, y: 200, headingRad: Math.PI, speedKn: 5, sail: 'full' },
      path: [{ x: 100, y: 200 }],
    });
    const result = sailAlone(nav, npc, EASTERLY, 24 * 20);
    expect(result.left).toEqual({ leave: 'arrived' });
    expect(result.npc.tack).toBeNull();
  });

  it('makes pirates loiter near home and never enter port', () => {
    const nav = openSea(1000, 800, { x: 900, y: 700 });
    const home = { x: 400, y: 400 };
    const npc = makeNpc({
      role: 'pirate',
      nation: 'pirate',
      ship: { x: home.x, y: home.y, headingRad: 0, speedKn: 4, sail: 'full' },
      home,
      loiterUntilHours: 24 * 10,
    });
    const result = sailAlone(nav, npc, EASTERLY, 24 * 10 - 1);
    expect(result.left).toBeNull();
    expect(Math.hypot(result.npc.ship.x - home.x, result.npc.ship.y - home.y)).toBeLessThan(170);
  });

  it('sends pirates on their way once they have loitered long enough', () => {
    const nav = openSea(1000, 800, { x: 900, y: 700 });
    const home = { x: 400, y: 400 };
    const npc = makeNpc({
      role: 'pirate',
      nation: 'pirate',
      ship: { x: home.x, y: home.y, headingRad: 0, speedKn: 4, sail: 'full' },
      home,
      loiterUntilHours: 24,
    });
    const result = sailAlone(nav, npc, EASTERLY, 24 * 30);
    expect(result.left).toEqual({ leave: 'arrived' });
  });

  it('enters port on reaching the destination harbour', () => {
    const nav = openSea(400, 400, { x: 200, y: 200 });
    const npc = makeNpc({ ship: { x: 205, y: 200, headingRad: 0, speedKn: 0, sail: 'full' } });
    const d = decideSailing(npc, { wind: EASTERLY, hours: 1, nav, rng: () => createRng(1) });
    expect(d).toEqual({ leave: 'arrived' });
  });

  it('finds a new route when stuck, and leaves the map when there is none', () => {
    const nav = openSea(400, 400, { x: 300, y: 200 });
    const stuck = makeNpc({
      ship: { x: 100, y: 200, headingRad: 0, speedKn: 0, sail: 'full' },
      path: [],
      progress: { x: 100, y: 200, atHours: 0 },
    });
    const d = decideSailing(stuck, { wind: EASTERLY, hours: 12, nav, rng: () => createRng(1) });
    expect('npc' in d && d.npc.path.length).toBeGreaterThan(0);
    expect('npc' in d && d.npc.progress.atHours).toBe(12);

    const lost = makeNpc({ destPortId: 'nowhere', progress: { x: 100, y: 200, atHours: 0 } });
    expect(
      decideSailing(lost, { wind: EASTERLY, hours: 12, nav, rng: () => createRng(1) }),
    ).toEqual({
      leave: 'lost',
    });
  });
});
