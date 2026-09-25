// SPDX-License-Identifier: GPL-3.0-only
import {
  CONTACT_SAMPLES,
  CREW_LOSS_RANGE,
  DAMAGE_REF_HULL_STRENGTH,
  GUN_LOSS_CHANCE,
  HIT_WEIGHTS,
  HULL_DAMAGE_RANGE,
  RIGGING_DAMAGE_RANGE,
} from '../../data/combat';
import type { ShipClass } from '../../data/ships';
import { pickWeighted, randInt, randRange } from '../random';
import type { Rng } from '../rng';
import type { SailingShip } from '../sailing/ship';
import { damageCondition, type ShipCondition } from '../ships/condition';

export type HitLocation = 'hull' | 'rigging' | 'crew';

export interface HitResult {
  readonly location: HitLocation;
  readonly condition: ShipCondition;
  readonly gunLost: boolean;
}

/**
 * Where a ball strikes and what it does (spec §6.5): hull 55, rigging 30, crew 15. Hull and
 * rigging damage is scaled by 60 / hullStrength, so bigger ships shrug off more. Low, spent
 * shot (`low`) cannot reach the rigging. All values are clamped at 0.
 */
export function resolveHit(
  cls: ShipClass,
  condition: ShipCondition,
  rng: Rng,
  low: boolean,
): HitResult {
  const location = pickWeighted<HitLocation>(rng, [
    ['hull', HIT_WEIGHTS.hull],
    ['rigging', low ? 0 : HIT_WEIGHTS.rigging],
    ['crew', HIT_WEIGHTS.crew],
  ])!;
  const scale = DAMAGE_REF_HULL_STRENGTH / cls.hullStrength;
  switch (location) {
    case 'hull': {
      const hullPct = randRange(rng, HULL_DAMAGE_RANGE[0], HULL_DAMAGE_RANGE[1]) * scale;
      const gunLost = condition.gunsIntact > 0 && rng() < GUN_LOSS_CHANCE;
      return {
        location,
        condition: damageCondition(condition, { hullPct, guns: gunLost ? 1 : 0 }),
        gunLost,
      };
    }
    case 'rigging': {
      const riggingPct = randRange(rng, RIGGING_DAMAGE_RANGE[0], RIGGING_DAMAGE_RANGE[1]) * scale;
      return { location, condition: damageCondition(condition, { riggingPct }), gunLost: false };
    }
    case 'crew': {
      const crew = randInt(rng, CREW_LOSS_RANGE[0], CREW_LOSS_RANGE[1]);
      return { location, condition: damageCondition(condition, { crew }), gunLost: false };
    }
  }
}

/** True when a point lies inside a ship's hull ellipse (length along the heading). */
export function insideHull(
  ship: SailingShip,
  lengthPx: number,
  beamPx: number,
  x: number,
  y: number,
): boolean {
  const dx = x - ship.x;
  const dy = y - ship.y;
  const c = Math.cos(ship.headingRad);
  const s = Math.sin(ship.headingRad);
  const along = (dx * c + dy * s) / (lengthPx / 2);
  const across = (-dx * s + dy * c) / (beamPx / 2);
  return along * along + across * across <= 1;
}

interface Hull {
  readonly ship: SailingShip;
  readonly lengthPx: number;
  readonly beamPx: number;
}

function anyEdgePointInside(a: Hull, b: Hull): boolean {
  const c = Math.cos(a.ship.headingRad);
  const s = Math.sin(a.ship.headingRad);
  for (let i = 0; i < CONTACT_SAMPLES; i++) {
    const t = (i / CONTACT_SAMPLES) * Math.PI * 2;
    const u = (Math.cos(t) * a.lengthPx) / 2;
    const v = (Math.sin(t) * a.beamPx) / 2;
    if (
      insideHull(b.ship, b.lengthPx, b.beamPx, a.ship.x + u * c - v * s, a.ship.y + u * s + v * c)
    ) {
      return true;
    }
  }
  return false;
}

/** True when two hull ellipses touch or overlap (sampled on both outlines and centres). */
export function hullsTouch(a: Hull, b: Hull): boolean {
  if (insideHull(b.ship, b.lengthPx, b.beamPx, a.ship.x, a.ship.y)) return true;
  if (insideHull(a.ship, a.lengthPx, a.beamPx, b.ship.x, b.ship.y)) return true;
  return anyEdgePointInside(a, b) || anyEdgePointInside(b, a);
}
