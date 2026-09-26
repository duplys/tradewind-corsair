# Slice 3: The Sword Duel

Status: ready for implementation
Depends on: slices 1 and 2, implemented and merged
Read first: `CLAUDE.md`, then `docs/specs/slice-02-ship-combat.md` §9 (the boarding
placeholder this slice replaces), then this document.

## 1. Goal

When two ships grapple, the captains meet on the deck. The player fights the enemy
captain in a side-view sword duel: reading the opponent's wind-up, attacking the line
they are not guarding, parrying and riposting, and driving the enemy back plank by
plank to the rail. Meanwhile the two crews fight around them, and the crew that is
winning pushes their captain forward. Winning the duel wins the ship.

The slice is done when a duel is readable (you can see what the opponent is about to
do), responsive on keyboard and touch, winnable by skill rather than button-mashing,
and different enough between weapons and opponents to stay interesting across a
career.

### In scope

- A pure, deterministic duel simulation: planks, guard lines, attacks, parries,
  ripostes, feints, stamina, pushing back and yielding
- Three weapons with distinct trade-offs, chosen before each duel
- A duel AI with five skill levels, and a headless balance harness
- A procedural pose-rig renderer for the fighters, a side-view deck scene and
  background crew melee
- Duel HUD, keyboard and touch controls, optional attack cues and a "relaxed timing"
  accessibility setting
- Boarding integration: `DuelBoardingResolver` replaces `MeleeBoardingResolver`, and
  crew strength feeds into the duel as morale pressure
- A named player captain with a fencing skill attribute, and named enemy captains
- A "Fencing practice" mode from the title screen
- Save v3 with migration, and a separate settings store

### Out of scope (later slices; do not build)

Tavern brawls and duels with rivals in towns (slice 4 will reuse this module), learning
or improving fencing skill (slice 5), ageing effects on stamina (slice 5), sound,
gamepad support, and multiple opponents at once.

## 2. Reconciling with the code (Milestone 0)

As in slice 2: read the current `src/`, `tests/` and the slice 2 ADRs. Record any
difference from what this spec assumes (in particular the `BoardingResolver` interface,
the mode state machine, the save v2 shape and the RNG fork API) in
`docs/decisions/NNN-slice-3-reconciliation.md`. The code is the source of truth unless
it breaks `CLAUDE.md`.

In the same milestone:

- Add save v3 and the v2 → v3 migration (§11).
- Add the settings store (§11.2).
- Create the `src/sim/duel/` and `src/render/duel/` directories and update the
  architecture tree in `CLAUDE.md`.

## 3. The duel model

### 3.1 The deck

- The deck is a row of **11 planks**, indexed 0–10. Plank 0 is the player's rail (left)
  and plank 10 is the enemy's rail (right).
- Each fighter occupies one plank. The player starts on **plank 4** and the enemy on
  **plank 6** (distance 2). The fighters can never share a plank or pass each other,
  so the minimum distance is 1.
- **The deck is the score.** There is no health bar. A clean hit forces the defender
  back along the deck, and **a hit on a fighter standing at their own rail makes them
  yield**. So the minimum for a win is four pushes plus the final hit.

### 3.2 Lines and guard

- There are three lines: **high**, **mid** and **low**.
- Each fighter always holds a **guard line**: the line they are currently selecting (the
  player: ↑ = high, ↓ = low, neither = mid). The AI chooses its own.
- A guard line gives **passive protection**: an attack on the line the defender is
  guarding, while the defender is idle or stepping, is *deflected* (§3.4).
- So the basic attacking idea is to **strike the line they are not guarding**, and the
  basic defensive idea is to **guard where you expect the attack**, or to parry actively
  when you see it coming.

### 3.3 Actions and timing

Every fighter runs a small state machine. All durations are in milliseconds, before
weapon modifiers (§4) and before the relaxed-timing multiplier (§8.3).

