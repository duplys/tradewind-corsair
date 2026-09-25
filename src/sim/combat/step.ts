// SPDX-License-Identifier: GPL-3.0-only
import {
  BALL_LOW_SHARE,
  BALL_RANGE_PX,
  BALL_SPEED_PX_PER_SEC,
  BALL_SPREAD_DEG,
  BOARDING_CONTACT_SEC,
  BOARDING_REL_SPEED_KN,
  BROADSIDE_SPAN_SHARE,
  COMBAT_SAILING_SCALE,
  ESCAPE_DISTANCE_PX,
  MAX_BALLS,
  RIPPLE_INTERVAL_SEC,
  SINKING_SEC,
  STRIKE_CREW_ADVANTAGE,
  STRIKE_CREW_SHARE,
  STRIKE_HULL_PCT,
  TRADER_STRIKE_HITS,
  TRADER_STRIKE_HULL_PCT,
  TRADER_STRIKE_RANGE_PX,
  TRADER_STRIKE_RIGGING_PCT,
} from '../../data/combat';
import { SHIP_CLASSES } from '../../data/ships';
import { angleDiff } from '../math';
import { randRange } from '../random';
import { changeSail, stepShip, type StepParams } from '../sailing/ship';
import { gunsMannedPerBroadside, performanceOf, reloadTimeSec } from '../ships/condition';
import { hullsTouch, insideHull, resolveHit, type HitLocation } from './hits';
import type { BroadsideSide, CombatShip, CombatState } from './state';

const DEG = Math.PI / 180;

/** Physics parameters for a ship, recomputed only when its condition object changes. */
function paramsFor(ship: CombatShip): StepParams {
  if (ship.physics?.condition !== ship.condition) {
    ship.physics = {
      condition: ship.condition,
      params: {
        performance: performanceOf(SHIP_CLASSES[ship.classId], ship.condition),
        scale: COMBAT_SAILING_SCALE,
      },
    };
  }
  return ship.physics.params;
}

/** What one ship wants to do this step. */
export interface CombatInput {
  readonly turnLeft: boolean;
  readonly turnRight: boolean;
  /** Hoist (+1) or reef (−1) one step, or leave the sail (0). */
  readonly sail: -1 | 0 | 1;
  /** Fire one side, or the side that bears on the enemy, or hold fire. */
  readonly fire: BroadsideSide | 'bearing' | null;
}

/** Do nothing: no helm, no sail change, no fire. */
export const HOLD: CombatInput = { turnLeft: false, turnRight: false, sail: 0, fire: null };

export type CombatEvent =
  | {
      readonly type: 'shot';
      readonly ship: 0 | 1;
      readonly side: BroadsideSide;
      readonly x: number;
      readonly y: number;
      readonly angleRad: number;
    }
  /** Fire was ordered on a side that is not ready (the HUD flashes it). */
  | { readonly type: 'notReady'; readonly ship: 0 | 1; readonly side: BroadsideSide }
  | { readonly type: 'splash'; readonly x: number; readonly y: number }
  | {
      readonly type: 'hit';
      readonly ship: 0 | 1;
      readonly location: HitLocation;
      readonly gunLost: boolean;
      readonly x: number;
      readonly y: number;
    }
  | { readonly type: 'sinking'; readonly ship: 0 | 1 }
  | { readonly type: 'struck'; readonly ship: 0 | 1 }
  | { readonly type: 'ended' };

/** The side on which `target` lies: port when its relative bearing is in (−180°, 0°). */
export function sideFacing(ship: CombatShip, target: CombatShip): BroadsideSide {
  const bearing = Math.atan2(target.ship.y - ship.ship.y, target.ship.x - ship.ship.x);
  const rel = angleDiff(bearing, ship.ship.headingRad);
  return rel < 0 && rel > -Math.PI ? 'port' : 'starboard';
}

function canFight(ship: CombatShip): boolean {
  return !ship.struck && ship.sinkingSec === null;
}

