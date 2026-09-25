# Slice 2: Ships at Sea and Ship Combat

Status: ready for implementation
Depends on: slice 1 (sailing), implemented and merged
Read first: `CLAUDE.md`, then `docs/specs/slice-01-sailing.md` (for its units, projection,
wind and ship model), then this document.

## 1. Goal

The Caribbean stops being empty. Other ships sail between the ports: merchantmen,
warships and pirates of the four nations. The player can close with any of them and
attack, and hostile ships will hunt the player. A fight moves to a tactical combat
screen where the wind, your point of sail and the angle of your broadside decide the
outcome. A fight ends in one of five ways: one ship sinks, one strikes her colours,
the ships collide and board, or one of them escapes over the horizon. Capturing a
prize brings gold, possibly new crew, and the option to take the captured ship as your
own.

The slice is done when a fight against an equal opponent is tense, winnable by skill,
and decided by manoeuvring rather than luck. Fighting a frigate in a sloop should be
survivable only by running upwind.

### In scope

- More ship classes: sloop, brigantine, fluyt (merchant), frigate and galleon, with
  data-driven stats and polars
- A persistent damage state for the player's ship (hull, rigging, crew and guns), with
  its effect on sailing, plus repairs at a friendly port
- NPC ships on the world map: spawning, despawning, sailing to destination ports with a
  coarse navigation grid, and tacking against the wind
- Encounters: hailing, attacking, being chased, and trying to run
- A tactical combat mode: arena, wind, broadsides, projectiles, hit locations, damage,
  crew-limited reloading, surrender, sinking, boarding and escape
- Combat AI for the three roles (trader, warship and pirate), plus a headless
  balance-testing harness
- Combat rendering: larger ship sprites per class, muzzle smoke that drifts downwind,
  splashes, splinters, damaged sails and a sinking animation
- Outcomes: a prize screen (plunder, recruits, take the ship), defeat, and escape
- Save format v2 with migration from v1

### Out of scope (later slices; do not build)

Sword duels (slice 3; boarding uses a placeholder resolver, see §9), fleets of more than
one ship, trading cargo, a full shipwright (only **Repair** is enabled), changing
relations between nations and their consequences (only a counter is recorded), land in
the combat arena, weather, sound, and different shot types (chain and grape are later;
the data model leaves room for them).

## 2. Reconciling with the slice 1 code (Milestone 0)

Slice 1 is built. Its code is the source of truth, and this spec assumes the structure,
units and names from the slice 1 spec. Before starting:

1. Read the existing `src/` and list any place where the implementation differs from
   what this spec assumes (names, units, module boundaries or the save shape). Adapt
   this spec to the code, not the other way round, unless the code breaks a rule in
   `CLAUDE.md`. Record the differences in `docs/decisions/NNN-slice-2-reconciliation.md`.
2. Generalise the slice 1 ship model where needed so that **the same `stepShip`
   physics drives the player, the NPCs on the world map and the ships in combat**,
   with only the scale constants differing. Do not fork the physics.
3. Extend `sim/rng.ts` so that the RNG state can be serialised and restored (it is
   saved in v2), and so that it can derive independent child streams (for example
   `rng.fork('combat')`).

**Outcome of M0** (details in `docs/decisions/008-slice-2-reconciliation.md`). Read the
rest of this spec with these mappings:

- The player's `name` and `condition` (§3.3) live on the `Voyage` as `shipName` and
  `condition`, next to the kinematic `PlayerShip`, mirroring `NpcShip`. The player's crew
  is `condition.crew`. The save file keeps the layout in §11.
- `stepShip(ship, input, wind, terrain, dtSec, { performance, scale })` is the one physics
  step. `terrain` is `null` in the combat arena. `ShipInput` is steering only: AI returns
  steering plus a desired sail setting (and fire commands in combat), and the caller
  applies the sail before stepping.
- Keys: Enter and Space are both the `confirm` action, so in combat both fire the
  broadside that bears. Esc is `close`, which pauses in combat. Q, E and P become new
  actions.
- `stepShip` returns a new ship object per step. §12's "no per-frame allocation" applies
  to particles, balls and other pooled effects, not to ship state.

## 3. Ship classes

### 3.1 Data (`src/data/ships.ts`)

Extend `ShipClass` so that the `id` union covers all five classes:

```ts
type ShipClassId = 'sloop' | 'brigantine' | 'fluyt' | 'frigate' | 'galleon';
interface ShipClass {
  readonly id: ShipClassId;
  readonly name: string;
  readonly masts: 1 | 2 | 3;
  readonly lengthPx: number;          // combat sprite hull length
  readonly beamPx: number;            // combat sprite hull width
  readonly worldLengthPx: number;     // world-map sprite hull length (§4.5)
  readonly maxSpeedKn: number;
  readonly turnRateRadPerSec: number;
  readonly accelPerSec: number;
  readonly hullStrength: number;      // hit points of hull at 100 %
  readonly guns: number;              // total, split evenly per side
  readonly crewMax: number;
  readonly crewTypical: number;       // crew needed to fight and sail at full efficiency
  readonly cargoValue: number;        // base plunder in gold
  readonly polar: readonly (readonly [relDeg: number, factor: number])[];
}
```

Starting values (tune in M6/M8; keep them all in this one table):