| State      | Entered by                                    | Duration | Notes |
| ---------- | --------------------------------------------- | -------- | ----- |
| `idle`     | default                                       | —        | Guard line can change freely |
| `step`     | ← / → (back / forward)                        | 280      | Moves one plank at the end. Guard stays active. Cannot step into an occupied plank or past your own rail |
| `windup`   | Attack                                        | weapon   | The line is locked at the start. **Telegraphed** by a distinct pose per line (§7.2) |
| `strike`   | end of windup                                 | 100      | The hit is resolved at the first frame where the attack is in range (§3.4) |
| `recover`  | end of strike, or a deflect                   | weapon   | Vulnerable |
| `parry`    | Parry                                         | weapon window | Active on the current guard line. The line is locked at the start |
| `parryRecover` | a parry window that ends without parrying anything | 280 | Vulnerable (a whiffed parry is punishable) |
| `stagger`  | the attack was parried                        | 450      | Vulnerable, and cannot act |
| `feintRecover` | Parry pressed during your own windup       | 120      | Cancels the attack (a feint) |
| `yield`    | hit while standing at your own rail           | —        | Terminal |

Input during a state that cannot act is **buffered for 120 ms** (the last input wins),
so presses made slightly early still register.

### 3.4 Resolving a strike

When an attacker enters `strike` and the distance ≤ the weapon's reach:

1. If the **defender is also in `strike`** on the same frame, it is a **clash**: both are
   deflected and both go to `recover` with an extra 100 ms. Nobody moves.
2. If the **defender is in `parry` on the attacked line**, it is a **parry**: the attacker
   goes to `stagger`, and the defender opens a **riposte window** (the 450 ms of the
   attacker's stagger).
3. If the **defender is `idle` or `step`, guarding the attacked line**, it is a
   **deflect**: the attacker goes to `recover` with an extra 150 ms, and nobody moves.
   *(Exception: the boarding axe, §4.)*
4. **Otherwise it's a hit** (the defender was in `windup`, `recover`, `stagger`,
   `parryRecover`, `feintRecover`, parrying the wrong line, or guarding a different
   line). The defender is pushed back by the weapon's `push` value in planks, clamped at
   their rail. **If the defender was already at their rail, they yield.** The attacker
   goes to `recover`.

If the distance is greater than the reach, the attack **whiffs**: the attacker
recovers normally and nothing happens.

A **riposte** is an attack started during your riposte window. It uses the weapon's
`riposteWindupMs` and adds +1 to push.

When one fighter is pushed back, the other **does not follow automatically**. They must
step forward to close the distance again, which gives the pushed fighter a moment to
reset.

### 3.5 Stamina

- Stamina is 0–100, starting at 100.
- Costs: attack = the weapon's `staminaCost`; parry 6; feint 8; step 4.
- Regeneration: 18 per second, starting after 400 ms without starting an action.
- **Exhausted** (below 15): windups take ×1.5 as long, the parry window shrinks to
  ×0.7, and the fighter's pose visibly slumps (§7.2). An action is still allowed even
  when stamina would go negative; it clamps at 0.

### 3.6 Morale pressure (boarding context only)

- While the duel runs, the two crews fight in the background, using the round model
  from slice 2's `MeleeBoardingResolver`. Advance **one round every 2.0 s** of duel time.
- **Every 5 s**, if one crew outnumbers the other by more than 1.5×, the captain of the
  weaker crew is forced back one plank (an automatic `step` backwards if that plank is
  free, or nothing if they are already at their rail; this **never** causes a yield on
  its own). Show the message "Your men are driving them back!" or "Their crew is pressing
  us!".
- If one crew falls below 30 % of its starting count, **that side yields immediately**
  and the duel ends: "Their crew throws down its arms!" or "Our crew breaks!".
- This means a big crew advantage helps a weak fencer, and a great fencer can still win
  against the odds. That trade-off is intentional.

### 3.7 Simulation API (pure, `src/sim/duel/`)

