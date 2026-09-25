# 012: Combat simulation (slice 2 M4)

Status: accepted (slice 2, milestone M4)

## Context

M4 builds the combat simulation (spec §6) and makes a fight playable against a stationary
target. The combat AI (M5), the combat look and HUD (M6), and the outcome screens,
boarding and defeat (M7) come later. So a few interim choices are needed, and some
details of §6 needed pinning down.

## Decision

- **Signature:** `stepCombat(state, playerInput, enemyInput, dt): CombatEvent[]`. The spec
  has `stepCombat(state, playerInput, dt)`. Taking the enemy's input as an argument lets
  the combat mode pass the AI's decision (M5), and lets the balance harness drive both sides
  with AI. It mutates `state` (ADR 008) and draws all chance from a child RNG forked from
  the world RNG per fight.
- **`CombatInput`** has the helm, a one-step sail change and a fire order (`port`,
  `starboard` or `bearing`). Ordering a side that is not ready emits `notReady` for the
  HUD to flash (M6).
- **Broadsides:**
  - balls leave bow to stern along the middle 70 % of the hull, one every 60 ms
  - each side reloads from when its last ball leaves
  - a struck or sinking ship cannot fire, and a side with no gun manned cannot fire at all
  - balls come from a fixed pool of 64, and a shot with the pool full is lost (it never
    fills in practice)
- **Low shot:** in the last 20 % of its flight a ball cannot hit the rigging, so it rolls
  hull (55) or crew (15) only. This is our reading of "can only hit hulls (not rigging)":
  crew are hurt through the hull.
- **Striking:** only the NPC can strike. Struck ships furl their sails and drift. The
  traders' "first rigging hit that drops rigging below 50 % within 80 px" is checked when
  the hit lands.
- **Contact and boarding:**
  - Hull contact is tested by sampling 24 points on each ellipse.
  - Touching hulls board at once when their relative speed is under 4 kn. Otherwise they
    are pushed apart along the line between centres (in 0.25 px steps until they just
    touch), and the contact time keeps counting while they keep meeting. After 1.5 s they
    board anyway.
  - Ships never pass through each other (tested).
- **Start position for "Stand and fight"** (a chaser caught you, with no escape attempt):
  the spec only defines player-initiated fights and failed escapes, so this uses the
  player-initiated rule (220 px, keeping the world bearing).
- **M4 enemy:** it keeps its heading, its sails are furled at the start and it drifts to a
  stop: a stationary target. M5 replaces this with the combat AI.
- **Interim results** (`sim/combat/result.ts`, until M7):
  - both ships keep their damage, and the clock moves on 6 hours
  - a sunk or captured enemy leaves the map, with no plunder yet
  - an enemy that escaped ignores the player for 48 hours
  - if the player slipped away, the enemy ignores them for 24 hours and they gain 25 px
  - a boarding fight is not resolved yet: the ships part, like an escape
  - a sunk player keeps their ship on 5 % hull until defeat exists
  - A result card with **Continue** shows the heading (using the spec's final wording
    where it exists) and a note saying what a later milestone adds. The game saves after
    it.
- **Interim look:**
  - world sprites scaled to the combat hull length
  - 1 px balls with a trail, splash rings
  - the area beyond the arena drawn darker
  - a text status panel (both ships, reload state, range in yards)
  - the §10.3 messages ("Her mainmast is damaged!", "She's striking her colours!", "We're
    taking water!", "Grapples ready — close to board!")
- **Camera** (spec §6.2): it frames both ships while they fit with a 24 px margin, and
  otherwise follows the player. The edge arrow comes in M6.
- **Keys:** Q and E fire port and starboard. Space and Enter fire the side that bears.
  Touch has no Fire button until M6's combat layout, so on phones M4 fights can steer but
  not fire.

## Consequences

M5 swaps `HOLD` for the AI's decision. M6 replaces the interim look and panel. M7 replaces
`applyCombatResult`'s interim rules with the outcome screens, boarding resolver and defeat.
