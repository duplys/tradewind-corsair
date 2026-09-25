// SPDX-License-Identifier: GPL-3.0-only
import {
  AI_AIM_NOISE_DEG,
  AI_BOARD_HULL_PCT,
  AI_CHASE_GAIN_PX,
  AI_CHASE_GIVE_UP_SEC,
  AI_DEAD_BAND_DEG,
  AI_FIRE_ARC_DEG,
  AI_FIRE_RANGE_PX,
  AI_FLEE_MIN_POLAR,
  AI_FLEE_SAMPLE_DEG,
  AI_LEAD_MAX_SEC,
  AI_OUTNUMBERED_RATIO,
  AI_REACTION_SEC,
  AI_ROLE_THRESHOLDS,
  AI_ENGAGE_RANGE_PX,
  AI_STALEMATE_SEC,
  AI_TACK_MAX_SEC,
  AI_YAW_TO_FIRE_DEG,
  COMBAT_SAILING_SCALE,
  DIFFICULTY,
} from '../../data/combat';
import { SHIP_CLASSES } from '../../data/ships';
import { angleDiff, normaliseAngle } from '../math';
import { courseFor } from '../npc/sail';
import { randRange } from '../random';
import { polarFactor, relativeWindDeg } from '../sailing/polar';
import { targetSpeedKn } from '../sailing/ship';
import { gunsMannedPerBroadside, performanceOf } from '../ships/condition';
import type { AiMode, BroadsideSide, CombatShip, CombatState } from './state';
import { HOLD, type CombatInput } from './step';

const DEG = Math.PI / 180;

/** How a ship fights: its role, or `flee` (withdraw at once and keep firing; harness only). */
export type AiProfile = 'trader' | 'warship' | 'pirate' | 'flee';

/** Bearing from one ship to another, in radians. */
export function bearingTo(from: CombatShip, to: CombatShip): number {
  return Math.atan2(to.ship.y - from.ship.y, to.ship.x - from.ship.x);
}

/** The side's beam direction: port is heading − 90°, starboard heading + 90°. */
function beamOf(ship: CombatShip, side: BroadsideSide): number {
  return ship.ship.headingRad + (side === 'port' ? -Math.PI / 2 : Math.PI / 2);
}

/** True when the target's centre lies within `arcDeg` of this side's beam. */
export function broadsideBears(
  ship: CombatShip,
  target: CombatShip,
  side: BroadsideSide,
  arcDeg: number,
): boolean {
  return Math.abs(angleDiff(bearingTo(ship, target), beamOf(ship, side))) <= arcDeg * DEG;
}

/** Seconds until this side can fire again (0 when loaded and not already firing). */
export function timeToReload(ship: CombatShip, side: BroadsideSide): number {
  return ship.volley[side] ? Infinity : ship.reloadSec[side];
}

function loaded(ship: CombatShip, side: BroadsideSide): boolean {
  return timeToReload(ship, side) === 0 && gunsMannedPerBroadside(ship.condition) > 0;
}

/** The mode for this step (spec §7): traders flee; warships and pirates engage, board or withdraw. */
function chooseMode(
  state: CombatState,
  me: CombatShip,
  them: CombatShip,
  profile: AiProfile,
): AiMode {
  if (profile === 'trader') return 'flee';
  if (me.ai.gaveUp) return 'letGo';
  if (profile === 'flee') return 'withdraw';
  if (them.struck) return 'board'; // take possession of a prize
  const t = AI_ROLE_THRESHOLDS[profile];
  const mine = me.condition;
  const theirs = them.condition;
  if (mine.crew > t.boardCrewRatio * theirs.crew && mine.hullPct > AI_BOARD_HULL_PCT) {
    return 'board';
  }
  // An enemy running away is run down, or she would never be finished; and a ship does not
  // turn tail from one that is already running (ADR 013).
  if (them.ai.mode === 'flee' || them.ai.mode === 'withdraw') return 'board';
  if (mine.hullPct < t.withdrawHullPct && !(mine.crew > theirs.crew)) return 'withdraw';
  // Heavily outnumbered: keep clear of her boarders (ADR 013).
  if (theirs.crew > AI_OUTNUMBERED_RATIO * mine.crew) return 'withdraw';
  // Nobody hitting anybody: the ship with the crew to do it closes and boards (ADR 013).
  if (state.timeSec - state.lastHitSec > AI_STALEMATE_SEC && mine.crew >= theirs.crew) {
    return 'board';
  }
  return 'engage';
}