```ts
interface DuelSetup {
  context: 'boarding' | 'practice';          // slice 4 adds 'tavern', 'rival'
  player: FighterSetup;
  opponent: FighterSetup;
  crews?: { player: number; opponent: number };  // boarding only
  timingScale: number;                         // 1.0 or 1.3 (relaxed)
  seed: RngState;
}
interface FighterSetup {
  name: string;
  weapon: WeaponId;
  skill: 1 | 2 | 3 | 4 | 5;  // player: fencing attribute; AI: difficulty
  outfit: OutfitId;
}
interface DuelInput {        // one per fighter per step
  line: 'high' | 'mid' | 'low';
  attack: boolean;           // edge-triggered
  parry: boolean;            // edge-triggered
  step: -1 | 0 | 1;          // edge-triggered; -1 = toward own rail
}
function createDuel(setup: DuelSetup): DuelState;
function stepDuel(state: DuelState, inputs: [DuelInput, DuelInput], dtMs: number): DuelEvent[];
```

Events include `windupStart{fighter,line}`, `strike`, `clash`, `parry`, `deflect`,
`hit{push}`, `whiff`, `feint`, `stepped`, `forcedBack`, `exhausted`, `crewRound`,
`yield{fighter, reason: 'rail' | 'crew'}`.

The simulation steps at a fixed 1 ms-resolution time base (step with `dtMs` = 1000/60
but resolve state transitions at their exact scheduled times) so that timing does not
depend on the frame rate.

### 3.8 Required tests

- Every row of §3.4, including the clash, the wrong-line parry, a deflect while stepping,
  and the axe's guard break.
- A hit at the rail causes a yield. Push is clamped at the rail. Fighters can't overlap
  or pass each other.
- The riposte window opens only after a parry and uses the riposte windup and push +1.
- A feint cancels the windup and costs stamina. The line is locked during the windup.
- Exhaustion thresholds and their effects. Regeneration only after 400 ms idle.
- Input buffering: a press 100 ms before `recover` ends is executed, and one 200 ms
  before is not.
- Morale pressure fires on schedule, never causes a yield by itself, and crew
  collapse causes an immediate yield.
- Determinism: the same setup and the same input sequence give identical event logs.
- `timingScale = 1.3` scales every duration consistently.

## 4. Weapons (`src/data/weapons.ts`)

| id      | name         | windup | riposte windup | recover | reach | push | parry window | stamina | special |
| ------- | ------------ | ------ | -------------- | ------- | ----- | ---- | ------------ | ------- | ------- |
| rapier  | Rapier       | 260    | 140            | 280     | 2     | 1    | 170          | 10      | Hits from distance 2, so it can keep the opponent at bay |
| cutlass | Cutlass      | 320    | 150            | 300     | 1     | 1    | 220          | 12      | The widest parry window; a riposte pushes +2 instead of +1 |
| axe     | Boarding axe | 440    | 200            | 420     | 1     | 2    | 150          | 18      | **Guard break:** an attack on a guarded line still pushes 1 (instead of being deflected). Being parried staggers for only 300 ms |

Design intent:

- The **rapier** controls distance and is quick, but its narrow parry window punishes
  defensive play.
- The **cutlass** is the forgiving all-rounder built around parry and riposte.
- The **axe** is slow and readable but relentless: it ignores passive guard and
  pushes two planks on a clean hit.

No weapon may dominate. See the balance targets in §6.

Before each duel, a **"Choose your blade"** panel shows the three weapons as cards with
their stats as small bars (Speed, Reach, Defence, Power) and a one-line description.
The player's last choice is preselected (saved in the captain record) and confirmed with
Enter or a tap. The AI's weapon is picked by its captain profile (§5.2).

## 5. Captains

### 5.1 The player captain

```ts
interface Captain {
  name: string;                 // chosen at New voyage, default "Edward Calloway"
  fencing: 1 | 2 | 3 | 4 | 5;   // default 3 in this slice
  preferredWeapon: WeaponId;    // default 'cutlass'
}
```

