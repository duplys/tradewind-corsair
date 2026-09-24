// SPDX-License-Identifier: GPL-3.0-only
import { START_PORT_ID } from '../data/ports';
import { departFrom } from './sailing/start';
import type { PlayerShip } from './sailing/ship';
import { START_ELAPSED_HOURS } from './time';
import { findPort, type Port } from './world/ports';
import type { World } from './world/world';

/** The player's voyage: everything that changes during play (and, from M6, gets saved). */
export interface Voyage {
  readonly ship: PlayerShip;
  readonly elapsedHours: number;
  readonly lastPortId: string;
  /** The port the ship is anchored in, or null at sea. */
  readonly dockedPortId: string | null;
}

/** A new voyage leaves the start port on 1 March 1660, 08:00 (slice 1 spec §10). */
export function newVoyage(world: World, ports: readonly Port[]): Voyage {
  const port = findPort(ports, START_PORT_ID);
  return {
    ship: departFrom(world, port.harbour, 'sloop'),
    elapsedHours: START_ELAPSED_HOURS,
    lastPortId: port.def.id,
    dockedPortId: null,
  };
}

/** Drop anchor: the ship stops and the voyage is in port (spec §4.2). */
export function dockAt(voyage: Voyage, port: Port): Voyage {
  return {
    ...voyage,
    ship: { ...voyage.ship, speedKn: 0 },
    dockedPortId: port.def.id,
    lastPortId: port.def.id,
  };
}

/** Set sail: back at the harbour, pointed at open water, sail full, stopped (spec §4.2). */
export function setSailFrom(voyage: Voyage, world: World, port: Port): Voyage {
  return {
    ...voyage,
    ship: departFrom(world, port.harbour, voyage.ship.classId),
    dockedPortId: null,
  };
}