/**
 * The course with the best speed made good away from the enemy among headings with a polar
 * factor of at least 0.6, so a fleeing ship never points into the wind (spec §7, trader).
 */
export function fleeHeading(state: CombatState, me: CombatShip, them: CombatShip): number {
  const away = bearingTo(them, me);
  const speeds = headingSpeeds(state, me);
  let best = away;
  let bestScore = -Infinity;
  for (let i = 0; i < speeds.length; i++) {
    const speed = speeds[i]!;
    if (speed <= 0) continue; // below the minimum polar factor: never into the wind
    const heading = normaliseAngle(i * AI_FLEE_SAMPLE_DEG * DEG);
    const score = speed * Math.cos(angleDiff(heading, away));
    if (score > bestScore) {
      bestScore = score;
      best = heading;
    }
  }
  return best;
}

/**
 * Full-sail speed at each sampled heading (0 where the polar factor is below 0.6), kept in the
 * AI's memory until the ship's condition changes. The wind is fixed for the whole fight.
 */
function headingSpeeds(state: CombatState, me: CombatShip): Float64Array {
  const cached = me.ai.headingSpeeds;
  if (cached?.condition === me.condition) return cached.speedsKn;
  const cls = SHIP_CLASSES[me.classId];
  const performance = performanceOf(cls, me.condition);
  const speedsKn = new Float64Array(Math.round(360 / AI_FLEE_SAMPLE_DEG));
  for (let i = 0; i < speedsKn.length; i++) {
    const rel = relativeWindDeg(i * AI_FLEE_SAMPLE_DEG * DEG, state.wind.towardRad);
    speedsKn[i] =
      polarFactor(cls.polar, rel) < AI_FLEE_MIN_POLAR
        ? 0
        : targetSpeedKn(performance, rel, state.wind.speedKn, 'full');
  }
  me.ai.headingSpeeds = { condition: me.condition, speedsKn };
  return speedsKn;
}

/** Engage (spec §7, warship): close to a station abeam of the enemy, then turn the loaded side on her. */
function engageHeading(me: CombatShip, them: CombatShip): number {
  const side: BroadsideSide =
    timeToReload(me, 'port') < timeToReload(me, 'starboard')
      ? 'port'
      : timeToReload(me, 'starboard') < timeToReload(me, 'port')
        ? 'starboard'
        : broadsideBears(me, them, 'port', 90)
          ? 'port'
          : 'starboard';
  const range = Math.hypot(them.ship.x - me.ship.x, them.ship.y - me.ship.y);
  if (range > AI_ENGAGE_RANGE_PX) return boardHeading(me, them); // close with her first
  // Put the enemy on the chosen beam: starboard means the enemy bears heading + 90°.
  const bearing = bearingTo(me, them);
  return normaliseAngle(bearing + (side === 'starboard' ? -Math.PI / 2 : Math.PI / 2));
}

/**
 * Closing to board, rake her first: if a loaded side would bear on the enemy within firing
 * range for at most a 60° turn, steer to bring it to bear (ADR 013).
 */
function rakeHeading(me: CombatShip, them: CombatShip, pursuit: number): number {
  if (them.struck || them.sinkingSec !== null) return pursuit;
  const range = Math.hypot(them.ship.x - me.ship.x, them.ship.y - me.ship.y);
  if (range >= AI_FIRE_RANGE_PX) return pursuit;
  const bearing = bearingTo(me, them);
  let best = pursuit;
  let bestTurn = AI_YAW_TO_FIRE_DEG * DEG;
  for (const side of ['port', 'starboard'] as const) {
    if (!loaded(me, side)) continue;
    const heading = normaliseAngle(bearing + (side === 'starboard' ? -Math.PI / 2 : Math.PI / 2));
    const turn = Math.abs(angleDiff(heading, me.ship.headingRad));
    if (turn <= bestTurn) {
      best = heading;
      bestTurn = turn;
    }
  }
  return best;
}