- **New voyage** now asks for the captain's name (a text input, max 24 characters,
  trimmed, non-empty; the default is filled in).
- Fencing modifies the *player's* parry window by `(fencing − 3) × 15 ms` and stamina
  regeneration by `(fencing − 3) × 10 %`. It stays at 3 in this slice. The hook is for
  slice 5.
- The captain's name appears in the ledger panel and in the duel HUD.

### 5.2 Enemy captains

Generate an enemy captain when a combat starts (store it on the NPC so a ship that escapes
keeps its captain):

- **Name:** a per-nation title plus a name from `src/data/captainNames.ts` (written
  fresh, about 20 per nation). For example "Capitán Diego Ferrer", "Captain John Ashby",
  "Capitaine Luc Varenne", "Kapitein Pieter Oort". Pirates get invented nicknames
  ("Red Mag Tolliver").
- **Skill** by role, seeded: trader 1–2, warship 2–4 (frigate or galleon: 3–4), pirate
  2–5 (pirate frigate: 4–5).
- **Weapon:** Spanish and French officers favour the rapier, English and Dutch the
  cutlass, and pirates the cutlass or axe. Use a weighted random pick, not a fixed one.
- The encounter dialog from slice 2 now names the captain in its description
  ("commanded by Capitán Diego Ferrer"), and the boarding flow shows the captain's
  name and a skill hint ("a seasoned blade", "reputed a master swordsman" for 5).

## 6. Duel AI (`src/sim/duel/ai.ts`)

The AI is pure: `decideDuel(state, fighterIndex, rng): DuelInput`. It runs every
simulation step but may only **react** to information that is at least `reactionMs`
old. Keep a short history of observed events, and let the AI read only the entries
older than its reaction delay.

### 6.1 Skill parameters

| skill | reactionMs | read accuracy | feint rate | guard adapt | aggression |
| ----- | ---------- | ------------- | ---------- | ----------- | ---------- |
| 1     | 420        | 0.50          | 0.00       | none        | 0.3        |
| 2     | 360        | 0.60          | 0.05       | slow        | 0.4        |
| 3     | 300        | 0.70          | 0.10       | medium      | 0.5        |
| 4     | 250        | 0.80          | 0.15       | fast        | 0.6        |
| 5     | 210        | 0.88          | 0.20       | fast + bait | 0.7        |

### 6.2 Behaviour

- **Defence:** when the AI observes an opponent `windupStart` (after its reaction
  delay), it rolls *read accuracy*. On success, it parries the right line if its parry
  can be active when the strike lands. Otherwise it switches its guard to that line, if
  the switch can happen in time. On failure, it picks a random other line or does
  nothing. Exhaustion lowers read accuracy by 0.15.
- **Guard adaptation:** the AI keeps a decaying histogram of the lines the opponent
  attacked (half-life of 6 attacks) and biases its idle guard toward the most-used
  line. At "slow" it updates every 4 s, at "medium" every 2 s, and at "fast" after each
  attack. At skill 5 ("bait") it sometimes deliberately guards the *second* most likely
  line to invite an attack it can parry.
- **Offence:** when in range and not recovering, it attacks with a probability per second
  scaled by aggression. It prefers the line the opponent is *not* guarding, as observed
  after its reaction delay, so fast guard changes by the player can fool it. It feints
  at the feint rate and follows a feint with a real attack on a different line within
  300 ms. It always ripostes when it opens a riposte window and has the stamina.
- **Distance:** a rapier AI tries to hold a distance of 2 (steps back when the
  opponent closes). Cutlass and axe AIs close to a distance of 1. Anyone near their own
  rail (within 1 plank) is more defensive (aggression × 0.6) and tries to step
  forward.
- **Stamina:** it doesn't start an attack below 25 stamina unless the opponent is
  staggered.

### 6.3 Balance harness (`npm run sim:duel`)

This extends the slice 2 harness pattern. It is headless, imports only `sim/`, and runs
N seeded duels per matchup, printing the win rate, the average duration, the average
number of hits and the share of rail yields vs crew yields.

