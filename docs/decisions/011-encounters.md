# 011: Encounters, chases and the escape roll (slice 2 M3)

Status: accepted (slice 2, milestone M3)

## Context

M3 adds hostile behaviour on the world map, the encounter prompt and dialog, and the
escape roll (spec §5). Combat itself arrives in M4, so the fight is a placeholder.

## Decision

- **Who hunts and who runs:**
  - Pirates and warships of nations at war with England chase.
  - Traders of nations at war with England flee.
  - "Traders facing pirates" (spec §5.2) would need NPC-against-NPC encounters, which are
    out of scope. So, from the player's side, only Spanish traders run.
  - A ship that ignores the player (`ignorePlayerUntilHours` in the future) does neither,
    and an ongoing chase or flight ends when that window starts.
- **How a chase ends:**
  - beyond 140 px, as specified
  - after 3 days (as specified); the chaser then **rests for a day** before it can hunt
    again, because otherwise a chaser still within 70 px would restart the chase at once
  - if it makes no progress for 12 hours (for example blocked by a coast); it also rests
    for a day
  - After a chase or flight, the ship plans a fresh route from where it is.
- **Model addition:** `NpcShip.intentSinceHours` records when the current intent began (for
  the 3-day limit). It is saved and validated.
- **Encounter triggers:** the prompt button ("Close with the Spanish fluyt") takes priority
  over "Drop anchor". A chasing ship within 12 px opens the dialog at once. The prompt and
  dock buttons are now one `ContextPrompt`.
- **The dialog is its own mode (`encounter`)**, so the clock pauses because that mode does
  not step the simulation.
  - Focus goes to the card, not a button, because the Space keyup that opened it must not
    pick a choice (the same reason as the port screen).
  - Esc means "Leave her be" when leaving is offered.
  - Attacking a ship of a nation at peace with England shows the warning; confirming lowers
    `reputation[nation]` by 1.
- **Escape roll:** it uses the spec's formula with best speeds made good, sampled every 5°,
  and draws from the world RNG, so the result is deterministic and saved. On success, the
  chaser ignores the player for 72 hours and the player gains up to 20 px along the heading,
  stopping short of land (keeping the 7 px bow probe clear).
  - **Tuning note for M8:** with the spec's divisor of 6 kn, a sloop's chance against a
    frigate is 0.73 running upwind but still 0.39 running downwind, where the acceptance
    list says "rarely". A divisor of about 3 would make downwind about 0.25 (and upwind
    0.9, the cap).
- **Saving:** the game saves just before combat starts and never during combat. Leaving an
  encounter also saves.
- **Placeholder combat (until M4):** a parchment card ("Battle stations!", or "They're too
  quick for us!" after a failed escape) with **Break off**. Breaking off makes the enemy
  ignore the player for a day and returns to sailing, with no clock change and no damage.
- **Nations:**
  - `sentenceName` is added ("the Dutch Republic").
  - The Dutch nation's name becomes "Dutch Republic".
  - The port screen's flag label now reads "Flag of the Dutch Republic".
  - A pirate flag is added for the dialog.

## Consequences

M4 replaces the placeholder `combat` mode. It reads `session.encounter` (enemy id, who
started it, and whether an escape failed, which places the enemy closer).
