// SPDX-License-Identifier: GPL-3.0-only
// Balance harness (slice 2 spec §10.4): AI-against-AI fights for every matchup, as a table.
// Run with npm run sim:balance. Imports only sim/ (and data/ through it).
import { MATCHUPS, runMatchup } from '../src/sim/combat/balance';

const FIGHTS = 200;
const pct = (rate: number) => `${Math.round(rate * 100)} %`.padStart(6);
const header = [
  'matchup'.padEnd(27),
  'win',
  'loss',
  'strike',
  'sink',
  'board',
  'escape',
  'avg s',
  'max s',
];

console.log(`${FIGHTS} seeded fights per matchup\n`);
console.log(header.map((h, i) => (i === 0 ? h : h.padStart(6))).join(' '));
for (const matchup of MATCHUPS) {
  const s = runMatchup(matchup, FIGHTS);
  console.log(
    [
      matchup.name.padEnd(27),
      pct(s.win),
      pct(s.loss),
      pct(s.struck),
      pct(s.sunk),
      pct(s.boarded),
      pct(s.escape),
      s.avgSec.toFixed(0).padStart(6),
      s.maxSec.toFixed(0).padStart(6),
    ].join(' '),
  );
}