It includes a **reference human bot** that stands in for a reasonably good player: a
reaction of 260 ms plus 40 ms input latency, a read accuracy of 0.75, a guard that
changes after two same-line attacks, and attacks on unguarded lines with 60 % accuracy
on the opponent's current guard. This bot's parameters live in the harness, not in the
game.

Targets (also Vitest assertions at N = 300, `tests/balance/duel.test.ts`):

| Matchup                                              | Target               |
| ---------------------------------------------------- | -------------------- |
| AI skill *s* vs AI skill *s*, same weapon (every s)  | 40–60 %              |
| AI skill 5 vs AI skill 1                             | ≥ 90 %               |
| AI skill 4 vs AI skill 2                             | ≥ 70 %               |
| Every weapon vs every other weapon, skill 3 vs 3     | 35–65 %              |
| Reference bot (cutlass) vs AI skill 3 (any weapon)   | 45–70 % (winnable, not trivial) |
| Reference bot (cutlass) vs AI skill 5 (any weapon)   | 15–40 %              |
| Reference bot vs AI skill 1                          | ≥ 85 %               |
| Average duel duration (practice context)             | 20–60 s              |
| Boarding: 3 vs 3, crews 60 vs 30                     | The side with the bigger crew wins 65–85 % |

If the targets can't be met by tuning `weapons.ts` and the AI table, write an ADR before
changing the rules in §3.

## 7. Rendering (`src/render/duel/`)

### 7.1 Scene

- **Side view** at the same logical pixel scale as the rest of the game. The deck runs
  horizontally across the lower third of the view. **The planks are visible as board
  seams** with a subtly lighter plank under each fighter, because the deck *is* the score.
  The rails at both ends are drawn as solid bulwarks with a gap and open sea beyond.
- Behind: a mast with rigging lines, the enemy ship's hull alongside (its colour from the
  NPC's class palette), and a sky gradient with the Bayer dithering from slice 1.
- **Background crew melee** (boarding only): 6–12 small silhouettes per side, 8–10 px
  tall, in two depth rows behind the fighters, each running a simple 2-frame "fighting"
  bob. When a side loses crew in a round, remove silhouettes proportionally (with a
  one-frame "fall"). The numbers on the HUD are authoritative; the silhouettes are
  flavour.
- **Practice context:** a fort courtyard (a stone floor with the same 11 seams as
  flagstones, a wall and a practice dummy) instead of a deck, with no crew.
- The view is framed so that all 11 planks are always visible, at any aspect ratio.
  On narrow portrait screens, scale the whole scene down by an integer factor if needed,
  and keep the fighters at least 32 logical px tall.

### 7.2 Fighters: procedural pose rig

Do not hand-draw frame sprites. Use a small skeleton that is posed from data and
rasterised into pixels each frame:

- **Joints:** pelvis (root), chest, head, and for each side shoulder, elbow, hand, hip,
  knee and foot. The sword is attached to the sword hand with a length set by the weapon
  (rapier long and thin, cutlass medium and curved at the tip, axe short with a 3×3 head).
- **Poses** are sets of joint angles relative to the parent, defined in
  `src/render/duel/poses.ts`. At minimum: `guard-high`, `guard-mid`, `guard-low`,
  `windup-high`, `windup-mid`, `windup-low`, `strike-high`, `strike-mid`,
  `strike-low`, `parry-high`, `parry-mid`, `parry-low`, `stagger`, `recover`,
  `step-forward`, `step-back`, `exhausted` (a modifier that slumps the chest and lowers the
  guard), `hit` (a recoil), `yield` (kneeling, sword dropped) and `victory`.
- **Interpolation:** each state maps to a target pose, and the renderer eases from the
  current pose to the target over the state's duration (ease-out for strikes, ease-in-out
  otherwise). A windup must reach its **full telegraph pose within the first 60 % of its
  duration**, so the line is readable before the strike.
