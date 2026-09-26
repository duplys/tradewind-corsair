// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { PORTS } from '../../../src/data/ports';
import { SHIP_CLASSES } from '../../../src/data/ships';
import {
  applyDefeat,
  applyEnemyEscaped,
  applyEnemySunk,
  applyPlayerEscaped,
  applyPrize,
  concludeFight,
  nearestFriendlyPort,
  rollPrize,
  survivingEnemyCrew,
  survivingPlayerCrew,
} from '../../../src/sim/combat/outcome';
import type { BoardingResolver } from '../../../src/sim/combat/boarding';
import { createRng } from '../../../src/sim/rng';
import { newVoyage, type Voyage } from '../../../src/sim/voyage';
import { derivePorts, findPort, type Port } from '../../../src/sim/world/ports';
import { buildWorld, type World } from '../../../src/sim/world/world';
import { makeNpc } from '../npc/helpers';
import { beamFight } from './helpers';

let world: World;
let ports: Port[];
let voyage: Voyage;

beforeAll(() => {
  world = buildWorld();
  ports = derivePorts(world, PORTS);
  const v = newVoyage(world, ports);
  voyage = { ...v, elapsedHours: 100, gold: 1001 };
});

const spanishFluyt = () =>
  makeNpc({
    id: 9,
    classId: 'fluyt',
    nation: 'es',
    role: 'trader',
    ship: { x: voyage.ship.x + 10, y: voyage.ship.y, headingRad: 0, speedKn: 3, sail: 'full' },
  });

function fight(outcome: NonNullable<ReturnType<typeof beamFight>['outcome']>) {
  const s = beamFight('sloop', 'fluyt', 1, { role: 'trader' });
  s.ships[0].condition = { ...s.ships[0].condition, hullPct: 70, crew: 35 };
  s.ships[1].condition = { ...s.ships[1].condition, riggingPct: 40, crew: 20 };
  s.outcome = outcome;
  return s;
}

describe('concludeFight', () => {
  it('maps each ending to its outcome for the player', () => {
    expect(concludeFight(fight({ type: 'sunk', shipIndex: 1 }))).toEqual({ kind: 'enemySunk' });
    expect(concludeFight(fight({ type: 'sunk', shipIndex: 0 })).kind).toBe('defeat');
    expect(concludeFight(fight({ type: 'captured' }))).toEqual({ kind: 'prize', boarding: null });
    expect(concludeFight(fight({ type: 'surrendered' })).kind).toBe('defeat');
    expect(concludeFight(fight({ type: 'escaped', shipIndex: 0 }))).toEqual({
      kind: 'playerEscaped',
    });
    expect(concludeFight(fight({ type: 'escaped', shipIndex: 1 }))).toEqual({
      kind: 'enemyEscaped',
    });
  });

  it('fights out a boarding: winning it takes the prize, losing it is defeat', () => {
    const win: BoardingResolver = {
      resolve: () => ({ winner: 'attacker', rounds: [{ attackerCrew: 30, defenderCrew: 5 }] }),
    };
    const lose: BoardingResolver = {
      resolve: () => ({ winner: 'defender', rounds: [{ attackerCrew: 8, defenderCrew: 15 }] }),
    };
    const playerBoards = fight({ type: 'boarding', attacker: 0 });
    const won = concludeFight(playerBoards, win);
    expect(won.kind).toBe('prize');
    expect(survivingPlayerCrew(playerBoards, won.kind === 'prize' ? won.boarding : null)).toBe(30);
    expect(survivingEnemyCrew(playerBoards, won.kind === 'prize' ? won.boarding : null)).toBe(5);
    expect(concludeFight(fight({ type: 'boarding', attacker: 0 }), lose).kind).toBe('defeat');
    // When the enemy boards, the player is the defender.
    expect(concludeFight(fight({ type: 'boarding', attacker: 1 }), lose).kind).toBe('prize');
  });

  it('is deterministic with the real melee', () => {
    const a = concludeFight(fight({ type: 'boarding', attacker: 0 }));
    expect(concludeFight(fight({ type: 'boarding', attacker: 0 }))).toEqual(a);
  });
});

