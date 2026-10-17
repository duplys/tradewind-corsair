// SPDX-License-Identifier: GPL-3.0-only
import { DOCK_RADIUS_PX } from '../../data/sailing';
import {
  TIP_GOLD,
  TREASURE_DIG_HOURS,
  TREASURE_DIG_RADIUS_PX,
  TREASURE_EMPTY_CHANCE,
  TREASURE_GOLD_MAX,
  TREASURE_GOLD_MIN,
  TREASURE_MAX_ACTIVE,
  TREASURE_MAX_DIST_PX,
  TREASURE_MIN_DIST_PX,
  TREASURE_PLACEMENT_TRIES,
  TREASURE_PORT_CLEARANCE_PX,
  TREASURE_SITE_CLEARANCE_PX,
} from '../../data/tavern';
import { TAU } from '../math';
import { randInt, randRange } from '../random';
import { restoreRng, type Rng } from '../rng';
import { nearestHarbourWater, nearestLand } from '../world/search';
import type { Port } from '../world/ports';
import type { World } from '../world/world';
import type { Voyage } from '../voyage';

/** A buried hoard the tavern told the player about: a land pixel, world px. */
export interface TreasureSite {
  readonly x: number;
  readonly y: number;
}

export type TipResult =
  | { readonly ok: true; readonly voyage: Voyage; readonly site: TreasureSite }
  | { readonly ok: false; readonly reason: 'gold' | 'full' | 'nothing' };

/**
 * Pick a spot on land some days' sail from `from`, away from every harbour and every other
 * site, with open water beside it where a ship can lie. Null if the tries run out.
 */
export function placeSite(
  world: World,
  ports: readonly Port[],
  existing: readonly TreasureSite[],
  from: Port,
  rng: Rng,
): TreasureSite | null {
  const clearOfPorts = Math.max(TREASURE_PORT_CLEARANCE_PX, DOCK_RADIUS_PX * 2);
  for (let i = 0; i < TREASURE_PLACEMENT_TRIES; i++) {
    const angle = rng() * TAU;
    const dist = randRange(rng, TREASURE_MIN_DIST_PX, TREASURE_MAX_DIST_PX);
    const land = nearestLand(
      world,
      from.town.x + Math.cos(angle) * dist,
      from.town.y + Math.sin(angle) * dist,
    );
    if (!land) continue;
    const water = nearestHarbourWater(world, land.x, land.y);
    if (!water || Math.hypot(water.x - land.x, water.y - land.y) > TREASURE_DIG_RADIUS_PX - 2) {
      continue;
    }
    if (ports.some((p) => Math.hypot(p.harbour.x - land.x, p.harbour.y - land.y) < clearOfPorts)) {
      continue;
    }
    if (existing.some((s) => Math.hypot(s.x - land.x, s.y - land.y) < TREASURE_SITE_CLEARANCE_PX)) {
      continue;
    }
    return { x: land.x, y: land.y };
  }
  return null;
}

/** Pay for a tip. Uses the world RNG (its state moves on) so the same voyage places it the same. */
export function buyTreasureTip(
  voyage: Voyage,
  world: World,
  ports: readonly Port[],
  here: Port,
): TipResult {
  if (voyage.gold < TIP_GOLD) return { ok: false, reason: 'gold' };
  if (voyage.treasures.length >= TREASURE_MAX_ACTIVE) return { ok: false, reason: 'full' };
  const rng = restoreRng(voyage.rngState);
  const site = placeSite(world, ports, voyage.treasures, here, rng);
  if (!site) return { ok: false, reason: 'nothing' };
  return {
    ok: true,
    site,
    voyage: {
      ...voyage,
      gold: voyage.gold - TIP_GOLD,
      treasures: [...voyage.treasures, site],
      rngState: rng.state(),
    },
  };
}

/** The site the ship is close enough to dig at, or null. */
export function siteInReach(voyage: Voyage): TreasureSite | null {
  const { x, y } = voyage.ship;
  for (const site of voyage.treasures) {
    if (Math.hypot(site.x - x, site.y - y) <= TREASURE_DIG_RADIUS_PX) return site;
  }
  return null;
}

export interface DigResult {
  readonly voyage: Voyage;
  /** Gold found; 0 when the hole is empty. */
  readonly found: number;
}

/** Dig at `site`: six hours pass, the site is used up, and the hoard is there (usually). */
export function digTreasure(voyage: Voyage, site: TreasureSite): DigResult {
  const rng = restoreRng(voyage.rngState);
  const found =
    rng() < TREASURE_EMPTY_CHANCE ? 0 : randInt(rng, TREASURE_GOLD_MIN, TREASURE_GOLD_MAX);
  return {
    found,
    voyage: {
      ...voyage,
      gold: voyage.gold + found,
      elapsedHours: voyage.elapsedHours + TREASURE_DIG_HOURS,
      treasures: voyage.treasures.filter((s) => s !== site),
      rngState: rng.state(),
    },
  };
}
