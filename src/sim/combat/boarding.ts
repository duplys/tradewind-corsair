// SPDX-License-Identifier: GPL-3.0-only
import {
  BOARDING_DEFENDER_BONUS,
  BOARDING_KILL_RATE,
  BOARDING_MAX_ROUNDS,
  BOARDING_ROLL_RANGE,
  BOARDING_YIELD_OTHER_SHARE,
  BOARDING_YIELD_START_SHARE,
} from '../../data/combat';
import { randRange } from '../random';
import type { Rng } from '../rng';

export interface CrewSide {
  readonly crew: number;
  readonly startingCrew: number;
  readonly isPlayer: boolean;
}

export interface BoardingResult {
  readonly winner: 'attacker' | 'defender';
  /** Crew left after each round. */
  readonly rounds: readonly { readonly attackerCrew: number; readonly defenderCrew: number }[];
}

/** Settles a boarding fight. Slice 3 replaces the melee with a captain's duel (spec §9). */
export interface BoardingResolver {
  resolve(attacker: CrewSide, defender: CrewSide, rng: Rng): BoardingResult;
}

function yields(crew: number, start: number, otherCrew: number): boolean {
  return crew < BOARDING_YIELD_START_SHARE * start || crew < BOARDING_YIELD_OTHER_SHARE * otherCrew;
}

/**
 * The placeholder melee (spec §9): each round, each side loses ceil(opponent crew × 0.08 ×
 * rand(0.5, 1.5)), with the defender hitting 10 % harder. A side yields below 30 % of its
 * starting crew or below half the other side's crew. If both yield in the same round, the side
 * keeping the larger share of its starting crew wins (the defender on a tie); after 30 rounds
 * the larger crew wins (the defender on a tie).
 */
export class MeleeBoardingResolver implements BoardingResolver {
  resolve(attacker: CrewSide, defender: CrewSide, rng: Rng): BoardingResult {
    let a = attacker.crew;
    let d = defender.crew;
    const rounds: { attackerCrew: number; defenderCrew: number }[] = [];
    const roll = () => randRange(rng, BOARDING_ROLL_RANGE[0], BOARDING_ROLL_RANGE[1]);
    for (let round = 0; round < BOARDING_MAX_ROUNDS; round++) {
      const attackerLoss = Math.ceil(d * BOARDING_KILL_RATE * BOARDING_DEFENDER_BONUS * roll());
      const defenderLoss = Math.ceil(a * BOARDING_KILL_RATE * roll());
      a = Math.max(0, a - attackerLoss);
      d = Math.max(0, d - defenderLoss);
      rounds.push({ attackerCrew: a, defenderCrew: d });
      const aYields = yields(a, attacker.startingCrew, d);
      const dYields = yields(d, defender.startingCrew, a);
      if (aYields && dYields) {
        const aShare = a / Math.max(1, attacker.startingCrew);
        const dShare = d / Math.max(1, defender.startingCrew);
        return { winner: aShare > dShare ? 'attacker' : 'defender', rounds };
      }
      if (aYields) return { winner: 'defender', rounds };
      if (dYields) return { winner: 'attacker', rounds };
    }
    return { winner: a > d ? 'attacker' : 'defender', rounds };
  }
}
