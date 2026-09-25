// SPDX-License-Identifier: GPL-3.0-only
// Balance targets (slice 2 spec §10.4), at 200 seeded fights per matchup. Slow: these run with
// npm run test:balance, not npm test.
import { describe, expect, it } from 'vitest';
import { FIGHT_TIME_CAP_SEC } from '../../src/data/combat';
import { MATCHUPS, runMatchup, type MatchupStats } from '../../src/sim/combat/balance';

const N = 200;
const results = new Map<string, MatchupStats>();
function stats(name: string): MatchupStats {
  let s = results.get(name);
  if (!s) {
    const matchup = MATCHUPS.find((m) => m.name === name);
    if (!matchup) throw new Error(`No matchup ${name}`);
    s = runMatchup(matchup, N);
    results.set(name, s);
  }
  return s;
}

describe('balance targets', () => {
  it('sloop vs sloop: the player wins 40–60 %', () => {
    const s = stats('sloop vs sloop');
    expect(s.win).toBeGreaterThanOrEqual(0.4);
    expect(s.win).toBeLessThanOrEqual(0.6);
  });

  it('brigantine vs sloop: the player wins at least 70 %', () => {
    expect(stats('brigantine vs sloop').win).toBeGreaterThanOrEqual(0.7);
  });

  it('sloop vs frigate: the player wins at most 20 %', () => {
    expect(stats('sloop vs frigate').win).toBeLessThanOrEqual(0.2);
  });

  it('a fleeing sloop with the wind on the beam or upwind of a frigate escapes at least 60 %', () => {
    expect(stats('sloop (flee) vs frigate').playerEscaped).toBeGreaterThanOrEqual(0.6);
  });

  it('frigate vs fluyt: the fluyt escapes at most 40 %, and strikes in most of the rest', () => {
    const s = stats('frigate vs fluyt (trader)');
    expect(s.enemyEscaped).toBeLessThanOrEqual(0.4);
    expect(s.struck).toBeGreaterThan((1 - s.enemyEscaped) / 2);
  });

  it('every matchup averages 40–150 s, and no fight runs past the 600 s cap', () => {
    for (const m of MATCHUPS) {
      const s = stats(m.name);
      expect(s.avgSec, m.name).toBeGreaterThanOrEqual(40);
      expect(s.avgSec, m.name).toBeLessThanOrEqual(150);
      expect(s.maxSec, m.name).toBeLessThanOrEqual(FIGHT_TIME_CAP_SEC);
    }
  });

  it('runs 200 fights of a matchup in under 5 s', () => {
    for (const m of MATCHUPS) {
      const started = performance.now();
      runMatchup(m, N, 99);
      expect(performance.now() - started, m.name).toBeLessThan(5000);
    }
  });
});
