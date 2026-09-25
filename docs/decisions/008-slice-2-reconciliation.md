# 008: Reconciling the slice 2 spec with the slice 1 code

Status: accepted (slice 2, milestone M0)

## Context

The slice 2 spec (`docs/specs/slice-02-ship-combat.md`) was written against the slice 1
*spec*. Slice 1 is now built, and its code is the source of truth unless it breaks a rule
in `CLAUDE.md`. This ADR lists every place where the code differs from what the slice 2
spec assumes, and how slice 2 handles each one. The spec itself is not edited.

## Differences and decisions

### Module layout

- **Spec:** new modules `sim/ships/condition.ts`, `sim/npc/`, `sim/combat/`, `scripts/`.
- **Code:** the ship physics lives in `sim/sailing/ship.ts`, next to `wind.ts`,
  `polar.ts` and `start.ts`.
- **Decision:** keep `sim/sailing/` as the home of the one physics step and add the
  spec's new modules beside it. `sim/ships/condition.ts` exists from M0, holding the
  `ShipCondition` type and `fullCondition`; the effect functions come in M1. `scripts/` is
  added in M5.

### The shared ship physics (`stepShip`)

- **Code before M0:** `stepShip(ship: PlayerShip, input, wind, world: World, dtSec)` looked
  up `SHIP_CLASSES[ship.classId]` and hard-coded the world scale.
- **Decision:** there is still exactly one `stepShip`:
  ```ts
  stepShip(ship: PlayerShip, input, wind, terrain: World | null, dtSec)            // player, world map
  stepShip<S extends SailingShip>(ship, input, wind, terrain, dtSec, { performance, scale })
  ```
  - **`SailingShip`** is the kinematic state (`x, y, headingRad, speedKn, sail`), exactly
    the shape of the spec's `NpcShip.ship`. `PlayerShip` is `SailingShip & { classId }`.
  - **`ShipPerformance`** is `maxSpeedKn`, `turnRateRadPerSec`, `accelPerSec` and `polar`.
    A `ShipClass` is one; M1's condition effects (spec §3.2) will produce reduced copies,
    so damage changes the numbers and not the physics.
  - **`SailingScale`** is `pxPerSecPerKnot` plus `bowProbePx`. `WORLD_SAILING_SCALE` is
    2.667 px/s per knot with a 7 px probe (`data/sailing.ts`). The combat scale (2.4 px/s
    per knot, spec §6.2) will live in `data/combat.ts` from M4.
  - **`terrain: null`** means open water with no edges: the combat arena, whose boundary
    is an escape line, not a coast. The optional arena land mask (spec §15) can later be
    turned into a `World` with `createWorld` and passed as terrain, with no change to the
    physics.
  - The five-argument call behaves exactly as before. A test asserts it is identical to the
    six-argument call with the sloop's class and the world scale.
  - **Existing tests:** no slice 1 test file changed.
- **`ShipInput` stays steering-only** (`turnLeft`, `turnRight`). The spec (§4.4) describes
  it as "turn left/right, sail". In the code, sail changes are one-shot commands
  (`changeSail`), as for the player's hoist and reef. NPC and combat AI will return
  steering input plus a desired sail setting (and fire commands in combat), and the caller
  applies the sail before stepping. This keeps the physics signature the player already
  uses.
- **Allocation:** `stepShip` returns a new ship object each step (pure, as in slice 1).
  With up to 11 ships at 60 Hz that is about 1,300 small objects per second, which is
  acceptable. It does conflict with the literal wording "no per-frame allocation" in spec
  §12, which targets particles and balls. If profiling shows GC pauses, add an optional
  output object rather than a second physics function.

### The player's ship: name, condition and crew

- **Spec §3.3:** `PlayerShip` gains `condition: ShipCondition` and `name`. Gold and crew
  "stored invisibly in slice 1" become visible.
- **Code:** `PlayerShip` is the kinematic state that tests and every sim function build and
  step. Crew and gold live on `Voyage` (`sim/voyage.ts`), the player's full state that is
  saved.
- **Decision:** the spec bends here. `Voyage` gains `shipName` and `condition`, and the
  player's crew moves from `Voyage.crew` into `condition.crew`, so there is one source of
  truth for crew, as for NPCs. `PlayerShip` stays the kinematic state.
  - **Reasons:**
    1. The spec's own `NpcShip` separates `ship` (kinematics) from `condition`, so the
       player now mirrors the NPC model.
    2. Adding required fields to `PlayerShip` would break slice 1 tests that build
       `PlayerShip` literals.
    3. The generic `stepShip` would otherwise have to carry condition data it does not
       use.
  - The **save file** still follows the spec's layout (`ship.name`, `ship.condition`);
    `persist/save.ts` maps between the two.
- `Voyage` also gains `rngState`, `reputation` (`Record<NationId, number>`, all 0) and
  `stats` (see "Stats shape" below), so a v2 save round-trips without losing anything.

### RNG