| id         | name       | masts | len × beam | world len | max kn | turn rad/s | accel /s | hull | guns | crew max / typical | cargo |
| ---------- | ---------- | ----- | ---------- | --------- | ------ | ---------- | -------- | ---- | ---- | ------------------ | ----- |
| sloop      | Sloop      | 1     | 22 × 8     | 16        | 9.0    | 1.6        | 0.70     | 60   | 8    | 60 / 40            | 300   |
| brigantine | Brigantine | 2     | 26 × 9     | 18        | 8.5    | 1.2        | 0.60     | 90   | 14   | 100 / 60           | 800   |
| fluyt      | Fluyt      | 3     | 28 × 10    | 20        | 7.0    | 0.9        | 0.45     | 110  | 10   | 60 / 30            | 2500  |
| frigate    | Frigate    | 3     | 32 × 11    | 21        | 8.0    | 1.0        | 0.50     | 160  | 28   | 220 / 150          | 1200  |
| galleon    | Galleon    | 3     | 36 × 13    | 23        | 6.5    | 0.7        | 0.35     | 220  | 36   | 300 / 200          | 6000  |

`accel /s` is the fraction of the gap to the target speed closed per second, as in
slice 1; the sloop keeps its slice 1 value. `world len` is the hull length of the
world-map sprite (§4.5); the sloop keeps the slice 1 player sprite's 16 px, and every
class fits the 26 × 26 px sprite canvas.

Polars (`relDeg` is the angle between the heading and the wind's **toward** direction,
as in slice 1):

| relDeg     | 0   | 30  | 60  | 90   | 120 | 135 | 150 | 180 |
| ---------- | --- | --- | --- | ---- | --- | --- | --- | --- |
| sloop      | .72 | .78 | .90 | 1.00 | .86 | .60 | .18 | .05 |
| brigantine | .80 | .84 | .92 | 1.00 | .78 | .45 | .12 | .05 |
| fluyt      | .90 | .92 | .95 | .90  | .60 | .30 | .08 | .04 |
| frigate    | .90 | .95 | 1.00| .95  | .65 | .35 | .10 | .04 |
| galleon    | 1.00| .98 | .90 | .80  | .50 | .25 | .07 | .03 |

The sloop is the only ship that points well upwind. That is its survival tool against
bigger ships and must stay true after tuning (a balance-harness test checks it, see
§10.3).

### 3.2 Ship condition (applies to the player and every NPC)

```ts
interface ShipCondition {
  hullPct: number;      // 0..100
  riggingPct: number;   // 0..100
  crew: number;         // integer >= 0
  gunsIntact: number;   // 0..class.guns
}
```

Effects (pure functions in `sim/ships/condition.ts`, with tests):

- **Speed:** `maxSpeed × (0.4 + 0.6 × riggingPct/100) × crewSailFactor`, where
  `crewSailFactor = clamp(crew / (0.25 × crewTypical), 0.3, 1)`. So a ship needs about
  a quarter of its typical crew just to handle the sails properly.
- **Turn rate:** `turnRate × (0.6 + 0.4 × riggingPct/100)`.
- **Guns manned per broadside:** `min(gunsIntact/2, floor(crew / 4) / 2)`, rounded down.
  It takes four hands per gun, and each side is manned from half the crew.
- **Reload time** in combat seconds: `BASE_RELOAD_S (6) × max(1, (gunsIntact × 4) / max(crew, 1))`,
  capped at 20 s.

The world-map speed of the player uses the same speed formula, so a battered ship is
visibly slower on the way home.

### 3.3 Player ship state changes

`PlayerShip` gains `condition: ShipCondition` and a `name: string` (default
"Swallow"; renaming comes in a later slice). Gold and crew, stored invisibly in slice 1,
become visible. The ledger panel now shows gold, crew/crewMax, hull % and rigging %.
Show hull and rigging as small pixel bars with a numeric tooltip or `aria-label`.

Crew is shown against two different numbers on purpose, so label them clearly. The ledger
compares it with `crewMax` ("Crew 40 of 60 berths"): that is how many more hands the ship
can take, which matters for recruits. The combat HUD (§10.3) compares it with
`crewTypical` ("Crew 40, needs 40"): that is how many the ship needs to fight at full
efficiency.

### 3.4 Repair in port

Enable the **Shipwright** button in the port screen of any port that is not hostile to
the player (see §5.1). It opens a small panel:

- Current hull % and rigging %, and the cost to repair both to 100 %:
  `cost = round((100 − hullPct) × hullStrength × 0.4 + (100 − riggingPct) × hullStrength × 0.25)`.
- **Repair all** (disabled if the player cannot afford it), and **Repair what I can
  afford** (fills the hull first, then the rigging).
- Lost guns can be replaced at 60 gold each, up to the class maximum.
- Replacing crew is *not* here (it will be the tavern in slice 4). Recruits in this
  slice come only from prizes.
- Repairs add 2 game days to the clock per 25 percentage points repaired, counting hull
  and rigging points together, pro rata, and rounded to the nearest game hour. For
  example, +30 % hull and +20 % rigging is 50 points, which is 4 days. Replacing guns
  takes no time. Show the time before confirming.

## 4. NPC ships on the world map

### 4.1 Model (`sim/npc/`)

```ts
type NpcRole = 'trader' | 'warship' | 'pirate';
interface NpcShip {
  id: number;                     // unique within the save
  classId: ShipClassId;
  nation: NationId | 'pirate';
  role: NpcRole;
  name: string;                   // generated, e.g. "San Telmo", "Goede Hoop"
  ship: { x: number; y: number; headingRad: number; speedKn: number; sail: SailSetting };
  condition: ShipCondition;
  destPortId: string;
  path: readonly { x: number; y: number }[];   // remaining waypoints
  tack: { side: -1 | 1; untilHours: number } | null;
  intent: 'travel' | 'chase' | 'flee' | 'ignore-player';
  ignorePlayerUntilHours: number;
}
```

