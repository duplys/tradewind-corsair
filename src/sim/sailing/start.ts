// SPDX-License-Identifier: GPL-3.0-only
import { START_LAT, START_LON } from '../../data/sailing';
import { lonLatToWorld } from '../world/projection';
import { nearestHarbourWater, nearestLand, openWaterHeading } from '../world/search';
import type { World } from '../world/world';
import type { PlayerShip } from './ship';

/**
 * The ship for a new voyage: at the start port's harbour, facing open water, sail full,
 * stopped (spec §10). Until ports exist (M5) the harbour is derived here directly.
 */
export function createStartShip(world: World): PlayerShip {
  const port = lonLatToWorld(START_LON, START_LAT);
  const town = nearestLand(world, port.x, port.y);
  const harbour = town && nearestHarbourWater(world, town.x, town.y);
  if (!harbour) throw new Error('No harbour found for the start port');
  return {
    x: harbour.x,
    y: harbour.y,
    headingRad: openWaterHeading(world, harbour.x, harbour.y),
    speedKn: 0,
    sail: 'full',
    classId: 'sloop',
  };
}