describe('prize', () => {
  it('rolls plunder by role and recruits capped by free berths', () => {
    const fluyt = spanishFluyt();
    for (let seed = 1; seed < 200; seed++) {
      const p = rollPrize(fluyt, 20, 'sloop', 35, createRng(seed));
      expect(p.plunder).toBeGreaterThanOrEqual(Math.round(2500 * 0.6));
      expect(p.plunder).toBeLessThanOrEqual(Math.round(2500 * 1.4));
      expect(p.recruits).toBeGreaterThanOrEqual(2); // floor(20 × 0.1)
      expect(p.recruits).toBeLessThanOrEqual(6); // floor(20 × 0.3)
    }
    const warship = makeNpc({ classId: 'frigate', role: 'warship', nation: 'es' });
    expect(rollPrize(warship, 100, 'sloop', 59, createRng(1)).recruits).toBeLessThanOrEqual(1);
    const p = rollPrize(warship, 100, 'sloop', 40, createRng(3));
    expect(p.plunder).toBeLessThanOrEqual(Math.round(1200 * 1.4 * 0.5));
  });

  it('adds plunder and recruits and counts a capture', () => {
    const fluyt = spanishFluyt();
    const s = fight({ type: 'captured' });
    const v = applyPrize(
      { ...voyage, npcs: [fluyt] },
      s,
      fluyt,
      { plunder: 2000, recruits: 5 },
      35,
      s.ships[1].condition,
      'sink',
    );
    expect(v.gold).toBe(3001);
    expect(v.condition.crew).toBe(40);
    expect(v.condition.hullPct).toBe(70);
    expect(v.npcs).toHaveLength(0);
    expect(v.stats.captured).toBe(1);
    expect(v.stats.byNation.es.captured).toBe(1);
    expect(v.elapsedHours).toBe(106);
    expect(v.ship.classId).toBe('sloop');
  });

  it('takes her as your ship: her class and condition, your crew up to her berths', () => {
    const frigate = makeNpc({ id: 9, classId: 'frigate', nation: 'es', role: 'warship' });
    const s = fight({ type: 'captured' });
    const prizeCondition = { hullPct: 55, riggingPct: 40, crew: 90, gunsIntact: 25 };
    const v = applyPrize(
      { ...voyage, npcs: [frigate] },
      s,
      frigate,
      { plunder: 0, recruits: 10 },
      35,
      prizeCondition,
      'take',
    );
    expect(v.ship.classId).toBe('frigate');
    expect(v.condition).toEqual({ hullPct: 55, riggingPct: 40, crew: 45, gunsIntact: 25 });
    const galleonCrew = applyPrize(
      { ...voyage, npcs: [frigate] },
      s,
      { ...frigate, classId: 'sloop' },
      { plunder: 0, recruits: 30 },
      50,
      prizeCondition,
      'take',
    );
    expect(galleonCrew.condition.crew).toBe(SHIP_CLASSES.sloop.crewMax);
  });

  it('gives back half the reputation for letting a friendly ship go', () => {
    const dutch = makeNpc({ id: 9, classId: 'fluyt', nation: 'nl', role: 'trader' });
    const s = fight({ type: 'captured' });
    const start = { ...voyage, reputation: { ...voyage.reputation, nl: -1 }, npcs: [dutch] };
    expect(
      applyPrize(start, s, dutch, { plunder: 0, recruits: 0 }, 35, s.ships[1].condition, 'letGo')
        .reputation.nl,
    ).toBe(-0.5);
    expect(
      applyPrize(start, s, dutch, { plunder: 0, recruits: 0 }, 35, s.ships[1].condition, 'sink')
        .reputation.nl,
    ).toBe(-1);
    const spanish = spanishFluyt();
    expect(
      applyPrize(
        { ...voyage, npcs: [spanish] },
        s,
        spanish,
        { plunder: 0, recruits: 0 },
        35,
        s.ships[1].condition,
        'letGo',
      ).reputation.es,
    ).toBe(0);
  });
});

describe('other endings', () => {
  it('records a sinking, with no plunder', () => {
    const fluyt = spanishFluyt();
    const v = applyEnemySunk(
      { ...voyage, npcs: [fluyt] },
      fight({ type: 'sunk', shipIndex: 1 }),
      fluyt,
    );
    expect(v.gold).toBe(1001);
    expect(v.stats.sunk).toBe(1);
    expect(v.stats.byNation.es.sunk).toBe(1);
    expect(v.npcs).toHaveLength(0);
  });

  it('lets an escaped enemy keep her damage and ignore the player for 48 h', () => {
    const fluyt = spanishFluyt();
    const v = applyEnemyEscaped(
      { ...voyage, npcs: [fluyt] },
      fight({ type: 'escaped', shipIndex: 1 }),
      9,
    );
    expect(v.npcs[0]!.condition.riggingPct).toBe(40);
    expect(v.npcs[0]!.ignorePlayerUntilHours).toBe(106 + 48);
  });

  it('moves a player who slipped away 25 px and counts it', () => {
    const fluyt = spanishFluyt();
    const v = applyPlayerEscaped(
      { ...voyage, npcs: [fluyt] },
      world,
      fight({ type: 'escaped', shipIndex: 0 }),
      9,
    );
    expect(Math.hypot(v.ship.x - voyage.ship.x, v.ship.y - voyage.ship.y)).toBeCloseTo(25, 5);
    expect(v.npcs[0]!.ignorePlayerUntilHours).toBe(106 + 24);
    expect(v.stats.escapedFrom).toBe(1);
  });

  it('puts a defeated player ashore at the nearest friendly port in a sound sloop', () => {
    const fluyt = spanishFluyt();
    const beaten = {
      ...voyage,
      ship: { ...voyage.ship, classId: 'frigate' as const },
      npcs: [fluyt],
    };
    const v = applyDefeat(beaten, world, ports, 9);
    expect(v.gold).toBe(500);
    expect(v.ship.classId).toBe('sloop');
    expect(v.shipName).toBe(voyage.shipName);
    expect(v.condition).toEqual({ hullPct: 100, riggingPct: 100, crew: 12, gunsIntact: 8 });
    expect(v.elapsedHours).toBe(100 + 6 + 14 * 24);
    expect(v.stats.defeats).toBe(1);
    const port = findPort(ports, v.lastPortId);
    expect(port.def.nation).not.toBe('es');
    expect(Math.hypot(v.ship.x - port.harbour.x, v.ship.y - port.harbour.y)).toBeLessThan(1);
  });

  it('never picks a Spanish port for the defeated', () => {
    const sanJuan = findPort(ports, 'san-juan').harbour;
    expect(nearestFriendlyPort(ports, sanJuan.x, sanJuan.y).def.nation).not.toBe('es');
  });
});
