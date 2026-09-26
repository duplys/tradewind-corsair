# 015: Combat outcomes, the boarding melee and saving (slice 2 M7)

Status: accepted (slice 2, milestone M7). Supersedes the interim results of ADR 012.

## Context

M7 closes the loop from encounter to world map: the prize screen, the choices for a
captured ship, defeat, escapes, and the boarding melee on screen (spec §8, §9, §11). A few
details are open.

## Decision

- **Outcomes are pure functions** in `sim/combat/outcome.ts`, which replaces `result.ts`
  and its interim tests.
  - `concludeFight` turns the simulation's end into prize, defeat, enemySunk,
    enemyEscaped or playerEscaped.
  - A boarding is fought out with the melee resolver behind the `BoardingResolver`
    interface, so the slice 3 duel can replace it. The attacker is the one chosen in ADR
    013.
  - The fight's own RNG decides the melee and the prize, so a reloaded voyage replays the
    same fight.
- **Crews after boarding:** the prize's recruits come from the enemy crew left at the end
  of the melee, and the player keeps the crew left on their side.
- **Every choice counts as captured:** "Take her", "Sink her" and "Let her go" all bring
  aboard the plunder and recruits, remove the ship from the map, and count in
  `stats.captured` (and `byNation`). `stats.sunk` counts only ships sunk in battle, so
  scuttling a prize does not count twice.
- **Reputation:** attacking a friendly ship already cost 1 point (M3). Letting her go
  gives back 0.5. Taking or sinking her gives nothing back. Hostile ships never affect
  reputation.
- **Take her as your ship:**
  - `classId` and condition (hull, rigging, guns) become hers.
  - The crew (yours plus recruits) is capped at her berths. The ship keeps your name and
    position.
  - The one-line comparison uses each class's close-hauled polar (135°) for "better /
    slower upwind" and her class guns and top speed ("Frigate: 28 guns, 8 kn. Slower
    upwind than your sloop.").
  - The world-map wake and sprites follow the new class.
- **Defeat:**
  - Half the gold is lost, rounded down in your favour.
  - The player is put ashore at the harbour of the nearest non-hostile port, in a sound
    sloop with 12 hands, keeping their ship's name.
  - The clock moves on 14 days plus the fight's 6 hours.
  - The enemy leaves the player alone for two days.
  - Defeat covers being sunk, losing the melee and surrendering.
- **Clock:** every fight advances it 6 hours, whatever the outcome.
- **Screens:**
  - **Boarding!** shows both crews counting down, one round every 0.12 s (about 3 s for a
    long fight). A tap or any key skips to the end, then **Continue**.
  - The **prize screen** has the name in italics, plunder, recruits, the comparison, and
    the three choices.
  - Sinkings, escapes and defeat use a short card whose lines say what happened (gold
    lost, where you are put ashore, days passed).
- **Saving:** after every outcome the voyage is saved and the game returns to sailing.
  Saving before combat (M3) and never during it are unchanged.

## Consequences

The slice 3 duel plugs into `concludeFight` through the `BoardingResolver` interface. Stats
and reputation now accumulate for the career layer in slice 5.
