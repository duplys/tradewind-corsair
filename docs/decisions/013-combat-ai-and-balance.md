# 013: Combat AI, balance harness and the first tuning pass (slice 2 M5)

Status: accepted (slice 2, milestone M5)

## Context

M5 adds the combat AI (spec §7), a balance harness with target outcomes (§10.4), and a
first tuning pass. §10.4 allows changing the model when tuning constants cannot meet the
targets, as long as an ADR explains it. Several targets could not be met by constants, so
this ADR records every model change, every interpretation and the final numbers.

## Measured with the spec as written

In a fixed 720 × 480 arena with the §7 AI as written:

| Matchup                   | Result                                               |
| ------------------------- | ---------------------------------------------------- |
| sloop vs sloop            | 1 % wins, 96 % escapes (ships drifted out)           |
| frigate vs fluyt          | fluyt escapes 100 % in about 18 s                    |
| sloop (flee) vs frigate   | escapes 100 %, but in 13 s (the target is 40–150 s)  |

Keeping fighting ships in the arena helped sloop vs sloop. But ships start only 110–250 px
from an edge, so anything that runs gets away within seconds. Even a 2160 × 1440 arena left
the fluyt escaping 93 % of the time: a chaser astern can't bring a broadside to bear, and a
frigate is barely faster than a fluyt.

## Model changes

1. **Escape "over the horizon"** (spec §1's own words) instead of a fixed arena edge. The sea
   has no edges, and a ship escapes when it is 450 px (1,350 yds) from the other ship. The
   escape is credited to the ship opening the distance faster. Consequences:
   - Fights start around the origin, and the camera is no longer clamped.
   - The M6 edge vignette becomes "near the horizon".
   - The M4 tests for arena centring and edge escapes were rewritten.
   - The acceptance item "sailing off the arena edge ends the fight" now reads "sailing
     beyond the horizon". **The spec's §6.2 wording should be updated to match.**
2. **Flooding:** below 30 % hull a ship takes water and slows, linearly down to 70 % of its
   speed at 0 % hull (`floodingFactor` in `sim/ships/condition.ts`). Without it, speed
   depended only on rigging, so a ship at 1 % hull with sound rigging outran its pursuer.
   The spec's own "We're taking water!" message implies it. It applies to the world map
   too, since it is the same formula; a condition test was rewritten for it.
3. **Traders strike after 4 hits,** and **strike rather than fight off boarders who
   outnumber them.** The spec's rules (hull below 40 %, or a rigging hit below 50 %) needed
   about 30 hits on a fluyt, against the acceptance item "a fluyt usually strikes after a
   few hits".
4. **Boarding attacker:** the ship that set out to board, otherwise the one closing faster.
   Always choosing the player made a mirror match lopsided, because the defender has the
   edge. One M4 test now expects `{ type: 'boarding', attacker: 0 }`.
5. **Defender bonus in the boarding melee: 2 %, not 10 %.** With 10 %, an even 30-against-30
   fight goes to the defender 75 % of the time, against §9's own target of 35–65 % for the
   attacker. At 2 % the attacker wins 39–44 % across crew sizes (the resolver is pulled
   forward from M7 because the harness needs it).

## AI interpretations and additions

- **Firing** (spec §7): a loaded side, the target's centre within ±5° of the beam (the spec
  says ±15°), and under 130 px. At 15° the balls miss wide: a ball flies straight out from
  the side, so 15° off the beam at 80 px is about 21 px off target. The hit rate was about
  one in six, and even fights lasted 300–600 s. Nobody fires on a struck or sinking ship.
  The difficulty hooks (reaction delay and aim noise below 1.0) are in place; the default
  is 1.0.
- **Engaging:** beyond 70 px a ship closes directly (lead pursuit); within 70 px it turns to
  put the enemy on the beam of the side that is loaded, or will be loaded soonest. The
  spec's station point 80 px abeam of a moving enemy made two ships sail side by side
  indefinitely.
- **Tacking** reuses the world-map rule (`courseFor`) with timers in combat seconds (at
  most 20 s per tack).
- **Boarding approach:** lead pursuit, but it turns up to 60° off course to fire a loaded
  broadside first (raking).
- **Withdrawing:** below 10 % hull for warships and 6 % for pirates (the spec says 25 % and
  15 %), when not stronger in crew. At the spec's thresholds, a mirror match ended in an
  escape a third of the time.
- **Added rules**, each needed to make fights end:
  - a ship runs down an enemy that is fleeing or withdrawing, and does not itself withdraw
    from one
  - a ship that the enemy outnumbers 2.5 to 1 in crew withdraws rather than wait to be
    boarded
  - after 45 s with no hit on either side, the ship with the larger (or equal) crew closes
    to board, which ends circling and parallel sailing
  - a chase that gains less than 5 px in 60 s is given up: the pursuer shortens sail and
    lets the enemy go
- **Traders** flee on the course with the best speed made good away from the enemy, among
  headings with a polar factor of at least 0.6. They fire only when a side happens to bear.
- **Memory:** the AI keeps its memory (mode, tack, timers, a heading-speed cache) in each
  `CombatShip.ai`. Combat state is never saved, so this needs no persistence.

## Harness

- **Engine:** `sim/combat/balance.ts` is pure and shared by `scripts/balance.ts` (`npm run
  sim:balance`, via `tsx` as a dev dependency) and `tests/balance/balance.test.ts` (`npm run
  test:balance`, which is excluded from `npm test`; CI runs it).
- **Fight setup:**
  - random wind (10–18 kn) and random headings
  - 220 px start; ships at half their top speed with full sail
  - the player side at typical crew, NPC traders at 60 %
  - the flee matchup puts the frigate downwind of the sloop or on its beam
- **Counting results:**
  - **Win:** the enemy is sunk or captured, or the player side wins the boarding melee.
  - **Escape:** either ship gets over the horizon, or the 600 s cap is reached (a draw).
- **Speed:** each matchup runs 200 fights in 0.4–2.2 s. Caches for physics parameters and
  flee speeds live on the ships, not in module globals (CLAUDE.md). The A* scratch buffers
  from M2 moved onto the grid for the same reason.

## Result (200 fights each)

| Matchup                   | Win  | Escape                        | Avg s | Target                                 |
| ------------------------- | ---- | ----------------------------- | ----- | -------------------------------------- |
| sloop vs sloop            | 51 % | 10 %                          | 121   | win 40–60 %                            |
| brigantine vs sloop       | 93 % | 3 %                           | 55    | win ≥ 70 %                             |
| sloop vs frigate          | 0 %  | 100 %                         | 56    | win ≤ 20 %                             |
| sloop (flee) vs frigate   | —    | 100 %                         | 52    | escape ≥ 60 %                          |
| frigate vs fluyt (trader) | 86 % | 14 % (strikes in all others)  | 77    | fluyt escapes ≤ 40 %, mostly strikes   |

Every matchup averages 40–150 s, and no fight passes the 600 s cap.

## Consequences

- **For M8:** in combat a sloop now always gets away from a frigate (it withdraws when
  outnumbered, and outpoints the frigate on most courses). The world-map escape roll keeps
  "rarely when running downwind". A combat equivalent, such as withdrawing only on courses
  where the sloop is faster, is worth considering.
- The spec's §6.2 (arena rectangle, vignette), §7 (±15°, station 80 px, withdraw 25/15) and
  §9 (10 % bonus) numbers are superseded by this ADR and the constants in
  `data/combat.ts`.
