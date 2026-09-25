// SPDX-License-Identifier: GPL-3.0-only
import {
  ESCAPE_BASE,
  ESCAPE_MAX,
  ESCAPE_MIN,
  ESCAPE_SAMPLE_DEG,
  ESCAPE_SPEED_DIVISOR_KN,
} from '../../data/encounter';
import type { ShipClass } from '../../data/ships';
import { clamp } from '../math';
import { relativeWindDeg } from '../sailing/polar';
import { targetSpeedKn } from '../sailing/ship';
import type { Wind } from '../sailing/wind';
import { performanceOf, type ShipCondition } from '../ships/condition';
import type { WorldPoint } from '../world/projection';

const DEG = Math.PI / 180;

/**
 * The best speed made good toward a bearing (slice 2 spec §5.4): over headings within ±90° of
 * it, sampled every 5°, the steady full-sail speed in this wind times the cosine of the angle
 * off the bearing. In knots.
 */
export function speedMadeGoodKn(
  cls: ShipClass,
  condition: ShipCondition,
  wind: Wind,
  bearingRad: number,
): number {
  const performance = performanceOf(cls, condition);
  let best = 0;
  for (let off = -90; off <= 90; off += ESCAPE_SAMPLE_DEG) {
    const heading = bearingRad + off * DEG;
    const rel = relativeWindDeg(heading, wind.towardRad);
    const vmg = targetSpeedKn(performance, rel, wind.speedKn, 'full') * Math.cos(off * DEG);
    if (vmg > best) best = vmg;
  }
  return best;
}

export interface EscapeShip {
  readonly at: WorldPoint;
  readonly cls: ShipClass;
  readonly condition: ShipCondition;
}

/**
 * The chance of getting away from a chaser (slice 2 spec §5.4):
 * clamp(0.5 + (vPlayer − vEnemy) / 6, 0.1, 0.9), with the player's best speed made good
 * directly away from the enemy and the enemy's toward the player.
 */
export function escapeChance(player: EscapeShip, enemy: EscapeShip, wind: Wind): number {
  const toward = Math.atan2(player.at.y - enemy.at.y, player.at.x - enemy.at.x);
  const vPlayer = speedMadeGoodKn(player.cls, player.condition, wind, toward);
  const vEnemy = speedMadeGoodKn(enemy.cls, enemy.condition, wind, toward);
  return clamp(ESCAPE_BASE + (vPlayer - vEnemy) / ESCAPE_SPEED_DIVISOR_KN, ESCAPE_MIN, ESCAPE_MAX);
}
