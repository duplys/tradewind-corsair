// SPDX-License-Identifier: GPL-3.0-only
// The balance harness engine (slice 2 spec §10.4): AI-against-AI fights, run headless.
import { FIGHT_TIME_CAP_SEC } from '../../data/combat';
import { SIM_STEP_SECONDS } from '../../data/constants';
import type { NpcRole } from '../../data/npc';
import { SHIP_CLASSES, type ShipClassId } from '../../data/ships';
import { TAU } from '../math';
import { createRng } from '../rng';
import { fullCondition } from '../ships/condition';
import { decide, type AiProfile } from './ai';
import { MeleeBoardingResolver } from './boarding';
import { createCombat } from './state';
import { stepCombat } from './step';

export interface Matchup {
  readonly name: string;
  readonly player: ShipClassId;
  /** How the player side fights (spec: the warship AI unless stated). */
  readonly playerProfile: AiProfile;
  readonly enemy: ShipClassId;
  readonly enemyRole: NpcRole;
  /**
   * Starting geometry: `random` bearings and headings, or `playerUpwind`, where the enemy lies
   * downwind of the player or on the beam (the flee test in §10.4).
   */
  readonly geometry: 'random' | 'playerUpwind';
}

export type FightResult = 'win' | 'loss' | 'escape';

export interface FightReport {
  readonly result: FightResult;
  /** The enemy struck her colours at some point. */
  readonly struck: boolean;
  readonly sunk: boolean;
  readonly boarded: boolean;
  /** Which side escaped (or null), and whether the time cap ended the fight. */
  readonly escaped: 'player' | 'enemy' | null;
  readonly timedOut: boolean;
  readonly durationSec: number;
}

const WIND_SPEED_RANGE_KN = [10, 18] as const;
const START_SPEED_SHARE = 0.5;

/** Crew for an NPC of this role at the middle of its spawn range (§4.3). */
function typicalCrew(classId: ShipClassId, role: NpcRole | 'player'): number {
  const cls = SHIP_CLASSES[classId];
  return Math.floor(cls.crewTypical * (role === 'trader' ? 0.6 : 1));
}

/** One seeded AI-against-AI fight to its end, or to the 600 s cap (a draw, counted as an escape). */
export function runFight(matchup: Matchup, seed: number): FightReport {
  const rng = createRng(seed);
  const wind = {
    towardRad: rng() * TAU,
    speedKn: WIND_SPEED_RANGE_KN[0] + rng() * (WIND_SPEED_RANGE_KN[1] - WIND_SPEED_RANGE_KN[0]),
  };
  let bearing = rng() * TAU;
  if (matchup.geometry === 'playerUpwind') {
    // The enemy lies downwind of the player, or on the beam.
    const offsets = [0, Math.PI / 2, -Math.PI / 2];
    bearing = wind.towardRad + offsets[Math.floor(rng() * offsets.length)]!;
  }
  const setup = (classId: ShipClassId, role: NpcRole | 'player') => {
    const cls = SHIP_CLASSES[classId];
    return {
      classId,
      role,
      condition: fullCondition(cls, typicalCrew(classId, role)),
      headingRad: rng() * TAU,
      speedKn: cls.maxSpeedKn * START_SPEED_SHARE,
      sail: 'full' as const,
    };
  };
  const state = createCombat({
    player: setup(matchup.player, 'player'),
    enemy: setup(matchup.enemy, matchup.enemyRole),
    wind,
    rng: rng.fork('combat'),
    bearingToEnemyRad: bearing,
    escapeFailed: false,
  });

  let struck = false;
  const maxSteps = Math.round(FIGHT_TIME_CAP_SEC / SIM_STEP_SECONDS);
  for (let i = 0; i < maxSteps && !state.outcome; i++) {
    const p = decide(state, 0, matchup.playerProfile);
    const e = decide(state, 1, matchup.enemyRole);
    stepCombat(state, p, e, SIM_STEP_SECONDS);
    struck ||= state.ships[1].struck;
  }

  const outcome = state.outcome;
  const base = {
    struck,
    sunk: false,
    boarded: false,
    escaped: null,
    timedOut: false,
    durationSec: state.timeSec,
  };
  if (!outcome) return { ...base, result: 'escape', timedOut: true };
  switch (outcome.type) {
    case 'sunk':
      return { ...base, sunk: true, result: outcome.shipIndex === 1 ? 'win' : 'loss' };
    case 'captured':
      return { ...base, boarded: true, result: 'win' };
    case 'boarding': {
      const crew = (index: 0 | 1) => {
        const ship = state.ships[index];
        return { crew: ship.condition.crew, startingCrew: ship.startCrew, isPlayer: index === 0 };
      };
      const defender = outcome.attacker === 0 ? 1 : 0;
      const fight = new MeleeBoardingResolver().resolve(
        crew(outcome.attacker),
        crew(defender),
        state.rng,
      );
      const winner = fight.winner === 'attacker' ? outcome.attacker : defender;
      return { ...base, boarded: true, result: winner === 0 ? 'win' : 'loss' };
    }
    case 'escaped':
      return { ...base, result: 'escape', escaped: outcome.shipIndex === 0 ? 'player' : 'enemy' };
    case 'surrendered':
      return { ...base, result: 'loss' };
  }
}