/** Start a broadside if that side is loaded and manned; false if it cannot fire now. */
function orderFire(ship: CombatShip, side: BroadsideSide): boolean {
  if (!canFight(ship) || ship.reloadSec[side] > 0 || ship.volley[side]) return false;
  const guns = gunsMannedPerBroadside(ship.condition);
  if (guns <= 0) return false;
  ship.volley[side] = { total: guns, fired: 0, untilNextSec: 0 };
  return true;
}

/** Launch the balls that are due from a rippling broadside; start reloading after the last. */
function advanceVolley(
  state: CombatState,
  ship: CombatShip,
  side: BroadsideSide,
  dt: number,
  events: CombatEvent[],
): void {
  const volley = ship.volley[side];
  if (!volley) return;
  const cls = SHIP_CLASSES[ship.classId];
  const { x, y, headingRad, speedKn } = ship.ship;
  const cos = Math.cos(headingRad);
  const sin = Math.sin(headingRad);
  const outward = side === 'port' ? -1 : 1; // port is to the left: heading − 90°
  const shipVx = speedKn * COMBAT_SAILING_SCALE.pxPerSecPerKnot * cos;
  const shipVy = speedKn * COMBAT_SAILING_SCALE.pxPerSecPerKnot * sin;
  volley.untilNextSec -= dt;
  while (volley.fired < volley.total && volley.untilNextSec <= 0) {
    // Gunports evenly along the middle 70 % of the hull, from bow to stern.
    const span = cls.lengthPx * BROADSIDE_SPAN_SHARE;
    const along = volley.total === 1 ? 0 : span / 2 - (span * volley.fired) / (volley.total - 1);
    const gx = x + cos * along - sin * outward * (cls.beamPx / 2);
    const gy = y + sin * along + cos * outward * (cls.beamPx / 2);
    const spread = randRange(state.rng, -BALL_SPREAD_DEG, BALL_SPREAD_DEG) * DEG;
    const angle = headingRad + outward * (Math.PI / 2) + spread;
    const vx = Math.cos(angle) * BALL_SPEED_PX_PER_SEC + shipVx;
    const vy = Math.sin(angle) * BALL_SPEED_PX_PER_SEC + shipVy;
    state.balls.launch(ship.index, gx, gy, vx, vy);
    events.push({ type: 'shot', ship: ship.index, side, x: gx, y: gy, angleRad: angle });
    volley.fired++;
    volley.untilNextSec += RIPPLE_INTERVAL_SEC;
  }
  if (volley.fired >= volley.total) {
    ship.volley[side] = null;
    ship.reloadSec[side] = reloadTimeSec(ship.condition);
  }
}

function strike(ship: CombatShip, events: CombatEvent[]): void {
  if (ship.struck || ship.sinkingSec !== null) return;
  ship.struck = true;
  ship.volley.port = ship.volley.starboard = null;
  ship.ship = { ...ship.ship, sail: 'furled' };
  events.push({ type: 'struck', ship: ship.index });
}

function distance(a: CombatShip, b: CombatShip): number {
  return Math.hypot(a.ship.x - b.ship.x, a.ship.y - b.ship.y);
}

