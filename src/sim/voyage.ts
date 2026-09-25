// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS, type NationId } from '../data/nations';
import { START_PORT_ID } from '../data/ports';
import { SHIP_CLASSES } from '../data/ships';
import {
  DEFAULT_SHIP_NAME,
  DEFAULT_VOYAGE_SEED,
  FIRST_NPC_ID,
  START_CREW,
  START_GOLD,
} from '../data/voyage';
import type { NpcShip } from './npc/npc';
import { createRng, type RngState } from './rng';
import { departFrom } from './sailing/start';
import type { PlayerShip } from './sailing/ship';
import { fullCondition, type ShipCondition } from './ships/condition';
import type { RepairPlan } from './ships/repair';
import { START_ELAPSED_HOURS } from './time';
import { findPort, type Port } from './world/ports';
import type { World } from './world/world';

/** Standing with each nation (slice 2 spec §5.1); recorded now, used from slice 5. */
export type Reputation = Readonly<Record<NationId, number>>;

/** Who a stat is kept for: the four nations and pirates. */
export type StatsNation = NationId | 'pirate';
export const STATS_NATIONS: readonly StatsNation[] = [
  ...(Object.keys(NATIONS) as NationId[]),
  'pirate',
];

export interface NationStats {
  readonly captured: number;
  readonly sunk: number;
}

/** The career record (slice 2 spec §8). */
export interface VoyageStats {
  readonly captured: number;
  readonly sunk: number;
  readonly defeats: number;
  /** Fights the player got away from. */
  readonly escapedFrom: number;
  readonly byNation: Readonly<Record<StatsNation, NationStats>>;
}

/** The player's voyage: everything that changes during play and gets saved. */
export interface Voyage {
  /** Where the ship is and how it sails; the same shape the physics steps for every ship. */
  readonly ship: PlayerShip;
  readonly shipName: string;
  /** Hull, rigging, crew and guns. The player's crew lives here. */
  readonly condition: ShipCondition;
  readonly elapsedHours: number;
  readonly lastPortId: string;
  /** The port the ship is anchored in, or null at sea. */
  readonly dockedPortId: string | null;
  readonly gold: number;
  /** How many of the first-voyage hints have been shown (slice 1 spec §9.6). */
  readonly hintsShown: number;
  /** State of the world RNG (NPC spawning and, forked, each encounter). */
  readonly rngState: RngState;
  readonly reputation: Reputation;
  readonly stats: VoyageStats;
  /** Other ships at sea around the player (slice 2 spec §4). */
  readonly npcs: readonly NpcShip[];
  readonly nextNpcId: number;
}

export function neutralReputation(): Reputation {
  return Object.fromEntries(Object.keys(NATIONS).map((id) => [id, 0])) as Record<NationId, number>;
}

export function emptyStats(): VoyageStats {
  return {
    captured: 0,
    sunk: 0,
    defeats: 0,
    escapedFrom: 0,
    byNation: Object.fromEntries(
      STATS_NATIONS.map((id) => [id, { captured: 0, sunk: 0 }]),
    ) as Record<StatsNation, NationStats>,
  };
}

/**
 * A new voyage leaves the start port on 1 March 1660, 08:00 (slice 1 spec §10). `seed` starts
 * the world RNG; the game passes a fresh one for every new voyage.
 */
export function newVoyage(
  world: World,
  ports: readonly Port[],
  seed: number = DEFAULT_VOYAGE_SEED,
): Voyage {
  const port = findPort(ports, START_PORT_ID);
  return {
    ship: departFrom(world, port.harbour, 'sloop'),
    shipName: DEFAULT_SHIP_NAME,
    condition: fullCondition(SHIP_CLASSES.sloop, START_CREW),
    elapsedHours: START_ELAPSED_HOURS,
    lastPortId: port.def.id,
    dockedPortId: null,
    gold: START_GOLD,
    hintsShown: 0,
    rngState: createRng(seed).state(),
    reputation: neutralReputation(),
    stats: emptyStats(),
    npcs: [],
    nextNpcId: FIRST_NPC_ID,
  };
}

/** Drop anchor: the ship stops and the voyage is in port (slice 1 spec §4.2). */
export function dockAt(voyage: Voyage, port: Port): Voyage {
  return {
    ...voyage,
    ship: { ...voyage.ship, speedKn: 0 },
    dockedPortId: port.def.id,
    lastPortId: port.def.id,
  };
}

/** Set sail: back at the harbour, pointed at open water, sail full, stopped (slice 1 spec §4.2). */
export function setSailFrom(voyage: Voyage, world: World, port: Port): Voyage {
  return {
    ...voyage,
    ship: departFrom(world, port.harbour, voyage.ship.classId),
    dockedPortId: null,
  };
}

/** Pay for a repair and let the days pass while it is done (slice 2 spec §3.4). */
export function repairShip(voyage: Voyage, plan: RepairPlan): Voyage {
  return {
    ...voyage,
    condition: plan.condition,
    gold: voyage.gold - plan.costGold,
    elapsedHours: voyage.elapsedHours + plan.hours,
  };
}
