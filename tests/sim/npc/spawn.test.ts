// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { NATIONS } from '../../../src/data/nations';
import {
  GALLEON_PORT_IDS,
  PIRATE_CLASS_WEIGHTS,
  TRADER_CLASS_WEIGHTS,
  WARSHIP_CLASS_WEIGHTS,
} from '../../../src/data/npc';
import { PORTS } from '../../../src/data/ports';
import { SHIP_CLASSES } from '../../../src/data/ships';
import { SHIP_NAMES } from '../../../src/data/shipNames';
import { Navigator } from '../../../src/sim/npc/navigator';
import type { NpcShip } from '../../../src/sim/npc/npc';
import { spawnNpc } from '../../../src/sim/npc/spawn';
import { createRng } from '../../../src/sim/rng';
import { derivePorts, findPort, type Port } from '../../../src/sim/world/ports';
import type { WorldPoint } from '../../../src/sim/world/projection';
import { buildWorld, isLand } from '../../../src/sim/world/world';

let nav: Navigator;
let ports: Port[];

beforeAll(() => {
  const world = buildWorld();
  ports = derivePorts(world, PORTS);
  nav = new Navigator(world, ports);
});

function spawnMany(player: WorldPoint, count: number): NpcShip[] {
  const out: NpcShip[] = [];
  for (let seed = 1; out.length < count && seed < count * 3; seed++) {
    const npc = spawnNpc({
      nav,
      player,
      hours: 8,
      rng: createRng(seed),
      id: seed,
      namesInUse: new Set(),
    });
    if (npc) out.push(npc);
  }
  return out;
}

describe('spawnNpc', () => {
  it('is deterministic for a given RNG state', () => {
    const player = findPort(ports, 'bridgetown').harbour;
    const a = spawnNpc({ nav, player, hours: 8, rng: createRng(42), id: 1, namesInUse: new Set() });
    const b = spawnNpc({ nav, player, hours: 8, rng: createRng(42), id: 1, namesInUse: new Set() });
    expect(a).not.toBeNull();
    expect(b).toEqual(a);
  });

  it('places ships 140–240 px from the player, on water, fully armed and plausibly manned', () => {
    const player = findPort(ports, 'port-royal').harbour;
    for (const npc of spawnMany(player, 150)) {
      const d = Math.hypot(npc.ship.x - player.x, npc.ship.y - player.y);
      expect(d).toBeGreaterThanOrEqual(140);
      expect(d).toBeLessThanOrEqual(240);
      expect(isLand(nav.world, npc.ship.x, npc.ship.y)).toBe(false);
      const cls = SHIP_CLASSES[npc.classId];
      const c = npc.condition;
      expect(c.hullPct).toBeGreaterThanOrEqual(85);
      expect(c.riggingPct).toBeGreaterThanOrEqual(85);
      expect(c.gunsIntact).toBe(cls.guns);
      // Crew is a share of crewTypical, rounded down: traders 48–66 %, others 80–110 %.
      const [lo, hi] = npc.role === 'trader' ? [0.48, 0.66] : [0.8, 1.1];
      expect(c.crew).toBeGreaterThanOrEqual(Math.floor(cls.crewTypical * lo));
      expect(c.crew).toBeLessThanOrEqual(Math.min(cls.crewMax, cls.crewTypical * hi));
      expect(SHIP_NAMES[npc.nation]).toContain(npc.name);
      if (npc.role !== 'pirate') expect(npc.path.length).toBeGreaterThan(0);
    }
  });

  it('follows the role and class tables and the galleon rule', () => {
    const player = findPort(ports, 'havana').harbour;
    for (const npc of spawnMany(player, 300)) {
      if (npc.nation === 'pirate') {
        expect(npc.role).toBe('pirate');
        expect(PIRATE_CLASS_WEIGHTS.map(([id]) => id)).toContain(npc.classId);
        continue;
      }
      expect(npc.role).not.toBe('pirate');
      const table = npc.role === 'trader' ? TRADER_CLASS_WEIGHTS : WARSHIP_CLASS_WEIGHTS;
      expect(table[npc.nation].map(([id]) => id)).toContain(npc.classId);
      // Traders and warships sail to a port of their own nation.
      expect(findPort(ports, npc.destPortId).def.nation).toBe(npc.nation);
      if (npc.classId === 'galleon') {
        expect(npc.nation).toBe('es');
        expect(npc.role).toBe('trader');
      }
    }
  });

  it('flies local colours: mostly Spanish off Havana, mostly not off Barbados', () => {
    const share = (id: string, nation: string) => {
      const npcs = spawnMany(findPort(ports, id).harbour, 300);
      return npcs.filter((n) => n.nation === nation).length / npcs.length;
    };
    // Nassau (English) is within 300 px of many spawn points, and 10 % are pirates.
    expect(share('havana', 'es')).toBeGreaterThan(0.5);
    expect(share('bridgetown', 'es')).toBeLessThan(0.4);
  });

  it('makes about one ship in ten a pirate', () => {
    const npcs = spawnMany(findPort(ports, 'st-johns').harbour, 400);
    const pirates = npcs.filter((n) => n.nation === 'pirate').length / npcs.length;
    expect(pirates).toBeGreaterThan(0.05);
    expect(pirates).toBeLessThan(0.16);
  });

  it('avoids names already at sea', () => {
    const player = findPort(ports, 'port-royal').harbour;
    const taken = new Set([...Object.values(SHIP_NAMES).flat()].filter((n) => n !== 'Hopewell'));
    for (let seed = 1; seed < 60; seed++) {
      const npc = spawnNpc({
        nav,
        player,
        hours: 8,
        rng: createRng(seed),
        id: 1,
        namesInUse: taken,
      });
      if (npc && npc.nation === 'en') expect(npc.name).toBe('Hopewell');
    }
  });

  it('uses only real nations', () => {
    for (const npc of spawnMany(findPort(ports, 'tortuga').harbour, 50)) {
      expect([...Object.keys(NATIONS), 'pirate']).toContain(npc.nation);
    }
  });
});

describe('the galleon rule', () => {
  it('sends galleons only to or from the treasure ports', () => {
    // Off Barbados no lane starts at a treasure port, so every galleon must be bound for one.
    const player = findPort(ports, 'trinidad').harbour;
    let galleons = 0;
    for (let seed = 1; seed < 800; seed++) {
      const npc = spawnNpc({
        nav,
        player,
        hours: 8,
        rng: createRng(seed),
        id: seed,
        namesInUse: new Set(),
      });
      if (npc?.classId !== 'galleon') continue;
      galleons++;
      expect(GALLEON_PORT_IDS).toContain(npc.destPortId);
    }
    expect(galleons).toBeGreaterThan(0);
  });
});