/** Move balls, resolve hits (at most one per ball, never on the firing ship) and splashes. */
function moveBalls(state: CombatState, dt: number, events: CombatEvent[]): void {
  const { balls, ships } = state;
  for (let i = 0; i < MAX_BALLS; i++) {
    if (!balls.active[i]) continue;
    const speed = Math.hypot(balls.vx[i]!, balls.vy[i]!);
    balls.x[i] = balls.x[i]! + balls.vx[i]! * dt;
    balls.y[i] = balls.y[i]! + balls.vy[i]! * dt;
    balls.flown[i] = balls.flown[i]! + speed * dt;
    const bx = balls.x[i]!;
    const by = balls.y[i]!;
    const target = ships[balls.owner[i] === 0 ? 1 : 0];
    const cls = SHIP_CLASSES[target.classId];
    if (target.sinkingSec === null && insideHull(target.ship, cls.lengthPx, cls.beamPx, bx, by)) {
      balls.active[i] = 0;
      const low = balls.flown[i]! >= BALL_RANGE_PX * (1 - BALL_LOW_SHARE);
      const before = target.condition;
      const hit = resolveHit(cls, before, state.rng, low);
      target.condition = hit.condition;
      target.hitsTaken++;
      state.lastHitSec = state.timeSec;
      events.push({
        type: 'hit',
        ship: target.index,
        location: hit.location,
        gunLost: hit.gunLost,
        x: bx,
        y: by,
      });
      if (target.condition.hullPct <= 0 && target.sinkingSec === null) {
        target.sinkingSec = 0;
        target.volley.port = target.volley.starboard = null;
        events.push({ type: 'sinking', ship: target.index });
      } else if (
        target.index === 1 &&
        target.role === 'trader' &&
        hit.location === 'rigging' &&
        before.riggingPct >= TRADER_STRIKE_RIGGING_PCT &&
        target.condition.riggingPct < TRADER_STRIKE_RIGGING_PCT &&
        distance(target, ships[0]) <= TRADER_STRIKE_RANGE_PX
      ) {
        strike(target, events); // a trader's heart fails at the first bad rigging hit
      }
      continue;
    }
    if (balls.flown[i]! >= BALL_RANGE_PX) {
      balls.active[i] = 0;
      events.push({ type: 'splash', x: bx, y: by });
    }
  }
}

/** Relative speed of the two ships, in knots. */
function relativeSpeedKn(a: CombatShip, b: CombatShip): number {
  const vx =
    a.ship.speedKn * Math.cos(a.ship.headingRad) - b.ship.speedKn * Math.cos(b.ship.headingRad);
  const vy =
    a.ship.speedKn * Math.sin(a.ship.headingRad) - b.ship.speedKn * Math.sin(b.ship.headingRad);
  return Math.hypot(vx, vy);
}

function hull(ship: CombatShip) {
  const cls = SHIP_CLASSES[ship.classId];
  return { ship: ship.ship, lengthPx: cls.lengthPx, beamPx: cls.beamPx };
}

/** Hulls can only touch when the centres are closer than half the two lengths together. */
function mayTouch(a: CombatShip, b: CombatShip): boolean {
  const reach = (SHIP_CLASSES[a.classId].lengthPx + SHIP_CLASSES[b.classId].lengthPx) / 2;
  return distance(a, b) <= reach;
}

/** Push touching ships apart along the line between their centres, until they just touch. */
function separate(a: CombatShip, b: CombatShip): void {
  for (let n = 0; n < 60 && hullsTouch(hull(a), hull(b)); n++) {
    let dx = b.ship.x - a.ship.x;
    let dy = b.ship.y - a.ship.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) {
      dx = 1;
      dy = 0;
    } else {
      dx /= d;
      dy /= d;
    }
    a.ship = { ...a.ship, x: a.ship.x - dx * 0.25, y: a.ship.y - dy * 0.25 };
    b.ship = { ...b.ship, x: b.ship.x + dx * 0.25, y: b.ship.y + dy * 0.25 };
  }
}

/** Speed away from the other ship along the line between them, in knots (negative: closing). */
function openingSpeedKn(ship: CombatShip, other: CombatShip): number {
  const d = distance(ship, other) || 1;
  const ux = (ship.ship.x - other.ship.x) / d;
  const uy = (ship.ship.y - other.ship.y) / d;
  const h = ship.ship.headingRad;
  return ship.ship.speedKn * (Math.cos(h) * ux + Math.sin(h) * uy);
}

const NO_EVENTS: readonly CombatEvent[] = Object.freeze([]);

/**
 * Advance the fight by one fixed step (spec §6). Mutates `state` and returns what happened.
 * Pure in the sense that matters: no browser APIs, and all chance comes from the fight's own
 * RNG, so the same state and inputs always give the same fight.
 */