/** Board (spec §7): a lead pursuit, steering for where the enemy will be. */
function boardHeading(me: CombatShip, them: CombatShip): number {
  const scale = COMBAT_SAILING_SCALE.pxPerSecPerKnot;
  const range = Math.hypot(them.ship.x - me.ship.x, them.ship.y - me.ship.y);
  const mySpeed = Math.max(1, me.ship.speedKn * scale);
  const lead = Math.min(AI_LEAD_MAX_SEC, range / mySpeed);
  const vx = Math.cos(them.ship.headingRad) * them.ship.speedKn * scale;
  const vy = Math.sin(them.ship.headingRad) * them.ship.speedKn * scale;
  return Math.atan2(them.ship.y + vy * lead - me.ship.y, them.ship.x + vx * lead - me.ship.x);
}

/**
 * Fire a loaded side whose beam bears on the enemy within ±15° and 130 px (spec §7). Below
 * difficulty 1 the AI hesitates and its aim wanders. Nobody fires on a ship that has struck.
 */
function chooseFire(state: CombatState, me: CombatShip, them: CombatShip): BroadsideSide | null {
  if (them.struck || them.sinkingSec !== null) return null;
  const range = Math.hypot(them.ship.x - me.ship.x, them.ship.y - me.ship.y);
  const noise =
    DIFFICULTY < 1 ? randRange(state.rng, -1, 1) * (1 - DIFFICULTY) * AI_AIM_NOISE_DEG : 0;
  const delay = DIFFICULTY < 1 ? AI_REACTION_SEC / DIFFICULTY : 0;
  for (const side of ['port', 'starboard'] as const) {
    const bears =
      range < AI_FIRE_RANGE_PX && broadsideBears(me, them, side, AI_FIRE_ARC_DEG + noise);
    if (!bears || !loaded(me, side)) {
      me.ai.bearingSinceSec[side] = null;
      continue;
    }
    me.ai.bearingSinceSec[side] ??= state.timeSec;
    if (state.timeSec - me.ai.bearingSinceSec[side] >= delay) return side;
  }
  return null;
}

/**
 * A chase after a running ship that has not gained ground for 30 s is given up (ADR 013):
 * the pursuer lets her go, shortening sail and holding its course.
 */
function trackChase(state: CombatState, me: CombatShip, them: CombatShip): void {
  const chasing =
    me.ai.mode === 'board' && (them.ai.mode === 'flee' || them.ai.mode === 'withdraw');
  if (!chasing) {
    me.ai.chase = null;
    return;
  }
  const range = Math.hypot(them.ship.x - me.ship.x, them.ship.y - me.ship.y);
  if (!me.ai.chase || range < me.ai.chase.bestRangePx - AI_CHASE_GAIN_PX) {
    me.ai.chase = { bestRangePx: range, sinceSec: state.timeSec };
  } else if (state.timeSec - me.ai.chase.sinceSec > AI_CHASE_GIVE_UP_SEC) {
    me.ai.gaveUp = true;
    me.ai.mode = 'letGo';
  }
}

/**
 * The AI's input for one ship this step (spec §7). Reads the combat state and keeps its own
 * memory (mode, tack, reaction timers) in `ship.ai`.
 */
export function decide(state: CombatState, index: 0 | 1, profile: AiProfile): CombatInput {
  const me = state.ships[index];
  const them = state.ships[index === 0 ? 1 : 0];
  if (me.struck || me.sinkingSec !== null) return HOLD;

  me.ai.mode = chooseMode(state, me, them, profile);
  trackChase(state, me, them);
  if (me.ai.mode === 'letGo') {
    return { ...HOLD, sail: me.ship.sail === 'furled' ? 0 : -1, fire: chooseFire(state, me, them) };
  }
  let heading: number;
  switch (me.ai.mode) {
    case 'flee':
    case 'withdraw':
      heading = fleeHeading(state, me, them);
      me.ai.tack = null;
      break;
    case 'board':
    case 'engage': {
      const wanted =
        me.ai.mode === 'board'
          ? rakeHeading(me, them, boardHeading(me, them))
          : engageHeading(me, them);
      const course = courseFor(wanted, me.ai.tack, state.wind, state.timeSec, AI_TACK_MAX_SEC);
      heading = course.headingRad;
      me.ai.tack = course.tack;
      break;
    }
  }

  const error = angleDiff(heading, me.ship.headingRad);
  const band = AI_DEAD_BAND_DEG * DEG;
  return {
    turnLeft: error < -band,
    turnRight: error > band,
    sail: me.ship.sail === 'full' ? 0 : 1,
    fire: chooseFire(state, me, them),
  };
}
