// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { MeleeBoardingResolver } from '../../../src/sim/combat/boarding';
import { createRng } from '../../../src/sim/rng';

const resolver = new MeleeBoardingResolver();
const side = (crew: number, isPlayer = false) => ({ crew, startingCrew: crew, isPlayer });

function winRate(attacker: number, defender: number, seeds: number): number {
  let wins = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    if (
      resolver.resolve(side(attacker, true), side(defender), createRng(seed)).winner === 'attacker'
    )
      wins++;
  }
  return wins / seeds;
}

describe('MeleeBoardingResolver', () => {
  it('is deterministic for a fixed seed', () => {
    const a = resolver.resolve(side(40, true), side(35), createRng(9));
    expect(resolver.resolve(side(40, true), side(35), createRng(9))).toEqual(a);
  });

  it('lets 60 hands beat 30 more than 90 % of the time', () => {
    expect(winRate(60, 30, 500)).toBeGreaterThan(0.9);
  });

  it('gives an even fight to the attacker 35–65 % of the time (the defender bonus shows)', () => {
    const rate = winRate(30, 30, 500);
    expect(rate).toBeGreaterThanOrEqual(0.35);
    expect(rate).toBeLessThanOrEqual(0.65);
  });

  it('never lasts more than 30 rounds, and crews only fall', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const r = resolver.resolve(side(200), side(190), createRng(seed));
      expect(r.rounds.length).toBeGreaterThan(0);
      expect(r.rounds.length).toBeLessThanOrEqual(30);
      let prev = { attackerCrew: 200, defenderCrew: 190 };
      for (const round of r.rounds) {
        expect(round.attackerCrew).toBeLessThanOrEqual(prev.attackerCrew);
        expect(round.defenderCrew).toBeLessThanOrEqual(prev.defenderCrew);
        expect(round.attackerCrew).toBeGreaterThanOrEqual(0);
        prev = round;
      }
    }
  });

  it('gives the win to a side that has no crew left against it', () => {
    expect(
      resolver.resolve(side(20), { crew: 0, startingCrew: 30, isPlayer: false }, createRng(1))
        .winner,
    ).toBe('attacker');
  });
});