export function stepCombat(
  state: CombatState,
  playerInput: CombatInput,
  enemyInput: CombatInput,
  dtSec: number,
): readonly CombatEvent[] {
  if (state.outcome) return NO_EVENTS;
  const events: CombatEvent[] = [];
  state.timeSec += dtSec;
  const [player, enemy] = state.ships;
  const inputs = [playerInput, enemyInput] as const;

  for (const ship of state.ships) {
    const input = inputs[ship.index];
    const other = state.ships[ship.index === 0 ? 1 : 0];
    if (canFight(ship)) {
      if (input.sail !== 0)
        ship.ship = { ...ship.ship, sail: changeSail(ship.ship.sail, input.sail) };
      if (input.fire) {
        const side = input.fire === 'bearing' ? sideFacing(ship, other) : input.fire;
        if (!orderFire(ship, side)) events.push({ type: 'notReady', ship: ship.index, side });
      }
    }
    // A sinking ship lies dead in the water; a struck one drifts with furled sails.
    if (ship.sinkingSec === null) {
      const helm = canFight(ship) ? input : HOLD;
      ship.ship = stepShip(ship.ship, helm, state.wind, null, dtSec, paramsFor(ship)).ship;
    }
    for (const side of ['port', 'starboard'] as const) {
      ship.reloadSec[side] = Math.max(0, ship.reloadSec[side] - dtSec);
      advanceVolley(state, ship, side, dtSec, events);
    }
  }

  moveBalls(state, dtSec, events);

  // End conditions, in the spec's order (§6.6).
  for (const ship of state.ships) {
    if (ship.sinkingSec === null) continue;
    ship.sinkingSec += dtSec;
    if (ship.sinkingSec >= SINKING_SEC) state.outcome = { type: 'sunk', shipIndex: ship.index };
  }
  if (!state.outcome && canFight(enemy)) {
    const c = enemy.condition;
    const trader = enemy.role === 'trader';
    if (
      c.crew < STRIKE_CREW_SHARE * enemy.startCrew ||
      (c.hullPct < STRIKE_HULL_PCT && player.condition.crew > STRIKE_CREW_ADVANTAGE * c.crew) ||
      (trader && (c.hullPct < TRADER_STRIKE_HULL_PCT || enemy.hitsTaken >= TRADER_STRIKE_HITS))
    ) {
      strike(enemy, events);
    }
  }
  if (!state.outcome && player.sinkingSec === null && enemy.sinkingSec === null) {
    if (mayTouch(player, enemy) && hullsTouch(hull(player), hull(enemy))) {
      state.contactSec += dtSec;
      if (
        relativeSpeedKn(player, enemy) < BOARDING_REL_SPEED_KN ||
        state.contactSec > BOARDING_CONTACT_SEC
      ) {
        // The ship that set out to board attacks; otherwise the one that ran alongside, i.e.
        // closing faster (ADR 013).
        const playerBoards = player.ai.mode === 'board';
        const enemyBoards = enemy.ai.mode === 'board';
        const attacker =
          playerBoards !== enemyBoards
            ? enemyBoards
              ? 1
              : 0
            : openingSpeedKn(enemy, player) < openingSpeedKn(player, enemy)
              ? 1
              : 0;
        // A merchant boarded by a larger crew strikes rather than fight (ADR 013).
        if (
          attacker === 0 &&
          enemy.role === 'trader' &&
          player.condition.crew > enemy.condition.crew
        ) {
          strike(enemy, events);
        }
        state.outcome = enemy.struck ? { type: 'captured' } : { type: 'boarding', attacker };
        player.ship = { ...player.ship, speedKn: 0 };
        enemy.ship = { ...enemy.ship, speedKn: 0 };
      } else {
        separate(player, enemy);
      }
    } else {
      state.contactSec = 0;
    }
  }
  // Over the horizon: the ship that is opening the distance faster is the one that got away.
  if (!state.outcome && distance(player, enemy) > ESCAPE_DISTANCE_PX) {
    const runner = openingSpeedKn(player, enemy) >= openingSpeedKn(enemy, player) ? 0 : 1;
    state.outcome = { type: 'escaped', shipIndex: runner };
  }
  if (state.outcome) events.push({ type: 'ended' });
  return events.length > 0 ? events : NO_EVENTS;
}

/** The player gives up the fight (from the pause menu, spec §6.6 step 5). */
export function surrender(state: CombatState): void {
  if (!state.outcome) state.outcome = { type: 'surrendered' };
}
