// SPDX-License-Identifier: GPL-3.0-only
import {
  NPC_ARRIVAL_PX,
  PIRATE_LOITER_RADIUS_PX,
  STEER_DEAD_BAND_DEG,
  STUCK_MIN_MOVE_PX,
  STUCK_WINDOW_HOURS,
  TACK_HYSTERESIS_DEG,
  TACK_MAX_HOURS,
  TACK_OFF_WIND_DEG,
  TACK_REL_DEG,
  WAYPOINT_REACHED_PX,
} from '../../data/npc';
import { angleDiff, normaliseAngle } from '../math';
import type { Rng } from '../rng';
import { relativeWindDeg } from '../sailing/polar';
import type { ShipInput } from '../sailing/ship';
import type { Wind } from '../sailing/wind';
import type { WorldPoint } from '../world/projection';
import type { Navigator } from './navigator';
import type { NpcShip, NpcTack } from './npc';

const DEG = Math.PI / 180;

export interface SailContext {
  readonly wind: Wind;
  readonly hours: number;
  readonly nav: Navigator;
  /** Drawn from only when a pirate needs a new place to loiter. */
  readonly rng: () => Rng;
}

/** What the AI decided: carry on with the updated ship, or leave the map (entered port, lost). */
export type SailDecision = { readonly npc: NpcShip } | { readonly leave: 'arrived' | 'lost' };

function dist(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The helmsman, every physics step: turn toward the target course outside a ±4° dead band. */
export function helmInput(npc: NpcShip): ShipInput {
  const error = angleDiff(npc.targetHeadingRad, npc.ship.headingRad);
  const band = STEER_DEAD_BAND_DEG * DEG;
  return { turnLeft: error < -band, turnRight: error > band };
}

/**
 * The course toward a bearing with the wind (slice 2 spec §4.4 step 2). When the bearing is
 * within 40° of the wind's eye, sail close-hauled (45° off the eye) on one tack, and change tack
 * when the bearing crosses the wind axis or the tack has lasted 1.5 days.
 */
export function courseFor(
  bearingRad: number,
  tack: NpcTack | null,
  wind: Wind,
  hours: number,
): { headingRad: number; tack: NpcTack | null } {
  if (relativeWindDeg(bearingRad, wind.towardRad) <= TACK_REL_DEG) {
    return { headingRad: bearingRad, tack: null };
  }
  const eye = normaliseAngle(wind.towardRad + Math.PI);
  const offEye = angleDiff(bearingRad, eye);
  let side: -1 | 1;
  let untilHours: number;
  if (!tack) {
    side = offEye >= 0 ? 1 : -1;
    untilHours = hours + TACK_MAX_HOURS;
  } else {
    const crossed =
      Math.sign(offEye) === -tack.side && Math.abs(offEye) > TACK_HYSTERESIS_DEG * DEG;
    const expired = hours >= tack.untilHours;
    side = crossed || expired ? (-tack.side as -1 | 1) : tack.side;
    untilHours = crossed || expired ? hours + TACK_MAX_HOURS : tack.untilHours;
  }
  return {
    headingRad: normaliseAngle(eye + side * TACK_OFF_WIND_DEG * DEG),
    tack: { side, untilHours },
  };
}

/** Where the NPC is ultimately going: its destination harbour, or (pirates) its loiter point. */
function finalTarget(npc: NpcShip, nav: Navigator): WorldPoint | null {
  if (npc.role === 'pirate') return npc.path.at(-1) ?? null;
  return nav.port(npc.destPortId)?.harbour ?? null;
}

/**
 * One AI decision for travelling NPCs (slice 2 spec §4.4), made 10 times per second: follow the
 * path, tack when needed, find a new route when stuck, and make pirates loiter near home.
 * Pure apart from drawing from the world RNG for pirates' loiter points.
 */
export function decideSailing(npc: NpcShip, ctx: SailContext): SailDecision {
  const { nav, hours } = ctx;
  const here = npc.ship;
  let path = npc.path;
  while (path.length > 0 && dist(here, path[0]!) < WAYPOINT_REACHED_PX) path = path.slice(1);

  // Stuck detection: less than 3 px in 12 hours means a new route (or giving up).
  let progress = npc.progress;
  if (hours - progress.atHours >= STUCK_WINDOW_HOURS) {
    if (dist(here, progress) < STUCK_MIN_MOVE_PX) {
      const target = finalTarget({ ...npc, path }, nav);
      const route = target && nav.pathBetween(here, target);
      if (!route) return { leave: 'lost' };
      path = route.slice(1);
    }
    progress = { x: here.x, y: here.y, atHours: hours };
  }

  if (path.length === 0) {
    if (npc.role !== 'pirate') {
      const harbour = nav.port(npc.destPortId)?.harbour;
      if (!harbour) return { leave: 'lost' };
      if (dist(here, harbour) <= NPC_ARRIVAL_PX) return { leave: 'arrived' };
      const route = nav.pathBetween(here, harbour);
      if (!route) return { leave: 'lost' };
      path = route.slice(1);
    } else {
      const spot = nav.randomCellNear(npc.home, PIRATE_LOITER_RADIUS_PX, ctx.rng());
      const route = spot && nav.pathBetween(here, spot);
      if (route) path = route.slice(1);
    }
  }

  const next = path[0];
  if (!next) {
    return { npc: { ...npc, path, progress, targetHeadingRad: here.headingRad } };
  }
  const bearing = Math.atan2(next.y - here.y, next.x - here.x);
  const course = courseFor(bearing, npc.tack, ctx.wind, hours);
  return {
    npc: {
      ...npc,
      path,
      progress,
      tack: course.tack,
      targetHeadingRad: course.headingRad,
      ship: here.sail === 'full' ? here : { ...here, sail: 'full' },
    },
  };
}
