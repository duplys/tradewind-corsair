// SPDX-License-Identifier: GPL-3.0-only
import type { ShipClassId } from '../../data/ships';
import type { WorldPoint } from '../world/projection';
import { openWaterHeading } from '../world/search';
import type { World } from '../world/world';
import type { PlayerShip } from './ship';

/**
 * A ship leaving port (slice 1 spec §4.2, §10): at the harbour, pointed at the most open water,
 * sail full, stopped.
 */
export function departFrom(world: World, harbour: WorldPoint, classId: ShipClassId): PlayerShip {
  return {
    x: harbour.x,
    y: harbour.y,
    headingRad: openWaterHeading(world, harbour.x, harbour.y),
    speedKn: 0,
    sail: 'full',
    classId,
  };
}