- **Rasterisation:** limbs are 2–3 px thick pixel lines (Bresenham), the torso is a filled
  coat polygon between the shoulders and hips (flaring below the hips), the head is a 5×5
  circle with a hat (tricorne silhouette for officers, bandana for pirates), and the boots
  are dark. Run everything through the same palette quantisation and 1-px outline as the
  ship sprites.
- **Outfits** (palette swaps, `OutfitId`): the player in dark blue with a brass trim;
  Spain black with a yellow sash; England red; France blue with white; Dutch orange with
  grey; pirates brown or weathered with a red sash. The enemy faces left (the rig is
  mirrored).
- The **sword tip gets a 1-px glint** that follows the blade, which makes the line of the
  blade easy to track.
- **Readability rule:** the three windup poses must differ in **both** the sword angle and
  the body silhouette (raised elbow for high, level blade for mid, dropped shoulder and
  bent knees for low), so they can be told apart even at a glance on a phone.

### 7.3 Effects

- **Parry:** a white 5-px spark star at the blade contact point, plus a 1-frame white
  ring.
- **Clash:** a larger spark and both fighters jolt back 1 px for 100 ms.
- **Deflect:** a small grey spark.
- **Hit:** the defender flashes (one frame lighter), 3–5 red-brown pixels fly off, and
  the defender slides back along the planks over 200 ms (the push is animated, not a
  jump). There is a 2 px screen shake, disabled under `prefers-reduced-motion`.
- **Yield:** the sword clatters to the deck (3 bouncing frames), and the fighter kneels.
- **Exhausted:** a small breath puff every 0.8 s.
- **Forced back by morale:** a brief dust puff at the feet.

### 7.4 Attack cues (setting, on by default)

When a fighter enters `windup`, show a small chevron (◆ 3 px) at the height of the
attacked line, just in front of the attacker. It is brass for the enemy and pale blue for
the player. It appears at 40 % of the windup, so it confirms the telegraph rather than
replacing it. Turning cues off is for experienced players.

## 8. UI and controls

### 8.1 Duel HUD (DOM)

- **Top-left:** the player's name plate (name, weapon icon and name, a stamina bar).
  **Top-right:** the enemy's name plate with a skill hint and their stamina bar.
- **Top-centre (boarding only):** the crew counts "Your crew 34 · 21 theirs", with a
  small ratio bar. It pulses when morale pressure is about to fire (in the last second
  before the 5-s tick, if the ratio is over 1.5).
- **Bottom:** a thin plank ruler mirroring the deck (11 ticks) with markers for both
  fighters, for players who find the pixel scene small.
- **Messages:** "Parried!", "Riposte!", "Driven back!", "Your men are driving them back!"
  and "Exhausted!". Keep them short and plain.
- **Pause:** P or Esc, or a ‖ button. The pause menu has Resume, a toggle for attack cues
  and a toggle for relaxed timing. In practice mode it also has "End practice"; in boarding
  there's no surrender (yielding in a boarding is a defeat).

### 8.2 Controls

| Action                       | Keyboard                | Touch |
| ---------------------------- | ----------------------- | ----- |
| Guard/attack line high       | hold ↑ / W              | hold **High** |
| Guard/attack line low        | hold ↓ / S              | hold **Low** |
| Mid line                     | neither held            | neither held |
| Step back / forward          | ← / → (A / D)           | ◀ / ▶ (tap) |
| Attack                       | J or Space              | **Attack** (large) |
| Parry (feint during windup)  | K or Shift              | **Parry** (large) |
| Pause                        | P / Esc                 | ‖ |

- The **touch layout:** the left thumb gets **High** and **Low** stacked vertically with
  a clear gap (the gap means "mid"), and ◀ ▶ to their right. The right thumb gets Attack
  and Parry side by side, each at least 64 px. All controls respect safe areas.