Ship names come from per-nation name lists in `src/data/shipNames.ts` (for example
20 or more plausible period names per nation, plus invented pirate names). Write them
fresh.

### 4.2 Navigation grid

- Build a coarse grid at load with cells of 12 × 12 world px. A cell is **navigable**
  if its centre has `distToLand ≥ 5` and at least 80 % of its pixels are water.
- A* with an octile heuristic finds paths between cells. Cache the paths between port
  harbours by `(fromPortId, toPortId)`, and compute them lazily.
- Smooth each path by removing waypoints that are in line of sight of each other
  (sample the segment every 3 px with `distToLand ≥ 3`).
- **Harbours are not always on navigable cells.** A harbour only needs `distToLand ≥ 3`,
  but a cell centre needs `≥ 5`. So snap each harbour to the nearest navigable cell
  (breadth-first over cells, up to 6 cells away) whose centre is in line of sight of the
  harbour (the same check as smoothing). Each path starts and ends with that straight leg
  between the harbour and the cell. Tortuga, Maracaibo and St. Augustine are the likely
  cases.
- Tests: every pair of ports in slice 1 Appendix B has a path, including the snapped
  harbour legs (this also verifies the straits are open). A path never crosses land.
  Smoothing never cuts a corner across land.

### 4.3 Spawning and despawning (seeded, deterministic)

- Keep a target of **6 NPC ships within 250 world px** of the player (the constant
  `NPC_TARGET_NEARBY`). Check every 2 game hours.
- Spawn position: a random navigable cell 140–240 px from the player. Prefer cells on a
  cached port-to-port path (70 %) so ships appear on plausible sea lanes.
  - The sim does not know the screen size, so it does not try to spawn off-screen, which
    would make the simulation depend on the device. Instead, the renderer fades new ships
    in (§4.5).
- **Nation:** weighted by the nations of the ports within 300 px (weight = 1 / distance),
  plus a flat 10 % chance of a pirate.
- **Role and class**, by nation:

| nation      | trader (class weights)                 | warship (class weights)           | role weights (trader / warship / pirate) |
| ----------- | -------------------------------------- | --------------------------------- | ---------------------------------------- |
| es          | fluyt 4, sloop 2, galleon 1*           | frigate 3, brigantine 2           | 60 / 40 / 0                              |
| en, fr, nl  | fluyt 4, sloop 3, brigantine 1         | frigate 2, brigantine 3           | 70 / 30 / 0                              |
| pirate      | —                                      | —                                 | 0 / 0 / 100 (class: sloop 4, brigantine 3, frigate 1) |

  `*` The galleon is allowed only when the destination or origin is Havana, Veracruz,
  Porto Bello or Cartagena. An NPC spawned on a cached port-to-port path has that path's
  start port as its origin. Otherwise its origin is the port whose harbour is nearest to
  the spawn cell.
- Initial condition: hull and rigging 85–100 %, all guns intact. Crew is a random share of
  `crewTypical`, rounded down and capped at `crewMax`:
  - warships and pirates: 80–110 %
  - traders: 48–66 %, which is 60 % × (80–110 %), because merchantmen sail short-handed
- Destination: a random port of the same nation (traders and warships), or a random
  port anywhere (pirates, who then loiter; see §4.4). Traders never go to a port
  hostile to their nation.
- **Despawn** an NPC when it is more than 320 px from the player, or when it reaches
  its destination harbour (it "enters port").
- Serialize all NPCs and the world RNG in the save.

### 4.4 World-map sailing AI (pure, `sim/npc/sail.ts`)

Each NPC produces a `ShipInput` (turn left/right, sail) every step, which is fed to the
shared `stepShip`:

1. **Travel:** steer toward the next waypoint (proportional steering with a dead band
   of ±4°). Pop the waypoint within 8 px.
2. **Tacking:** if the desired heading is within 40° of the wind's eye (relDeg > 140),
   sail close-hauled on one tack (heading = upwind ± 45°). Switch sides when the
   waypoint's bearing crosses the wind axis, or after 1.5 game days on the same tack,
   whichever comes first. This must get every class of ship to any destination
   eventually, even directly upwind.
3. **Stuck detection:** if an NPC has moved less than 3 px in 12 game hours, recompute
   its path from its current cell. If that fails, despawn it.
4. **Pirates** with no chase target sail to a random navigable cell within 150 px of
   their spawn point, pick another when they arrive, and never enter port.
5. NPCs collide with land exactly like the player (they stop and shoal). NPCs do not
   collide with each other in this slice.
6. **Chase / flee** (see §5.2) override travel while they are active.

### 4.5 Rendering on the world map

- Use the same procedural sprite approach as the player, generated per class at
  **world scale** (hull length from `worldLengthPx`, §3.1: 16–23 px), with sail colour by
  role: traders cream `#e8dcc0`, warships white `#f6f2e6`, pirates weathered grey
  `#9a978e`.
- **Rigs:** the sloop has one mast with a fore-and-aft sail, and the other classes have 2
  or 3 masts with square sails, as in §10.1. This replaces slice 1's two-square-sail
  sloop, so the player's own world sprite changes too (M2).