- **Spec §2:** make the RNG state serialisable and restorable, and add `rng.fork('combat')`.
- **Code before M0:** `createRng(seed): Rng`, with `Rng = () => number` (mulberry32).
- **Decision:** `Rng` stays callable, so every existing caller and the town layout on the
  map are unchanged. It gains:
  - `state(): RngState`: mulberry32's single uint32, a plain JSON number
  - `fork(label)`, plus `restoreRng(state)` and `isRngState(value)`
  - `fork` draws one value from the parent and mixes it with a hash of the label (murmur3
    finaliser). So forks are deterministic, two forks with the same label at different
    times differ (one stream per encounter), and a child's draws never affect the parent.
- New voyages get a fresh seed from `game/seed.ts` (`crypto.getRandomValues`, outside
  `sim/`). `newVoyage(world, ports, seed?)` defaults to a fixed seed for the title screen
  preview and for tests.

### Save format

- **Spec §11:** key `tradewind.save.v2`, "keep reading v1 and migrating it", with the new
  fields.
- **Decisions:**
  - Saves are written only as v2. The v1 key is read only while no v2 save exists, and it
    is never deleted (it doubles as a backup). If a v2 save exists but is invalid, the game
    does **not** fall back to v1, because that would silently resurrect an older voyage.
    The player sees "New voyage" only, as in slice 1.
  - **v1 → v2 migration:**
    - The ship is named "Swallow".
    - It gets full condition: hull and rigging 100 and all of its class's guns.
    - Its **crew is the v1 `crew` field**, not a constant 40. Slice 1 always writes 40, so
      the result matches the spec, and a hand-edited value is not discarded.
    - `npcs = []` and `nextNpcId = 1`.
    - Reputation and stats start at zero.
    - `rngState = hashString(JSON.stringify(v1))`, so the same v1 save always migrates to
      the same seed.
  - Migration only restructures the data, and the result is validated as a v2 save. So
    every slice 1 rejection rule still applies.
  - **NPCs:** until NPC ships exist (M2), `npcs` must be an array, and every entry in it is
    dropped with a warning (logged in dev builds) without invalidating the save. M2
    replaces this with real validation (on water, inside the world, valid port ids, sane
    condition).
  - **Test changes:** `tests/persist/save.test.ts` was rewritten, because the format it
    tests changed. The slice 1 cases (corrupt JSON, non-finite numbers, off-map, on land,
    bad types, unknown versions, storage failures) are all kept, run through the v1 → v2
    migration. `tests/persist/fixtures/save-v1.json` is a save generated by the slice 1
    code before any M0 change, so the test "a v1 save written by the current game still
    loads" uses real data.
- **Stats shape** (the spec gives only the names):
  ```ts
  { captured, sunk, defeats, escapedFrom, byNation: Record<NationId | 'pirate', { captured, sunk }> }
  ```
  `escapedFrom` counts fights the player escaped from. All values are counts.

### Modes, input and saving

- `ModeId` is `'title' | 'sailing' | 'port' | 'chart'`, and `Mode.enter(from)` receives the
  previous mode. Combat and the encounter dialog add modes in M3 and M4.
- **Actions:** today Space and Enter both map to `confirm`, and Esc maps to `close`. In
  combat, `confirm` becomes "fire the broadside that bears" (spec §6.3 names only Space;
  Enter will fire too, which is harmless). Esc (`close`) pauses. New actions `firePort`
  (Q), `fireStarboard` (E) and `pause` (P) are added in M6.
- **Auto-save:** `Game.autoSave` saves in every mode except the title screen, including
  on `visibilitychange`. Spec §11 forbids saving mid-combat, so M4 or M7 must exclude the
  combat mode and auto-save just before entering it.
- **`stepCombat` style:** spec §6.1 gives `stepCombat(state, playerInput, dt): CombatEvent[]`,
  which mutates the state and returns only events. Slice 1's sim returns new state instead.
  Combat will use the mutable style the spec gives, because it needs pooled balls and
  particles (spec §12). It stays pure in the sense that matters: no browser APIs, and all
  randomness from the forked RNG.

### Tooling

- `npm run sim:balance` (spec §10.4) needs something that runs TypeScript under Node.
  Neither `vite-node` nor `tsx` is installed by the current toolchain, and plain Node
  cannot resolve this project's extension-less imports. M5 will add `tsx` (MIT) or `vite-node` as a **dev** dependency,
  which the "no runtime dependencies" rule allows, and record it in `THIRD_PARTY.md` only
  if it ends up in the build (it will not).
- The balance tests (spec §10.4, up to about 20 s) would make `npm run check` much slower.
  To be decided in M5, possibly by moving them to a separate `test:balance` script that
  CI runs.

## Consequences

- Every sailing ship in the game (player, NPCs, combat) now goes through one physics step,
  and only its performance and scale differ.
- The spec's `PlayerShip.condition` and `PlayerShip.name` are `Voyage.condition` and
  `Voyage.shipName` in code. Later milestones should read the spec with that mapping.
- Existing players keep their slice 1 voyage: it migrates on first load and is saved as v2
  from then on.
