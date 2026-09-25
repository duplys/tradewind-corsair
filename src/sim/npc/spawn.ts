// SPDX-License-Identifier: GPL-3.0-only
import type { NationId } from '../../data/nations';
import {
  GALLEON_PORT_IDS,
  NPC_CREW_SHARE_RANGE,
  NPC_HULL_PCT_RANGE,
  NPC_LANE_PORT_RADIUS_PX,
  NPC_LANE_SAMPLE_PX,
  NPC_LANE_SHARE,
  NPC_MIN_TRIP_PX,
  NPC_NATION_PORT_RADIUS_PX,
  NPC_PIRATE_CHANCE,
  NPC_RIGGING_PCT_RANGE,
  NPC_SPAWN_MAX_PX,
  NPC_SPAWN_MIN_PX,
  NPC_SPAWN_SPEED_SHARE,
  NPC_TRADER_CREW_FACTOR,
  PIRATE_CLASS_WEIGHTS,
  PIRATE_LOITER_HOURS,
  ROLE_WEIGHTS,
  TRADER_CLASS_WEIGHTS,
  WARSHIP_CLASS_WEIGHTS,
  type NpcRole,
  type Weighted,
} from '../../data/npc';
import type { Allegiance } from '../../data/relations';
import { SHIP_CLASSES, type ShipClassId } from '../../data/ships';
import { SHIP_NAMES } from '../../data/shipNames';
import { normaliseAngle, TAU } from '../math';
import { pick, pickWeighted, randRange } from '../random';
import type { Rng } from '../rng';
import type { Port } from '../world/ports';
import type { WorldPoint } from '../world/projection';
import { isLand } from '../world/world';
import { cellCentre } from './navGrid';
import type { Navigator } from './navigator';
import type { NpcShip } from './npc';

export interface SpawnContext {
  readonly nav: Navigator;
  readonly player: WorldPoint;
  readonly hours: number;
  readonly rng: Rng;
  readonly id: number;
  /** Names already at sea, so two ships in sight do not share one. */
  readonly namesInUse: ReadonlySet<string>;
}

const LANE_TRIES = 6;

