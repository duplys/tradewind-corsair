// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { angleDiff } from '../../../src/sim/math';
import { decideSailing, huntsPlayer, nextIntent, runsFromPlayer } from '../../../src/sim/npc/sail';
import { createRng } from '../../../src/sim/rng';
import type { Wind } from '../../../src/sim/sailing/wind';
import { makeNpc, openSea } from './helpers';

const NORTHERLY: Wind = { towardRad: Math.PI / 2, speedKn: 14 }; // blowing south
const at = (x: number, y: number) => ({ x, y, headingRad: 0, speedKn: 5, sail: 'full' as const });
const spanishFrigate = {
  role: 'warship' as const,
  nation: 'es' as const,
  classId: 'frigate' as const,
};
const pirate = { role: 'pirate' as const, nation: 'pirate' as const };

describe('who hunts and who runs', () => {
  it('makes pirates and hostile warships hunters, and hostile traders runners', () => {
    expect(huntsPlayer(makeNpc(pirate))).toBe(true);
    expect(huntsPlayer(makeNpc(spanishFrigate))).toBe(true);
    expect(huntsPlayer(makeNpc({ role: 'warship', nation: 'en' }))).toBe(false);
    expect(huntsPlayer(makeNpc({ role: 'warship', nation: 'nl' }))).toBe(false);
    expect(runsFromPlayer(makeNpc({ role: 'trader', nation: 'es' }))).toBe(true);
    expect(runsFromPlayer(makeNpc({ role: 'trader', nation: 'fr' }))).toBe(false);
    expect(runsFromPlayer(makeNpc(spanishFrigate))).toBe(false);
  });
});

describe('nextIntent', () => {
  const player = { x: 0, y: 0 };

  it('starts a chase within 70 px, not beyond', () => {
    expect(nextIntent(makeNpc({ ...pirate, ship: at(69, 0) }), player, 5)).toEqual({
      intent: 'chase',
      intentSinceHours: 5,
      ignorePlayerUntilHours: 0,
    });
    expect(nextIntent(makeNpc({ ...pirate, ship: at(71, 0) }), player, 5).intent).toBe('travel');
  });

  it('does not chase while ignoring the player', () => {
    const npc = makeNpc({ ...spanishFrigate, ship: at(30, 0), ignorePlayerUntilHours: 10 });
    expect(nextIntent(npc, player, 9).intent).toBe('travel');
    expect(nextIntent(npc, player, 10).intent).toBe('chase');
  });

  it('gives up a chase beyond 140 px, or after 3 days and then rests a day', () => {
    const chasing = { ...pirate, intent: 'chase' as const, intentSinceHours: 0 };
    expect(nextIntent(makeNpc({ ...chasing, ship: at(139, 0) }), player, 5).intent).toBe('chase');
    expect(nextIntent(makeNpc({ ...chasing, ship: at(141, 0) }), player, 5).intent).toBe('travel');
    expect(nextIntent(makeNpc({ ...chasing, ship: at(20, 0) }), player, 72)).toEqual({
      intent: 'travel',
      intentSinceHours: 72,
      ignorePlayerUntilHours: 96,
    });
  });

  it('makes hostile traders flee within 50 px and resume beyond 110 px', () => {
    const trader = { role: 'trader' as const, nation: 'es' as const };
    expect(nextIntent(makeNpc({ ...trader, ship: at(49, 0) }), player, 1).intent).toBe('flee');
    expect(nextIntent(makeNpc({ ...trader, ship: at(51, 0) }), player, 1).intent).toBe('travel');
    const fleeing = { ...trader, intent: 'flee' as const };
    expect(nextIntent(makeNpc({ ...fleeing, ship: at(100, 0) }), player, 1).intent).toBe('flee');
    expect(nextIntent(makeNpc({ ...fleeing, ship: at(111, 0) }), player, 1).intent).toBe('travel');
  });

  it('never makes friendly ships chase or flee', () => {
    for (const npc of [
      makeNpc({ role: 'trader', nation: 'nl', ship: at(5, 0) }),
      makeNpc({ role: 'warship', nation: 'fr', ship: at(5, 0) }),
    ]) {
      expect(nextIntent(npc, player, 1).intent).toBe('travel');
    }
  });
});

describe('chasing and fleeing courses', () => {
  const nav = openSea(1000, 1000, { x: 900, y: 900 });
  const ctx = (player: { x: number; y: number }) => ({
    wind: NORTHERLY,
    hours: 5,
    nav,
    player,
    rng: () => createRng(1),
  });

  it('steers a chaser straight at the player on a free course', () => {
    const npc = makeNpc({ ...pirate, ship: at(500, 500) });
    const d = decideSailing(npc, ctx({ x: 540, y: 500 })); // due east: a beam reach
    expect('npc' in d && d.npc.intent).toBe('chase');
    expect('npc' in d && Math.abs(angleDiff(d.npc.targetHeadingRad, 0))).toBeLessThan(1e-9);
  });

  it('tacks when the player is dead upwind', () => {
    const npc = makeNpc({ ...pirate, ship: at(500, 500) });
    const d = decideSailing(npc, ctx({ x: 500, y: 450 })); // due north, into the wind
    expect('npc' in d && d.npc.tack).not.toBeNull();
    const off = 'npc' in d ? Math.abs(angleDiff(d.npc.targetHeadingRad, -Math.PI / 2)) : 0;
    expect(off).toBeCloseTo(Math.PI / 4);
  });

  it('steers a fleeing trader directly away from the player', () => {
    const npc = makeNpc({ role: 'trader', nation: 'es', ship: at(500, 500) });
    const d = decideSailing(npc, ctx({ x: 470, y: 500 })); // player to the west
    expect('npc' in d && d.npc.intent).toBe('flee');
    expect('npc' in d && Math.abs(angleDiff(d.npc.targetHeadingRad, 0))).toBeLessThan(1e-9);
  });

  it('plans a fresh route when a chase ends', () => {
    const npc = makeNpc({ ...pirate, intent: 'chase', ship: at(500, 500), path: [{ x: 1, y: 1 }] });
    const d = decideSailing(npc, ctx({ x: 900, y: 100 })); // far away: the chase ends
    expect('npc' in d && d.npc.intent).toBe('travel');
    expect('npc' in d && d.npc.path.at(-1)).not.toEqual({ x: 1, y: 1 });
  });
});