- **Fading:** a newly spawned NPC fades in over 1.5 s, and a despawned one fades out over
  1.5 s at its last position. This is purely presentation: the sim spawns and despawns
  instantly.
- A pennant pixel in the nation colour flies at the stern (pirates: black with one
  white pixel; an original emblem, not any historical flag).
- Within 50 px of the player, show a native-resolution label under the ship in small
  IM Fell: "Spanish fluyt" (for pirates, "Pirate brigantine"), using the nation's
  `adjective` (§5.1). Hostile ships have the label tinted red (`#e0786a`).
- The chart overlay also shows NPCs within 250 px as small dots in their nation's
  colour, without names.

## 5. Encounters

### 5.1 Relations (static in this slice)

`src/data/relations.ts` holds a simple matrix, `atWar(a, b): boolean`.

`src/data/nations.ts` gains two display fields:
- `adjective`: Spanish, English, French, Dutch (pirates use "Pirate"), for labels and
  dialogs ("Spanish fluyt").
- `sentenceName`: Spain, England, France, the Dutch Republic, for sentences ("Spain is at
  peace with the Dutch Republic").

The existing `name` (shown next to the flag on the port screen) changes from "Dutch" to
"Dutch Republic".

In 1660 the player sails under an **English letter of marque**:

- Spain is at war with England and France, and at peace with the Dutch.
- England, France and the Dutch are at peace with each other.
- Pirates are at war with everyone.

"Hostile to the player" means `atWar('en', nation)` or pirate. Attacking a ship of a
nation you are not at war with is allowed, but it increments
`reputation[nation] -= 1` in the save (used in slice 5) and shows the warning "They
fly the colours of a friendly nation. Attack anyway?" before the fight.

### 5.2 Hostile behaviour on the world map

- **Pirates and warships of hostile nations** switch to `chase` when the player is within
  **70 px** and `ignorePlayerUntilHours` has passed. A chaser steers straight at the
  player (tacking if needed) and gives up after 3 game days or at a distance over 140 px.
- **Traders of any nation** switch to `flee` when a hostile player (from their point of
  view: a player at war with them, or anyone if they are traders facing pirates) is
  within 50 px. They steer directly away from the player (with tacking as needed) and
  resume travel beyond 110 px.
- Chasing and fleeing only use information in the sim state, so they are deterministic
  and testable.

### 5.3 Starting an encounter

- **Player-initiated:** when an NPC is within **16 px**, show a prompt button (like the
  dock button, and taking priority over it) reading "Close with the Spanish fluyt".
  Enter/Space or tapping it opens the **Encounter dialog**.
- **NPC-initiated:** when a chasing NPC comes within **12 px**, the encounter dialog
  opens automatically with the heading "A Spanish frigate bears down on you!".
- The game clock pauses while the dialog is open.

### 5.4 Encounter dialog (DOM overlay, parchment)

It shows the ship's name, class, nation flag and role in period phrasing ("the Spanish
merchantman *San Telmo*, fluyt, 10 guns"), a rough strength estimate ("She looks
heavily crewed" when her crew is more than 1.5 × yours, "She looks undermanned" when
it is less than 0.6 ×), and the relation line, built from `sentenceName` ("Spain is at
war with England").

Buttons:

- Player-initiated: **Attack** and **Leave her be** (Leave sets the NPC's
  `ignorePlayerUntilHours` to now + 12 h if it is not hostile).
- NPC-initiated: **Stand and fight** and **Try to run**.
  - Escape chance = `clamp(0.5 + (vPlayer − vEnemy) / 6, 0.1, 0.9)`. Both speeds are
    **speeds made good** from steady-state world-map speeds: the target speed from each
    ship's polar and condition, the current wind and full sail, not their current speed.
    Sample headings every 5°.
    - `vPlayer` = max over headings `h` within ±90° of directly away from the enemy of
      `speed(h) × cos(h − awayBearing)`.
    - `vEnemy` = max over headings `h` within ±90° of directly toward the player of
      `speed(h) × cos(h − towardBearing)`.

    So the player's best course away counts, and a chaser that has to beat upwind is
    slow. Running upwind from a frigate in a sloop should usually succeed, and running
    downwind rarely.
  - On success: "You showed them your stern." The chaser gets
    `ignorePlayerUntilHours = now + 72 h`, and the player gets a free 20 px separation
    along their heading (checked against land).
  - On failure: "They're too quick for us!" and combat starts, with the enemy starting
    closer (see §6.2).

Attacking the ship or failing to run switches to `combat` mode.

## 6. Combat mode

### 6.1 Principles

- The combat simulation (`sim/combat/`) is **pure and deterministic**:
  `stepCombat(state, playerInput, dt): CombatEvent[]`. The AI is also pure
  (`sim/combat/ai.ts`: `decide(state, shipIndex): ShipInput`). The RNG is a child
  stream forked per encounter.
- Combat runs in real time at a fixed 60 Hz step. It pauses on **P**/**Esc** (a pause
  overlay with "Resume" and "Surrender"). It also pauses when the tab is hidden: on
  `visibilitychange` to hidden, combat enters the same paused state, so the player comes
  back to the pause overlay and resumes explicitly.
- The world clock advances by a flat **6 game hours** per combat, applied at the end.
- The wind is fixed for the whole fight: the world wind's direction and speed at the
  moment the fight starts.

### 6.2 Arena

- An open-sea rectangle of **720 × 480 combat px**, with no land in this slice.
- The combat speed scale is `COMBAT_PX_PER_KN_S = 2.4` px/s per knot, so a 9-kn sloop
  crosses the arena in about 33 s.
- **Start positions:**
  - Player-initiated: the ships are 220 px apart, placed so that their relative bearing
    matches the world map (the side the enemy was on, relative to your heading,
    stays the same). Both keep their world headings.
  - NPC-initiated after a failed escape: 150 px apart, the enemy upwind of the player.
- **Camera:** it centres on the midpoint of the two ships, clamped to the arena, at the
  same pixel scale as the world view. If both ships no longer fit on screen, it
  follows the player, and a **pointer arrow** at the screen edge shows the direction and
  distance to the enemy.
- **Leaving the arena:** a ship whose centre crosses the arena boundary has escaped.
  If it's the player, the result is "You slipped away". If it's the enemy, the result
  is "She got away". Draw a subtle vignette in the last 40 px near the edge as a warning.

### 6.3 Ship control

The ships use the same `stepShip` physics as the world map, with combat scale constants
and condition-adjusted speed and turn rate (§3.2).

Player input:

| Action                       | Keyboard       | Touch                      |
| ---------------------------- | -------------- | -------------------------- |
| Turn to port / starboard     | ← → / A D      | ◀ ▶ (hold)                 |
| Hoist / reef                 | ↑ ↓ / W S      | Hoist / Reef               |
| Fire port broadside          | Q              | (via Fire)                 |
| Fire starboard broadside     | E              | (via Fire)                 |
| Fire the broadside that bears on the enemy | Space | **Fire** (large button)   |
| Pause                        | P / Esc        | ‖ button in the HUD        |

"The broadside that bears" is the side on which the enemy's bearing lies (port if the
relative bearing is in (−180°, 0°), otherwise starboard). If that side is still
reloading, pressing Fire does nothing and the HUD flashes that side's reload indicator.

### 6.4 Broadsides and projectiles

- Firing a side launches `n = gunsMannedPerBroadside` balls, evenly spaced along the
  middle 70 % of the hull length on that side, one every 60 ms (a rippling broadside).
- Each ball travels perpendicular to the hull (heading ∓ 90°), plus the ship's own
  velocity vector, plus a random angular spread of **±6°**, at **110 px/s**.
- **Range:** a ball flies 150 px, then splashes. There is no gravity or arc simulation.
  In the last 20 % of its flight it can only hit hulls (not rigging), which models low,
  spent shot.
- **Hit test:** point in oriented ellipse (the target hull, `lengthPx × beamPx`). A ball
  hits at most once. A ship's own balls never hit it.
- **Reload:** each side reloads independently, taking the reload time from §3.2. The
  firing side's timer starts when its last ball leaves.
- Make all the constants above named values in `src/data/combat.ts`.

### 6.5 Hit resolution (seeded)

Each hit rolls a location:

| Location | Weight | Effect                                                            |
| -------- | ------ | ----------------------------------------------------------------- |
| Hull     | 55     | `hullPct −= rand(4, 7) × 60 / hullStrength`; plus a 10 % chance to destroy one gun |
| Rigging  | 30     | `riggingPct −= rand(5, 9) × 60 / hullStrength`                    |
| Crew     | 15     | `crew −= randInt(1, 3)`                                           |

The factor `60 / hullStrength` normalises damage to the sloop (hull 60): a sloop loses
4–7 % hull per hull hit, and a galleon (hull 220) loses about 1–2 %. Keep the damage
calculation in one function with tests, and clamp all values at 0.

### 6.6 End conditions (checked every step, in this order)

1. **Sinking:** `hullPct ≤ 0`. The ship sinks over 3 s (animation), and the fight ends
   when the animation completes.
2. **Striking colours** (NPC only): the NPC surrenders when
   `crew < 0.25 × its starting crew`, or when `hullPct < 20` and
   `playerCrew > 1.5 × npcCrew`. Traders surrender earlier: `hullPct < 40`, or at their
   first rigging hit that drops `riggingPct` below 50 while the player is within 80 px.
   The flag drops, and the ship stops (sails furled) and drifts. The player then has to
   come alongside (boarding contact, see 3) to take possession. There is no fight;
   the prize screen opens directly.
3. **Boarding:** the hull ellipses of the two ships overlap and their relative speed
   is below 4 kn, or they overlap for more than 1.5 s at any speed. Both ships stop. If
   the enemy has struck, go straight to the prize screen. Otherwise resolve the
   boarding with the placeholder resolver (§9).
4. **Escape:** a ship crosses the arena boundary (§6.2).
5. **Player surrender:** via the pause menu (only available while the enemy is not a
   trader). Treat it as a defeat (§8.3).

Ramming does no hull damage in this slice. Overlap resolution: separate the ships along
the line between their centres so that they never pass through each other.

## 7. Combat AI (`sim/combat/ai.ts`)

The AI is pure: it looks at the combat state and returns a `ShipInput` plus fire
commands. Each role is a small state machine. Common helpers: `bearingTo`, `relWind`,
`broadsideBears(ship, target, arcDeg)` and `timeToReload(side)`.

**Firing (all roles):** fire a side when it is loaded, the target's centre lies within
**±15°** of that side's beam, and the range is under 130 px. At `difficulty < 1`, add
a reaction delay of `0.4 s / difficulty` before firing.

**Trader:**
- State `flee`: take the heading that maximises distance from the player, restricted to
  headings with a polar factor ≥ 0.6 (it never points into the wind to flee). It aims
  for the nearest arena edge in that direction.
- It fires only when a broadside bears incidentally, and never turns to bring guns to
  bear.
- It surrenders early (§6.6).

**Warship:**
- State `engage`: pick the side (port or starboard) whose guns are loaded, or will
  be loaded soonest. Aim for a **station point** 80 px abeam of the player on the chosen
  side, and steer to put the player on its beam. When the player is upwind and the
  station point lies in the no-go zone, tack (the same rule as §4.4, with timers in
  combat seconds).
- If `ownCrew > 1.5 × playerCrew` and `ownHull > 50`, switch to `board`: steer to
  intercept (a lead pursuit using the player's velocity).
- If `ownHull < 25` and it is not stronger in crew, switch to `withdraw`: act like a
  trader fleeing, but keep firing.

**Pirate:** like a warship, but it switches to `board` at `ownCrew > 1.2 × playerCrew`,
and it withdraws only when `ownHull < 15`.

**Difficulty:** a global `difficulty` in `src/data/combat.ts` (default 1.0) scales the
AI reaction delay and adds `±(1 − difficulty) × 8°` of aim noise to the AI firing arc
check. Only the default value is exposed in this slice.

## 8. Outcomes

### 8.1 Prize (enemy struck or lost the boarding)

A parchment result screen shows:

- "The *San Telmo* is yours!"
- **Plunder:** `round(cargoValue × rand(0.6, 1.4) × roleFactor)`, where
  `roleFactor` = trader 1.0, warship 0.5, pirate 0.8. It is added to gold.
- **Recruits:** `floor(survivingEnemyCrew × rand(0.1, 0.3))`, capped by the player's
  `crewMax − crew`. The line reads "12 of her crew sign on with you."
- **Options:**
  - **Take her as your ship.** You swap classes: the player's `classId` becomes the
    prize's class and the player's condition becomes the prize's condition (hull, rigging,
    guns). Your crew transfers, capped at the new `crewMax`. Your old ship is lost. Show a
    one-line comparison first ("Frigate: 28 guns, 8 kn. Slower upwind than your sloop.").
  - **Sink her**, or **Let her go.** Both despawn the NPC. For a nation you are not at
    war with, *Let her go* halves the reputation penalty.
- Record the result in `stats` (ships captured, sunk and by nation) and in
  `reputation`.

### 8.2 Enemy sank or escaped

- Sank: "She went down with all hands. No plunder." Record it in the stats.
- Escaped: "She got away." The NPC returns to the world map at the matching position,
  with `ignorePlayerUntilHours = now + 48 h` and its damage kept.

### 8.3 Defeat (player sank, lost the boarding, or surrendered)

Show the heading "Your ship is lost." The player:

- loses half their gold,
- is put ashore at the **nearest port that is not hostile** with a repaired **sloop**
  named as before, `crew = 12`, all guns and 100 % condition,
- has the clock advanced by 14 days.

Record the defeat in `stats.defeats`. This is intentionally mild. Harsher
consequences belong to the career layer in slice 5.

### 8.4 Player escaped

"You slipped away." Return to the world map with the NPC set to
`ignorePlayerUntilHours = now + 24 h`, and move the player 25 px from the NPC along the
player's heading (checked against land).

After every outcome the game auto-saves and returns to `sailing` mode.

## 9. Boarding (placeholder resolver)

Slice 3 will replace this with a captain's sword duel. Keep it behind an interface:

```ts
interface BoardingResolver {
  resolve(attacker: CrewSide, defender: CrewSide, rng: Rng): BoardingResult;
}
interface CrewSide { crew: number; startingCrew: number; isPlayer: boolean }
interface BoardingResult {
  winner: 'attacker' | 'defender';
  rounds: { attackerCrew: number; defenderCrew: number }[];
}
```

The placeholder, `MeleeBoardingResolver`, resolves the fight in rounds. In each round,
each side loses `ceil(opponentCrew × 0.08 × rand(0.5, 1.5))`. A side yields when it
drops below 30 % of its starting crew or below 50 % of the other side's current crew.
The defender gets a 10 % bonus (it applies the 0.08 as 0.088). If both sides meet a yield
condition in the same round, the side left with the larger fraction of its starting crew
wins, and on an exact tie the defender wins. Cap the fight at 30 rounds; if it's still
undecided, the side with more crew wins (on a tie, the defender).

**Melee overlay:** a small parchment panel titled "Boarding!" that animates the two crew
counts through the rounds over about 3 s (one round every 100–150 ms), then shows
"We carried the deck!" or "We were driven back!". The player can skip it with a tap or
key press. A player victory leads to the prize screen, and a loss leads to defeat.

Tests: determinism with a fixed seed. 60 vs 30 crew wins more than 90 % of the time
over 500 seeds. 30 vs 30 lands between 35 and 65 % for the attacker (the defender bonus
shows). There is never more than 30 rounds.

## 10. Rendering, HUD and effects

### 10.1 Combat sprites (`render/sprites/ship.ts`, extended)

- For each class, generate **32 headings × {set, furled, struck}** at the class's
  `lengthPx × beamPx`, using the same quantise-and-outline pipeline as slice 1.
- **Details by class:** masts (1–3 square sails across the beam, fore-and-aft on the
  sloop), a raised sterncastle as a lighter block on the fluyt and galleon, and a row of
  gunport pixels (dark) along each side equal to `guns/2`, capped by the hull length.
- **Damage variants:** when `riggingPct < 60`, punch 2–4 transparent "holes" in the sails
  (seeded per ship). When it is below 30, draw only one sail. Holes are applied at
  runtime as a mask, so you don't need extra sprite sets.
- The flag at the stern is in the nation's colours. On striking, the flag disappears
  and a white 2×2 pixel square appears.

### 10.2 Effects (all in `render/effects/`, pooled and with no per-frame allocation)

- **Muzzle smoke:** each ball spawns a 3–5 px puff at the gunport. Puffs grow, fade over
  2.5 s and **drift with the wind** at 30 % of the wind speed. This is the main visual cue
  for wind direction in combat, so it matters.
- **Balls:** 1 px dark pixels with a 1 px lighter trail.
- **Splash:** a white 3-frame ring where a ball ends in the water.
- **Hull hit:** 4–6 brown splinter pixels flying out, plus a brief flash of the sprite
  (one frame lighter).
- **Rigging hit:** 2–3 cream "canvas" pixels drifting downwind.
- **Sinking:** over 3 s the sprite shrinks vertically by rows from bow to stern, bubbles
  rise, and then a floating debris field (5–8 brown pixels) remains for the rest of the
  fight.
- **Wake:** as in slice 1, scaled to the ship's length.
- The water shows the slice 1 deep-ocean colour with sparkles. Also draw a faint
  horizontal **swell** pattern (a dithered darker band every 16 px) moving downwind
  at 4 px/s. Disable it under `prefers-reduced-motion`.

### 10.3 Combat HUD (DOM)

- **Top-left: your ship.** Name, class, crew against `crewTypical` ("Crew 40, needs 40";
  see §3.3), guns manned per side, and pixel bars for hull and rigging.
- **Top-right: the enemy.** Nation flag, name, class, crew as an *estimate* (rounded to
  the nearest 10 while the range is over 100 px, exact inside it), and bars for hull and
  rigging.
- **Bottom-centre: reload indicators.** Two segmented bars labelled PORT and STARBOARD,
  which fill as the guns reload and glow brass when ready. The side that bears on the
  enemy is highlighted.
- **Wind compass:** the slice 1 compass component, reused and smaller.
- **Range readout:** "Range 120 yds". Show combat px × 3 as yards, flavour only, but
  consistent everywhere.
- **Messages:** "Her mainmast is damaged!", "She's striking her colours!", "We're taking
  water!" (player hull below 30 %), "Grapples ready — close to board!" (the AI enemy has
  struck and the player is within 60 px).
- **Touch layout:** ◀ ▶ bottom-left, a large **Fire** bottom-right, Hoist/Reef stacked
  above Fire, and ‖ (pause) at the top-centre. All buttons are at least 56 px and
  respect safe areas.

### 10.4 Balance harness (`scripts/balance.ts`, run with `npm run sim:balance`)

`npm run sim:balance` runs the TypeScript script under Node with `tsx` (MIT), added as a
**dev** dependency only; it never ships in the build.

Headless: it runs AI vs AI (the player side is driven by the **warship** AI unless
stated) for N seeded fights per matchup, and prints a table of win, strike, sink,
board and escape rates and the average fight duration. It needs no DOM and imports only
`sim/`.

Matchups, with **target outcomes** that are also Vitest assertions at N = 200
(`tests/balance/balance.test.ts`, allowed to take up to about 20 s).

These tests are slow, so they are **not** part of `npm test` or `npm run check`:
- the Vitest config excludes `tests/balance/`
- a separate `npm run test:balance` runs them
- CI runs `npm run check` and then `npm run test:balance`
- run `test:balance` locally before committing any change to combat code or to
  `data/ships.ts`/`data/combat.ts`

| Player side vs NPC        | Target                                                      |
| ------------------------- | ----------------------------------------------------------- |
| sloop vs sloop            | Player win rate 40–60 %                                     |
| brigantine vs sloop       | Player win rate ≥ 70 %                                      |
| sloop vs frigate          | Player win rate ≤ 20 %                                      |
| sloop (flee AI, wind on the beam or upwind of the frigate) vs frigate | Player escapes ≥ 60 % |
| frigate vs fluyt (trader) | Fluyt escapes ≤ 40 %, and it strikes in most of the rest    |
| any                       | Average fight 40–150 s; no fight exceeds 600 s (hard cap → draw, which counts as an escape) |

If the targets can't be met by tuning the constants in `src/data/combat.ts` and
`ships.ts`, write an ADR that explains what you changed in the model and why.

## 11. Persistence: save v2

- Key `tradewind.save.v2` (keep reading `v1` and migrating it).
- New fields: `ship.name`, `ship.condition`, `npcs: NpcShip[]`, `nextNpcId`,
  `rngState`, `reputation: Record<NationId, number>`, and
  `stats: { captured, sunk, defeats, escapedFrom, byNation }`. The player's crew moves
  from v1's top-level `crew` into `ship.condition.crew`.
  - `stats`: `captured`, `sunk` and `defeats` count fights won by capture, by sinking,
    and lost. `escapedFrom` counts fights the player escaped from.
  - `byNation` is `Record<NationId | 'pirate', { captured: number; sunk: number }>`.
  - All values are integer counts starting at 0.
- **Migration v1 → v2:** give the player's sloop full condition, the v1 `crew` (always 40
  in slice 1) and all 8 guns; set `npcs = []`; seed the RNG from a hash of the v1 save
  contents so it stays deterministic.
- The v1 key is read only while no v2 save exists, and it is never deleted. An invalid v2
  save does not fall back to v1, so an older voyage is never silently resurrected.
- **Never save mid-combat.** If the page is closed during combat, the save from just
  before the encounter is loaded next time. Auto-save right before entering combat mode
  so that this holds.
- **Validation:** all NPCs must be on water and inside the world, reference valid port
  ids and have valid condition ranges. An invalid NPC is dropped (without invalidating the
  save), and a warning is logged in dev builds.
- Tests: the v1 → v2 migration, round-trips, and dropping invalid NPCs.

## 12. Performance

- The world map with up to 10 NPCs holds 60 fps. NPC AI steps at 10 Hz, not 60 Hz; only
  physics runs at 60 Hz.
- The navigation grid and first path cache build take under 150 ms together at load.
  Compute other paths lazily, and never more than 2 per frame.
- The combat scene holds 60 fps with up to 400 live particles and 40 balls. Use pooled
  arrays and no per-frame allocation.
- The balance harness runs 200 fights of one matchup in under 5 s on a laptop, so the
  simulation must be able to step without rendering and faster than real time.

## 13. Milestones (implement and commit in order)

| #  | Milestone | Visible result |
| -- | --------- | -------------- |
| M0 | Reconciliation ADR; generalise `stepShip`; RNG serialisation and forking; save v2 scaffolding and migration (+ tests) | No visible change; tests green |
| M1 | Ship classes and polars; `ShipCondition` and its effects (+ tests); ledger shows gold, crew, hull and rigging; Shipwright repair panel | Damage visible in the HUD (use a dev-only key to damage your ship); repair works in port |
| M2 | Navigation grid and A* with smoothing (+ tests); NPC model, spawn/despawn, world sailing AI with tacking (+ tests); world-scale NPC sprites and labels; NPCs on the chart | Ships sail the lanes between ports |
| M3 | Relations; chase and flee behaviour (+ tests); encounter prompt and dialog; escape roll | You can be hunted, and can run or choose to fight (the fight starts an empty placeholder combat mode) |
| M4 | Combat simulation: arena, physics, broadsides, projectiles, hit resolution, end conditions (+ tests, including the determinism test "same seed + same inputs = same outcome") | A fight is playable against a stationary target |
| M5 | Combat AI for the three roles; balance harness and balance tests; first tuning pass | `npm run sim:balance` prints the table and the targets are met |
| M6 | Combat rendering: sprites per class and damage, effects, combat HUD, touch layout, pause | Full combat experience |
| M7 | Outcomes: prize screen, ship swap, sink/let go, defeat, escape; boarding resolver and melee overlay (+ tests); auto-save rules | The full loop from encounter to the world map |
| M8 | Polish and tuning pass, performance check, README update, acceptance run-through | Deployed to the VPS |

## 14. Acceptance criteria (manual checklist)

- [ ] Within a minute of sailing from Bridgetown, several ships are visible, sailing
      plausibly toward ports. They tack when heading east and never sail over land. New
      ships fade in rather than popping into view.
- [ ] Spanish warships and pirates start chasing when you come near. Merchantmen turn
      and run. English, French and Dutch warships ignore you.
- [ ] The encounter dialog shows the correct nation, class, name and strength hint. The
      friendly-nation warning appears before attacking a Dutch fluyt.
- [ ] Running from a frigate in a sloop succeeds most of the time when you run upwind,
      and rarely when you run downwind.
- [ ] In combat, the muzzle smoke clearly drifts downwind. Turning into the wind slows
      your ship exactly as on the world map.
- [ ] The broadsides ripple, reload independently, and are visibly slower with a
      depleted crew. The Fire button always fires the side that bears.
- [ ] Hits produce the right effects and damage. Rigging damage visibly slows the
      target. Sail holes appear below 60 % rigging.
- [ ] A fluyt usually strikes after a few hits, and you have to come alongside to take
      her. The boarding overlay plays and can be skipped.
- [ ] Sinking an enemy gives no plunder. Capturing one gives gold and recruits. "Take
      her as your ship" works, and your new ship sails with its own polar (a galleon is
      noticeably poor upwind).
- [ ] Losing a fight puts you ashore at the nearest non-hostile port in a sloop with 12
      crew and half your gold, 14 days later.
- [ ] Sailing off the arena edge ends the fight for either side. The enemy is still on
      the world map afterwards if it escaped, with its damage kept.
- [ ] Repairing at a friendly port shows the cost and the days taken. It is disabled at
      hostile (Spanish) ports.
- [ ] Reloading the page mid-combat restores the pre-encounter save. A v1 save from slice
      1 still loads.
- [ ] Touch: you can steer, hoist, reef, fire and pause in portrait and landscape on a
      phone, with no stuck buttons.
- [ ] `npm run check` and `npm run test:balance` pass, and `npm run build` succeeds. The
      game runs the same on the VPS.
- [ ] No names, art or text are taken from the original game (see `CLAUDE.md`).

## 15. Open questions (decide in an ADR if they come up)

- **Land in the arena** for fights near a coast (shoals as a tactical weapon) is a strong
  feature for later. Keep the arena as a type with an optional `landMask` so it can be
  added without restructuring.
- **Crew morale** affecting surrender and reloading belongs to slice 4 (crew, food and
  pay). Leave a `morale` field out of the model for now rather than adding an unused
  stub.
- **NPC vs NPC fights** (a pirate attacking a merchant off-screen) are tempting but out
  of scope. Note any ideas in `docs/design/`.
