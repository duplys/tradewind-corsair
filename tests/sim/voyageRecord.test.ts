// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { PORTS } from '../../src/data/ports';
import { createRng } from '../../src/sim/rng';
import { emptyStats, neutralReputation, newVoyage, repairShip } from '../../src/sim/voyage';
import { derivePorts, type Port } from '../../src/sim/world/ports';
import { buildWorld, type World } from '../../src/sim/world/world';

let world: World;
let ports: Port[];

beforeAll(() => {
  world = buildWorld();
  ports = derivePorts(world, PORTS);
});

describe('new voyage record (slice 2 fields)', () => {
  it('starts with the Swallow in full condition, a crew of 40 and neutral standing', () => {
    const v = newVoyage(world, ports);
    expect(v.shipName).toBe('Swallow');
    expect(v.condition).toEqual({ hullPct: 100, riggingPct: 100, crew: 40, gunsIntact: 8 });
    expect(v.reputation).toEqual(neutralReputation());
    expect(v.stats).toEqual(emptyStats());
    expect(Object.keys(v.stats.byNation).sort()).toEqual(['en', 'es', 'fr', 'nl', 'pirate']);
  });

  it('seeds the world RNG from the given seed', () => {
    expect(newVoyage(world, ports, 12345).rngState).toBe(createRng(12345).state());
    expect(newVoyage(world, ports, 1).rngState).not.toBe(newVoyage(world, ports, 2).rngState);
  });
});

describe('repairShip', () => {
  it('pays, applies the new condition and lets the time pass', () => {
    const v = newVoyage(world, ports);
    const repaired = repairShip(v, {
      condition: { ...v.condition, hullPct: 100 },
      costGold: 250,
      hours: 30,
    });
    expect(repaired.gold).toBe(v.gold - 250);
    expect(repaired.elapsedHours).toBe(v.elapsedHours + 30);
    expect(repaired.condition.hullPct).toBe(100);
    expect(repaired.ship).toBe(v.ship);
  });
});
