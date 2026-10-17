// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { PORTS } from '../../../src/data/ports';
import { SHIP_CLASSES } from '../../../src/data/ships';
import {
  HIRE_GOLD_PER_HAND,
  TIP_GOLD,
  TREASURE_DIG_HOURS,
  TREASURE_DIG_RADIUS_PX,
  TREASURE_GOLD_MAX,
  TREASURE_GOLD_MIN,
  TREASURE_MAX_ACTIVE,
} from '../../../src/data/tavern';
import { hireCrew, maxHires } from '../../../src/sim/tavern/crew';
import { overhearRumour } from '../../../src/sim/tavern/rumours';
import { buyTreasureTip, digTreasure, siteInReach } from '../../../src/sim/tavern/treasure';
import { createRng } from '../../../src/sim/rng';
import { newVoyage, type Voyage } from '../../../src/sim/voyage';
import { derivePorts, findPort, type Port } from '../../../src/sim/world/ports';
import { buildWorld, isLand, type World } from '../../../src/sim/world/world';
import { makeNpc } from '../npc/helpers';

let world: World;
let ports: Port[];
let voyage: Voyage;
let here: Port;

beforeAll(() => {
  world = buildWorld();
  ports = derivePorts(world, PORTS);
  voyage = newVoyage(world, ports, 7);
  here = findPort(ports, 'port-royal');
});

describe('hiring crew', () => {
  it('costs the tavern price per hand', () => {
    const v = hireCrew(voyage, 5);
    expect(v.condition.crew).toBe(voyage.condition.crew + 5);
    expect(v.gold).toBe(voyage.gold - 5 * HIRE_GOLD_PER_HAND);
  });

  it('stops at the berths and at the purse', () => {
    const max = SHIP_CLASSES.sloop.crewMax;
    expect(hireCrew(voyage, 1000).condition.crew).toBe(max);
    const poor = { ...voyage, gold: 20 };
    expect(maxHires(poor)).toBe(2);
    expect(hireCrew(poor, 10).condition.crew).toBe(voyage.condition.crew + 2);
    expect(hireCrew({ ...voyage, gold: 3 }, 1)).toEqual({ ...voyage, gold: 3 });
  });
});

describe('rumours', () => {
  it('are deterministic for a seed and never send the player to the port they are in', () => {
    const a = overhearRumour(voyage, ports, here, createRng(3));
    const b = overhearRumour(voyage, ports, here, createRng(3));
    expect(a).toEqual(b);
    for (let seed = 0; seed < 200; seed++) {
      const r = overhearRumour(voyage, ports, here, createRng(seed));
      if (r.kind === 'prices') {
        expect(r.dearPort).not.toBe(here.def.id);
        expect(r.cheapPort).not.toBe(here.def.id);
      }
      if (r.kind === 'place') expect(r.portId).not.toBe(here.def.id);
    }
  });

  it('can name where pirates were seen, when there are any', () => {
    const harbour = findPort(ports, 'tortuga').harbour;
    const withPirate = {
      ...voyage,
      npcs: [
        makeNpc({
          nation: 'pirate',
          role: 'pirate',
          ship: { x: harbour.x + 5, y: harbour.y, headingRad: 0, speedKn: 3, sail: 'full' },
        }),
      ],
    };
    const kinds = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const r = overhearRumour(withPirate, ports, here, createRng(seed));
      kinds.add(r.kind);
      if (r.kind === 'pirates') expect(r.nearPort).toBe('tortuga');
    }
    expect(kinds.has('pirates')).toBe(true);
  });
});

describe('treasure tips', () => {
  it('place a site on land beside open water, and cost gold', () => {
    const result = buyTreasureTip(voyage, world, ports, here);
    if (!result.ok) throw new Error(result.reason);
    expect(result.voyage.gold).toBe(voyage.gold - TIP_GOLD);
    expect(result.voyage.treasures).toEqual([result.site]);
    expect(isLand(world, result.site.x, result.site.y)).toBe(true);
    expect(result.voyage.rngState).not.toBe(voyage.rngState);
  });

  it('are the same for the same voyage state', () => {
    const a = buyTreasureTip(voyage, world, ports, here);
    const b = buyTreasureTip(voyage, world, ports, here);
    expect(a).toEqual(b);
  });

  it('refuse without gold and beyond the limit', () => {
    expect(buyTreasureTip({ ...voyage, gold: TIP_GOLD - 1 }, world, ports, here)).toEqual({
      ok: false,
      reason: 'gold',
    });
    let v = { ...voyage, gold: 100000 };
    for (let i = 0; i < TREASURE_MAX_ACTIVE; i++) {
      const r = buyTreasureTip(v, world, ports, here);
      if (!r.ok) throw new Error(r.reason);
      v = r.voyage;
    }
    expect(new Set(v.treasures.map((s) => `${s.x},${s.y}`)).size).toBe(TREASURE_MAX_ACTIVE);
    expect(buyTreasureTip(v, world, ports, here)).toEqual({ ok: false, reason: 'full' });
  });

  it('can be dug up only close to the site, taking time, and using the site up', () => {
    const r = buyTreasureTip(voyage, world, ports, here);
    if (!r.ok) throw new Error(r.reason);
    expect(siteInReach(r.voyage)).toBeNull();
    const near = {
      ...r.voyage,
      ship: { ...r.voyage.ship, x: r.site.x + TREASURE_DIG_RADIUS_PX - 1, y: r.site.y },
    };
    expect(siteInReach(near)).toBe(r.site);
    const dug = digTreasure(near, r.site);
    expect(dug.voyage.treasures).toEqual([]);
    expect(dug.voyage.elapsedHours).toBe(near.elapsedHours + TREASURE_DIG_HOURS);
    expect(dug.voyage.gold).toBe(near.gold + dug.found);
  });

  it('find gold in range, or nothing, with some empty holes over many tries', () => {
    const site = { x: 1, y: 1 };
    let empty = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const v = { ...voyage, treasures: [site], rngState: seed };
      const { found } = digTreasure(v, site);
      if (found === 0) empty++;
      else {
        expect(found).toBeGreaterThanOrEqual(TREASURE_GOLD_MIN);
        expect(found).toBeLessThanOrEqual(TREASURE_GOLD_MAX);
      }
    }
    expect(empty).toBeGreaterThan(20);
    expect(empty).toBeLessThan(120);
  });
});
