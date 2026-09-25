// SPDX-License-Identifier: GPL-3.0-only
import {
  CHASE_GIVE_UP_PX,
  CHASE_MAX_HOURS,
  CHASE_REST_HOURS,
  CHASE_START_PX,
  FLEE_END_PX,
  FLEE_START_PX,
} from '../../data/encounter';
import { hostileToPlayer } from '../../data/relations';
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
import type { NpcIntent, NpcShip, NpcTack } from './npc';

const DEG = Math.PI / 180;

export interface SailContext {
  readonly wind: Wind;
  readonly hours: number;
  readonly nav: Navigator;
  /** Where the player's ship is: chasers steer for it and traders run from it. */
  readonly player: WorldPoint;
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
 * when the bearing crosses the wind axis or the tack has lasted 1.5 days. Combat passes its own
 * time (seconds) and limit; `untilHours` is then in combat seconds.
 */
export function courseFor(
  bearingRad: number,
  tack: NpcTack | null,
  wind: Wind,
  hours: number,
  maxTackTime: number = TACK_MAX_HOURS,
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
    untilHours = hours + maxTackTime;
  } else {
    const crossed =
      Math.sign(offEye) === -tack.side && Math.abs(offEye) > TACK_HYSTERESIS_DEG * DEG;
    const expired = hours >= tack.untilHours;
    side = crossed || expired ? (-tack.side as -1 | 1) : tack.side;
    untilHours = crossed || expired ? hours + maxTackTime : tack.untilHours;
  }
  return {
    headingRad: normaliseAngle(eye + side * TACK_OFF_WIND_DEG * DEG),
    tack: { side, untilHours },
  };
}

/** A pirate still loitering near home (slice 2 spec §4.4 step 4); afterwards it sails off. */
function loitering(npc: NpcShip, hours: number): boolean {
  return npc.role === 'pirate' && hours < npc.loiterUntilHours;
}

/** Where the NPC is ultimately going: its destination harbour, or its loiter point. */
function finalTarget(npc: NpcShip, nav: Navigator, hours: number): WorldPoint | null {
  if (loitering(npc, hours)) return npc.path.at(-1) ?? null;
  return nav.port(npc.destPortId)?.harbour ?? null;
}

/** Pirates, and warships of nations at war with England, hunt the player (slice 2 spec §5.2). */
export function huntsPlayer(npc: NpcShip): boolean {
  return npc.role === 'pirate' || (npc.role === 'warship' && hostileToPlayer(npc.nation));
}

/** Traders whose nation is at war with England run from the player (slice 2 spec §5.2). */
export function runsFromPlayer(npc: NpcShip): boolean {
  return npc.role === 'trader' && hostileToPlayer(npc.nation);
}

/**
 * The NPC's attitude to the player (slice 2 spec §5.2). Hunters chase within 70 px and give up
 * beyond 140 px or after 3 days (then rest for a day before hunting again); hostile traders
 * flee within 50 px and resume their voyage beyond 110 px. A ship ignoring the player does
 * neither.
 */
export function nextIntent(
  npc: NpcShip,
  player: WorldPoint,
  hours: number,
): Pick<NpcShip, 'intent' | 'intentSinceHours' | 'ignorePlayerUntilHours'> {
  const d = dist(npc.ship, player);
  const same = {
    intent: npc.intent,
    intentSinceHours: npc.intentSinceHours,
    ignorePlayerUntilHours: npc.ignorePlayerUntilHours,
  };
  const become = (intent: NpcIntent, ignoreUntil = npc.ignorePlayerUntilHours) => ({
    intent,
    intentSinceHours: hours,
    ignorePlayerUntilHours: ignoreUntil,
  });
  const ignoring = hours < npc.ignorePlayerUntilHours;
  switch (npc.intent) {
    case 'chase':
      if (ignoring || d > CHASE_GIVE_UP_PX) return become('travel');
      if (hours - npc.intentSinceHours >= CHASE_MAX_HOURS) {
        return become('travel', hours + CHASE_REST_HOURS);
      }
      return same;
    case 'flee':
      return ignoring || d > FLEE_END_PX ? become('travel') : same;
    default:
      if (ignoring) return same;
      if (huntsPlayer(npc) && d <= CHASE_START_PX) return become('chase');
      if (runsFromPlayer(npc) && d <= FLEE_START_PX) return become('flee');
      return same;
  }
}

/**
 * One AI decision (slice 2 spec §4.4, §5.2), made 10 times per second: chase or flee the
 * player when that applies, otherwise follow the path, tack when needed, find a new route when
 * stuck, and make pirates loiter near home. Pure apart from drawing from the world RNG for
 * pirates' loiter points.
 */
export function decideSailing(npc: NpcShip, ctx: SailContext): SailDecision {
  const { nav, hours } = ctx;
  const here = npc.ship;
  const attitude = nextIntent(npc, ctx.player, hours);
  if (attitude.intent === 'chase' || attitude.intent === 'flee') {
    return { npc: pursue({ ...npc, ...attitude }, ctx) };
  }
  // Back from a chase or flight: plan a fresh route from wherever the ship is now.
  const resumed = attitude.intent !== npc.intent;
  npc = { ...npc, ...attitude };
  let path = resumed ? [] : npc.path;
  while (path.length > 0 && dist(here, path[0]!) < WAYPOINT_REACHED_PX) path = path.slice(1);

  // Stuck detection: less than 3 px in 12 hours means a new route (or giving up).
  let progress = npc.progress;
  if (hours - progress.atHours >= STUCK_WINDOW_HOURS) {
    if (dist(here, progress) < STUCK_MIN_MOVE_PX) {
      const target = finalTarget({ ...npc, path }, nav, hours);
      const route = target && nav.pathBetween(here, target);
      if (!route) return { leave: 'lost' };
      path = route.slice(1);
    }
    progress = { x: here.x, y: here.y, atHours: hours };
  }

  // A pirate done loitering drops its loiter route and heads for its named port.
  const harbour = nav.port(npc.destPortId)?.harbour;
  if (npc.role === 'pirate' && !loitering(npc, hours) && harbour) {
    const last = path.at(-1);
    if (!last || last.x !== harbour.x || last.y !== harbour.y) path = [];
  }

  if (path.length === 0) {
    if (!loitering(npc, hours)) {
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

/**
 * Chase (steer straight at the player) or flee (straight away), tacking when that course lies
 * in the wind's eye. A chase that makes no progress for 12 hours (blocked by land) ends, and
 * the ship leaves the player alone for a day.
 */
function pursue(npc: NpcShip, ctx: SailContext): NpcShip {
  const { hours, player } = ctx;
  const here = npc.ship;
  let progress = npc.progress;
  if (hours - progress.atHours >= STUCK_WINDOW_HOURS) {
    if (dist(here, progress) < STUCK_MIN_MOVE_PX) {
      return {
        ...npc,
        intent: 'travel',
        intentSinceHours: hours,
        ignorePlayerUntilHours: hours + CHASE_REST_HOURS,
        path: [],
        progress: { x: here.x, y: here.y, atHours: hours },
      };
    }
    progress = { x: here.x, y: here.y, atHours: hours };
  }
  const toward = Math.atan2(player.y - here.y, player.x - here.x);
  const bearing = npc.intent === 'flee' ? normaliseAngle(toward + Math.PI) : toward;
  const course = courseFor(bearing, npc.tack, ctx.wind, hours);
  return {
    ...npc,
    progress,
    tack: course.tack,
    targetHeadingRad: course.headingRad,
    ship: here.sail === 'full' ? here : { ...here, sail: 'full' },
  };
}