export interface MatchupStats {
  readonly matchup: Matchup;
  readonly fights: number;
  readonly win: number;
  readonly loss: number;
  readonly escape: number;
  readonly playerEscaped: number;
  readonly enemyEscaped: number;
  readonly struck: number;
  readonly sunk: number;
  readonly boarded: number;
  readonly timedOut: number;
  readonly avgSec: number;
  readonly maxSec: number;
}

/** Run `fights` seeded fights of one matchup and total the results (rates are 0..1). */
export function runMatchup(matchup: Matchup, fights: number, baseSeed = 1): MatchupStats {
  const totals = {
    win: 0,
    loss: 0,
    escape: 0,
    playerEscaped: 0,
    enemyEscaped: 0,
    struck: 0,
    sunk: 0,
    boarded: 0,
    timedOut: 0,
  };
  let seconds = 0;
  let maxSec = 0;
  for (let i = 0; i < fights; i++) {
    const r = runFight(matchup, baseSeed + i * 7919);
    totals[r.result]++;
    if (r.escaped === 'player') totals.playerEscaped++;
    if (r.escaped === 'enemy') totals.enemyEscaped++;
    if (r.struck) totals.struck++;
    if (r.sunk) totals.sunk++;
    if (r.boarded) totals.boarded++;
    if (r.timedOut) totals.timedOut++;
    seconds += r.durationSec;
    maxSec = Math.max(maxSec, r.durationSec);
  }
  const rate = (n: number) => n / fights;
  return {
    matchup,
    fights,
    win: rate(totals.win),
    loss: rate(totals.loss),
    escape: rate(totals.escape),
    playerEscaped: rate(totals.playerEscaped),
    enemyEscaped: rate(totals.enemyEscaped),
    struck: rate(totals.struck),
    sunk: rate(totals.sunk),
    boarded: rate(totals.boarded),
    timedOut: rate(totals.timedOut),
    avgSec: seconds / fights,
    maxSec,
  };
}

/** The matchups of spec §10.4. */
export const MATCHUPS: readonly Matchup[] = [
  {
    name: 'sloop vs sloop',
    player: 'sloop',
    playerProfile: 'warship',
    enemy: 'sloop',
    enemyRole: 'warship',
    geometry: 'random',
  },
  {
    name: 'brigantine vs sloop',
    player: 'brigantine',
    playerProfile: 'warship',
    enemy: 'sloop',
    enemyRole: 'warship',
    geometry: 'random',
  },
  {
    name: 'sloop vs frigate',
    player: 'sloop',
    playerProfile: 'warship',
    enemy: 'frigate',
    enemyRole: 'warship',
    geometry: 'random',
  },
  {
    name: 'sloop (flee) vs frigate',
    player: 'sloop',
    playerProfile: 'flee',
    enemy: 'frigate',
    enemyRole: 'warship',
    geometry: 'playerUpwind',
  },
  {
    name: 'frigate vs fluyt (trader)',
    player: 'frigate',
    playerProfile: 'warship',
    enemy: 'fluyt',
    enemyRole: 'trader',
    geometry: 'random',
  },
];