function dist(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearestPort(ports: readonly Port[], p: WorldPoint): Port {
  let best = ports[0]!;
  for (const port of ports) if (dist(port.harbour, p) < dist(best.harbour, p)) best = port;
  return best;
}

/** A point on a sea lane between two ports near the player, 140–240 px from the player. */
function laneSpot(ctx: SpawnContext): { at: WorldPoint; origin: Port } | null {
  const { nav, player, rng } = ctx;
  const near = nav.ports.filter((p) => dist(p.harbour, player) <= NPC_LANE_PORT_RADIUS_PX);
  if (near.length < 2) return null;
  for (let t = 0; t < LANE_TRIES; t++) {
    const a = pick(rng, near);
    const b = pick(
      rng,
      near.filter((p) => p !== a),
    );
    const path = nav.portPath(a.def.id, b.def.id);
    if (!path) continue;
    const spots: WorldPoint[] = [];
    for (let i = 1; i < path.length; i++) {
      const p = path[i - 1]!;
      const q = path[i]!;
      const n = Math.max(1, Math.floor(dist(p, q) / NPC_LANE_SAMPLE_PX));
      for (let s = 0; s < n; s++) {
        const at = { x: p.x + ((q.x - p.x) * s) / n, y: p.y + ((q.y - p.y) * s) / n };
        const d = dist(at, player);
        if (d >= NPC_SPAWN_MIN_PX && d <= NPC_SPAWN_MAX_PX) spots.push(at);
      }
    }
    if (spots.length > 0) return { at: pick(rng, spots), origin: a };
  }
  return null;
}

/** A random navigable cell 140–240 px from the player. */
function openSpot(ctx: SpawnContext): WorldPoint | null {
  const cells = ctx.nav.cellsWithin(ctx.player, NPC_SPAWN_MIN_PX, NPC_SPAWN_MAX_PX);
  if (cells.length === 0) return null;
  return cellCentre(ctx.nav.grid, pick(ctx.rng, cells));
}

/** Nation by the ports within 300 px (weight 1 / distance), else the nearest port's (§4.3). */
function chooseNation(ctx: SpawnContext, at: WorldPoint): Allegiance {
  if (ctx.rng() < NPC_PIRATE_CHANCE) return 'pirate';
  const weights = new Map<NationId, number>();
  for (const port of ctx.nav.ports) {
    const d = dist(port.harbour, at);
    if (d > NPC_NATION_PORT_RADIUS_PX) continue;
    weights.set(port.def.nation, (weights.get(port.def.nation) ?? 0) + 1 / Math.max(d, 1));
  }
  if (weights.size === 0) return nearestPort(ctx.nav.ports, at).def.nation;
  const entries = [...weights].sort(([a], [b]) => a.localeCompare(b));
  return pickWeighted(ctx.rng, entries)!;
}

function classWeights(nation: Allegiance, role: NpcRole): Weighted<ShipClassId> {
  if (nation === 'pirate' || role === 'pirate') return PIRATE_CLASS_WEIGHTS;
  return role === 'trader' ? TRADER_CLASS_WEIGHTS[nation] : WARSHIP_CLASS_WEIGHTS[nation];
}

/**
 * A new NPC ship near the player (slice 2 spec §4.3), or null if no suitable place or
 * destination was found. Deterministic for a given RNG state.
 */
export function spawnNpc(ctx: SpawnContext): NpcShip | null {
  const { nav, rng } = ctx;
  const lane = rng() < NPC_LANE_SHARE ? laneSpot(ctx) : null;
  const at = lane?.at ?? openSpot(ctx);
  if (!at || isLand(nav.world, at.x, at.y)) return null;
  const origin = lane?.origin ?? nearestPort(nav.ports, at);

  const nation = chooseNation(ctx, at);
  const role: NpcRole = nation === 'pirate' ? 'pirate' : pickWeighted(rng, ROLE_WEIGHTS[nation])!;

  // Destination: a port of the same nation (not right here); pirates name any port but loiter.
  const farEnough = (p: Port) => dist(p.harbour, at) >= NPC_MIN_TRIP_PX;
  const choices =
    nation === 'pirate'
      ? nav.ports.filter(farEnough)
      : nav.ports.filter((p) => p.def.nation === nation && farEnough(p));
  if (choices.length === 0) return null;
  const dest = pick(rng, choices);

  const treasureRun =
    GALLEON_PORT_IDS.includes(dest.def.id) || GALLEON_PORT_IDS.includes(origin.def.id);
  const weights = classWeights(nation, role).filter(([id]) => id !== 'galleon' || treasureRun);
  const classId = pickWeighted(rng, weights);
  if (!classId) return null;
  const cls = SHIP_CLASSES[classId];

  const crewShare =
    randRange(rng, NPC_CREW_SHARE_RANGE[0], NPC_CREW_SHARE_RANGE[1]) *
    (role === 'trader' ? NPC_TRADER_CREW_FACTOR : 1);
  const condition = {
    hullPct: randRange(rng, NPC_HULL_PCT_RANGE[0], NPC_HULL_PCT_RANGE[1]),
    riggingPct: randRange(rng, NPC_RIGGING_PCT_RANGE[0], NPC_RIGGING_PCT_RANGE[1]),
    crew: Math.min(cls.crewMax, Math.floor(cls.crewTypical * crewShare)),
    gunsIntact: cls.guns,
  };

  const names = SHIP_NAMES[nation].filter((n) => !ctx.namesInUse.has(n));
  const name = pick(rng, names.length > 0 ? names : SHIP_NAMES[nation]);

  let path: readonly WorldPoint[] = [];
  let headingRad = normaliseAngle(rng() * TAU);
  if (role !== 'pirate') {
    const route = nav.pathBetween(at, dest.harbour);
    if (!route) return null;
    path = route.slice(1);
    const next = path[0] ?? dest.harbour;
    headingRad = Math.atan2(next.y - at.y, next.x - at.x);
  }

  return {
    id: ctx.id,
    classId,
    nation,
    role,
    name,
    ship: {
      x: at.x,
      y: at.y,
      headingRad,
      speedKn: cls.maxSpeedKn * NPC_SPAWN_SPEED_SHARE,
      sail: 'full',
    },
    condition,
    destPortId: dest.def.id,
    path,
    tack: null,
    intent: 'travel',
    intentSinceHours: ctx.hours,
    ignorePlayerUntilHours: 0,
    home: { x: at.x, y: at.y },
    loiterUntilHours: role === 'pirate' ? ctx.hours + PIRATE_LOITER_HOURS : 0,
    targetHeadingRad: headingRad,
    progress: { x: at.x, y: at.y, atHours: ctx.hours },
  };
}