- **Use `pointerdown`, never `click`,** for all duel controls. Record the input with its
  `event.timeStamp` and feed it to the simulation at the correct step. The target is
  under 1 frame of added latency beyond the browser's own.
- Holding High and Low at once counts as mid (on both keyboard and touch).
- The player is always on the left and faces right. The line keys are absolute
  (up = high), so there is no mirroring confusion.

### 8.3 Relaxed timing (setting)

A settings toggle (in the pause menu, and on the title screen under "Settings") multiplies
**all** duel timings, for both fighters, by 1.3. It's for older hardware, touch
players, and anyone who finds the default too fast. The AI's reaction delays scale too, so
the balance is preserved. It is off by default.

### 8.4 Title screen

- **New voyage** now includes the captain name input (§5.1).
- Add **Fencing practice**. It opens the blade choice, then an opponent choice (skill 1–5,
  weapon random or chosen), then a practice duel in the courtyard. The result shows
  "Won/Lost in 42 s · 7 hits · 3 parries". It is not saved to the career stats. This
  mode is also the fastest way to test and tune.
- Add **Settings**: attack cues and relaxed timing.

## 9. Boarding integration

- Implement `DuelBoardingResolver` behind the slice 2 `BoardingResolver` interface. Since
  the duel is interactive, the resolver becomes **asynchronous**: it hands control to
  `duel` mode and resumes combat outcome handling when the duel ends. If slice 2's
  interface is synchronous, extend it in a backward-compatible way and explain how in the
  M0 ADR.
- **Flow:** the ships grapple (slice 2 §6.6), then the "Boarding!" banner (0.8 s), then
  "Choose your blade" (showing the enemy captain's name and skill hint), then the duel with
  crews set to the two ships' current crews, then the outcome:
  - **The player wins** (the enemy yields at the rail or their crew breaks): "Capitán
    Ferrer throws down his sword. The ship is yours." Go to the slice 2 prize screen, using
    the *remaining* crews from the duel (so casualties from the background melee
    count).
  - **The player loses:** "You are driven over the rail. Your crew surrenders." Go to the
    slice 2 defeat outcome.
- If the **enemy struck its colours** before contact, there's no duel (unchanged from
  slice 2).
- Keep `MeleeBoardingResolver` in the code: the balance harness from slice 2 uses it for
  AI-vs-AI fights, and it serves as a fallback for NPC-vs-NPC fights later. Add a unit test
  showing that the slice 2 combat balance targets still pass.
- **Save rule:** as in slice 2, never save mid-duel. Reloading during a duel restores the
  pre-encounter save.

## 10. Stats

Add `stats.duels: { won: number; lost: number; byWeapon: Record<WeaponId, { won; lost }> }`.
Practice duels are not counted. Show the duels won and lost in a small line on the chart
overlay's footer (this is a placeholder for the career screen in slice 5).

## 11. Persistence

### 11.1 Save v3

- Key `tradewind.save.v3`, which reads v1 and v2 and migrates them in a chain.
- **New fields:** `captain: Captain`, `stats.duels`, and on each NPC an optional
  `captain: { name; skill; weapon }` (generated lazily if missing).
- **Migration v2 → v3:** captain `{ name: 'Edward Calloway', fencing: 3, preferredWeapon: 'cutlass' }`,
  empty duel stats, and no NPC captains yet (generated on the first encounter).
- Tests: the chain migration v1 → v3, round-trips, and validating the captain name
  (non-empty, ≤ 24 characters, and control characters stripped).

### 11.2 Settings

A separate key, `tradewind.settings.v1`: `{ attackCues: boolean; relaxedTiming: boolean }`.
It is not part of the save, it is shared across voyages, and it falls back to defaults on
any read error.

## 12. Performance

- The duel scene holds 60 fps on a mid-range phone. The pose rig rasterises two fighters
  and up to 24 silhouettes per frame. Rasterise into a reusable `ImageData` or offscreen
  canvas, with no per-frame allocation.
- The duel simulation steps with no dependency on rendering. The harness runs 300 duels
  of one matchup in under 3 s.
