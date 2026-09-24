// SPDX-License-Identifier: GPL-3.0-only
import { DOCK_RADIUS_PX } from '../../data/sailing';
import type { PortDef } from '../../data/ports';
import { lonLatToWorld, type WorldPoint } from './projection';
import { nearestHarbourWater, nearestLand } from './search';
import type { World } from './world';

export interface Port {
  readonly def: PortDef;
  /** Land pixel centre where the town is drawn. */
  readonly town: WorldPoint;
  /** Water pixel centre where ships dock and reappear. */
  readonly harbour: WorldPoint;
}

/**
 * Derive usable town and harbour positions from each port's real coordinates (slice 1 spec
 * §4.1). Coarse coastlines can put a port in the sea or inland, so search for the nearest land,
 * then for the nearest clear water from there. Throws with the port id if either search fails.
 */
export function derivePorts(world: World, defs: readonly PortDef[]): Port[] {
  return defs.map((def) => {
    const p = lonLatToWorld(def.lon, def.lat);
    const town = nearestLand(world, p.x, p.y);
    if (!town) throw new Error(`Port ${def.id}: no land within search radius`);
    const harbour = nearestHarbourWater(world, town.x, town.y);
    if (!harbour) throw new Error(`Port ${def.id}: no harbour water within search radius`);
    return { def, town, harbour };
  });
}

/** The closest port whose harbour is within docking range, or null (spec §4.2). */
export function nearPort(ports: readonly Port[], x: number, y: number): Port | null {
  let best: Port | null = null;
  let bestD2 = DOCK_RADIUS_PX * DOCK_RADIUS_PX;
  for (const port of ports) {
    const d2 = (port.harbour.x - x) ** 2 + (port.harbour.y - y) ** 2;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = port;
    }
  }
  return best;
}

export function findPort(ports: readonly Port[], id: string): Port {
  const port = ports.find((p) => p.def.id === id);
  if (!port) throw new Error(`Unknown port: ${id}`);
  return port;
}