- Input-to-visual latency: an attack press must show its first windup frame on the next
  rendered frame.

## 13. Milestones (implement and commit in order)

| #  | Milestone | Visible result |
| -- | --------- | -------------- |
| M0 | Reconciliation ADR; save v3 and migration chain; settings store; captain model; name input on New voyage (+ tests) | You can name your captain |
| M1 | Duel simulation: planks, lines, the state machine, resolution, stamina, riposte, feint, input buffering, morale pressure (+ the tests from §3.8) | No visible change; a comprehensive test suite |
| M2 | Duel AI with the five skill levels; reference bot and `npm run sim:duel`; balance tests; first tuning pass | The harness prints a table and the targets are met |
| M3 | Pose rig, poses, interpolation, rasteriser, outfits; deck and courtyard scenes; effects | A debug page (dev only) cycling through every pose for both fighters |
| M4 | Duel mode: HUD, keyboard and touch input with timestamped events, attack cues, pause menu, relaxed timing; Fencing practice from the title screen | A fully playable practice duel |
| M5 | Boarding integration: `DuelBoardingResolver`, blade choice, crew melee in the background, morale pressure UI, outcomes into the prize/defeat flow; enemy captains on NPCs; stats (+ tests) | Boarding a ship leads to a duel |
| M6 | Polish and tuning (by playing, on desktop *and* a phone), performance check, README update, acceptance run-through | Deployed to the VPS |

## 14. Acceptance criteria (manual checklist)

- [ ] In practice mode against skill 1, a first-time player wins within two or three
      tries without reading any instructions beyond the title screen's controls legend.
- [ ] With attack cues **off**, the three enemy windups (high, mid, low) can be told
      apart reliably on a phone screen at arm's length.
- [ ] Attacking the enemy's guarded line gives a visible deflect and no push. Attacking
      an unguarded line during their recovery pushes them back one plank, with the slide
      animated.
- [ ] A well-timed parry staggers the enemy, and an immediate attack is a visibly faster
      riposte that pushes further.
- [ ] Mashing Attack loses to skill 3 most of the time (exhaustion and ripostes punish it).
- [ ] Each weapon feels different: the rapier hits from two planks, the cutlass forgives
      late parries, and the axe breaks guard and shoves two planks.
- [ ] Skill 5 feels hard but fair. Losses feel like your mistakes, not input lag.
- [ ] In a boarding with a much larger crew, you see and feel the morale pressure
      pushing the enemy back. With a much smaller crew, your crew can break before you
      finish the duel.
- [ ] Winning a boarding duel leads to the prize screen with the remaining crew counts,
      and losing leads to the defeat outcome.
- [ ] Relaxed timing visibly slows the duel, and the balance still feels similar.
- [ ] Touch: holding High/Low, tapping Attack/Parry and stepping all work at the same time
      with two thumbs, in both portrait and landscape. There is no double-tap zoom and no
      stuck buttons.
- [ ] Reloading mid-duel restores the pre-encounter save. A v2 save loads and gets a
      default captain.
- [ ] `npm run check` (including both balance suites) passes, and `npm run build`
      succeeds. The game behaves the same on the VPS.
- [ ] No names, art, poses or text are taken from the original game (see `CLAUDE.md`).
      The duel mechanics (planks, guard lines, weapon trade-offs) are this project's
      own design.

## 15. Open questions (decide in an ADR if they come up)

- **Ageing:** slice 5 will slow the player's timings and stamina with age. Keep every
  player timing modifier flowing through one function
  (`playerTimingModifiers(captain)`) so ageing can hook in without touching the rules.
- **Town duels** (slice 4): tavern brawls may use fists or clubs as a fourth "weapon"
  with no reach. Keep `WeaponId` an extensible union and the weapon table data-driven.
- **Crew morale** (slice 4) should later scale the background melee's casualty rates.
  Keep the melee round function parameterised with a morale multiplier that defaults to 1.
