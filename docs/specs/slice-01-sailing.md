# Slice 1: Sailing the Caribbean

Status: ready for implementation
Depends on: nothing (first slice; also sets up the project)
Read first: `CLAUDE.md` (architecture, conventions and IP rules apply throughout)

## 1. Goal

A player opens the game in a browser, sees a pixel-art Caribbean, and sails a single
ship around it. The wind decides how fast they go. They can find the ports of four
nations, "drop anchor" in any of them, and set sail again. The game date advances
while they sail, and their voyage survives a page reload.

The slice is done when sailing feels good: the point of sail matters, turning is
responsive, coasts block you, and crossing the Caribbean takes about a minute of real
time.

### In scope

- Project scaffolding (Vite + TS + Vitest + ESLint/Prettier), game loop and mode
  state machine
- World map generated from coastline data: land mask, distance fields and a rendered,
  dithered pixel-art map
- 21 ports with harbour positions, town markers, nation flags and name labels
- Wind model and point-of-sail speed model (polar table)
- One player ship (a sloop): steering, sail settings, acceleration, collision with land
  and the map edges, wake effect
- Camera that follows the ship
- HUD: date, ship summary, compass with wind and heading, speed, point of sail and
  sail setting
- Port screen (a placeholder menu with the future buttons disabled)
- Full-map "Chart" overlay
- Title screen with New voyage / Continue voyage
- Keyboard and touch controls
- Save/load in localStorage; auto-save
- Unit tests for all simulation code

### Out of scope (later slices; do not build)

Other ships at sea, combat, crew morale and food, trade and economy, governors,
missions, nations' relations, storms, day/night, sound and music, multiple ship
types (keep the data model ready for them, but ship only the sloop).

## 2. Project setup (Milestone 0)

- `npm create vite@latest` with the vanilla-ts template, then trim the demo content.
- `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `exactOptionalPropertyTypes`.
- Add Vitest, ESLint (flat config, typescript-eslint recommended-type-checked) and
  Prettier. Add the npm scripts listed in `CLAUDE.md`.
- Create the directory layout from `CLAUDE.md`, a minimal `README.md` and
  `THIRD_PARTY.md` (list the Google Fonts used).
- `index.html`: title "Tradewind Corsair", a viewport meta with
  `viewport-fit=cover`, a theme-color of the deep sea colour, and one root element.
  `body` has no margin, no scroll, and a background set to the deep sea colour.
- Font loading: *IM Fell English*, *IM Fell English SC* and *VT323* from Google Fonts,
  with serif/monospace fallbacks. Wait for `document.fonts.ready` (with a 1.5 s timeout)
  before the first label draw.

## 3. World and coordinates

### 3.1 Projection

Use a simple equirectangular projection over the Caribbean.

| Constant | Value | Meaning                     |
| -------- | ----- | --------------------------- |
| `LON_MIN` | −98  | west edge (degrees)         |
| `LON_MAX` | −59  | east edge                   |
| `LAT_MIN` | 7    | south edge                  |
| `LAT_MAX` | 30   | north edge                  |
| `PPD`     | 40   | world pixels per degree     |

World size is `(LON_MAX−LON_MIN)·PPD × (LAT_MAX−LAT_MIN)·PPD` = **1560 × 920** world
pixels.

```
x = (lon − LON_MIN) · PPD
y = (LAT_MAX − lat) · PPD
```

Provide `lonLatToWorld` and `worldToLonLat` in `sim/world/projection.ts`, with tests.

### 3.2 Distances and time scale

- 1° of latitude = 60 nautical miles, so **1 world pixel = 1.5 nm** (`PX_PER_NM = 40/60`).
  Treat longitude the same way; the distortion is acceptable for a game.
- **Time scale: 1 real second = 4 game hours** (`GAME_HOURS_PER_SECOND = 4`), so one
  game day ≈ 6 real seconds.
- Ship movement per second in world pixels = `speedKn × PX_PER_NM × GAME_HOURS_PER_SECOND`
  (≈ 2.67 px/s per knot). A sloop making 8 kn crosses the 1560-px map in about 70 s.
  That is the intended feel. Keep these as named constants so they are easy to tune.

### 3.3 Geography data

`src/data/geography.ts` exports:

- `MAINLAND: readonly [lon, lat][]` is one polygon covering North, Central and northern
  South America. It closes via points outside the map bounds so the whole mainland is
  filled.
- `ISLANDS: readonly { name: string; points: readonly [lon, lat][] }[]` holds the larger
  islands as polygons.
- `ISLETS` holds small islands as ellipses, stored as tuples
  `[name, lon, lat, rxDeg, ryDeg]`. Map them to a typed
  `{ name; lon; lat; rxDeg; ryDeg }` structure at load.

Starting data (coarse, hand-made from general knowledge) is in **Appendix A**. It is
deliberately low-detail. Use it as-is for this slice. Refining coastlines is
welcome later, but getting the geography perfect is not the goal of this slice.

### 3.4 Land mask and distance fields (pure, in `sim/world/`)

1. **Rasterise** all polygons and ellipses into `landMask: Uint8Array(W·H)` (1 = land).
   Use a pure scanline polygon fill (even-odd, sample at pixel centres) so it runs in
   Vitest without a canvas. Ellipses: a pixel is land if its centre is inside.
2. **Distance fields.** Use a two-pass chamfer distance transform (weights 1 and √2):
   - `distToLand: Float32Array` holds, for each water pixel, the distance to the
     nearest land pixel (0 on land).
   - `distToWater: Float32Array` holds, for each land pixel, the distance to the
     nearest water pixel (0 on water).
3. Out-of-bounds positions count as land for collision purposes.
4. Expose `isLand(x, y)` and `distToLandAt(x, y)` with integer flooring and bounds
   checks.

Tests: a small synthetic polygon (such as a 10×10 square in a 30×30 grid) gives
the expected mask and distance values. Out-of-bounds is land. The real map has
Jamaica as land and the Windward Passage as water (sample known points).

### 3.5 Map rendering (in `render/map/`)

Build one offscreen canvas of W × H at load, deterministically (seeded noise). Target
under 400 ms on a mid-range laptop, and log the build time in dev builds.

**Water**, by `distToLand` `d`, with a Bayer 4×4 offset `b ∈ [0,1)` added as
`t = d + (b − 0.5) · 3` so the bands dither into each other:

| Band        | Condition   | Colour    |
| ----------- | ----------- | --------- |
| Surf        | `t < 1.5`   | `#cfe6d6` |
| Shallows    | `t < 5`     | `#4aa3a8` |
| Reef shelf  | `t < 11`    | `#2f7d97` |
| Coastal sea | `t < 22`    | `#23608a` |
| Open sea    | `t < 45`    | `#1c4c78` |
| Deep ocean  | otherwise   | `#173f69` |

For `d > 22`, add `noise·10` to `t` so the open ocean gets gentle patches.

**Land**, by `distToWater` `dw` and fractal value noise `n ∈ [0,1]` (two octaves: scale
28 px at weight 0.65, scale 9 px at weight 0.35):

- Beach: `dw < 2.2 + (b − 0.5)` → sand `#dcc68e`
- Otherwise elevation `e = min(dw, 30) · 0.55 + n · 22 + (b − 0.5) · 3`:

| Terrain  | Condition | Colour    |
| -------- | --------- | --------- |
| Grass    | `e < 9`   | `#6f9a45` |
| Scrub    | `e < 15`  | `#4f7f3a` |
| Forest   | `e < 21`  | `#3a6630` |
| Jungle   | `e < 27`  | `#2e5028` |
| Hills    | `e < 31`  | `#76703f` |
| Mountain | `e < 35`  | `#8b6b47` |
| Peaks    | otherwise | `#b3a07f` |

These thresholds are a starting point. Tune them by eye, but keep them in one table in
`render/palette.ts`.

**Towns** are stamped onto the map canvas at each port's town pixel (see §4). Use a 3×3
grey fort (`#8c8a86`) with a dark pixel "gate", plus 4–6 single-pixel roofs (`#b04a2e`)
and walls (`#e8e0cc`) scattered within 3 px, but only on land pixels. Use a seeded
layout per port so it never changes between loads.

## 4. Ports

`src/data/ports.ts`, typed:

```ts
type NationId = 'es' | 'en' | 'fr' | 'nl';
interface PortDef {
  readonly id: string;          // kebab-case, stable (used in saves)
  readonly name: string;
  readonly nation: NationId;
  readonly lon: number;
  readonly lat: number;
  readonly blurb: string;       // one original sentence, shown in port
}
```

The full list is in **Appendix B**. Nations (`src/data/nations.ts`) carry a display
name and flag colours:

| Id   | Name    | Flag (drawn as 3 stripes/pixels)       |
| ---- | ------- | -------------------------------------- |
| `es` | Spain   | `#b3261e` / `#e7c12e` / `#b3261e`      |
| `en` | England | `#f2f2f2` with a `#c8102e` cross pixel |
| `fr` | France  | `#2a4fa8` / `#f2f2f2` / `#2a4fa8`      |
| `nl` | Dutch   | `#e07a1f` / `#f2f2f2` / `#2a4fa8`      |

Flags are original, simplified pixel emblems, not historical reproductions.

### 4.1 Derived port geometry (pure, computed at load)

Coarse coastlines mean a port's real coordinates may land in water or deep inland,
so derive usable positions:

1. `town` is the nearest **land** pixel to the port's projected coordinate (search
   outward ring by ring, max radius 40 px).
2. `harbour` is the nearest **water** pixel to `town` with `distToLand ≥ 3`
   (max radius 40 px). This is where the ship docks and where it reappears
   when leaving.
3. If either search fails, throw during development with the port id. A unit test
   asserts that every port in Appendix B resolves.

### 4.2 Docking

- The ship is **near** a port when its distance to `harbour` is ≤ 18 world px. If
  several are near, pick the closest.
- When near, show a prompt button "Drop anchor at {name}" (and accept Enter/Space).
- Docking sets `mode = 'port'`, sets speed to 0, and triggers an auto-save.
- **Port screen** (DOM overlay, parchment style) shows:
  - the port name (IM Fell English SC, large) and the nation name with its flag
  - the blurb (IM Fell English, italic)
  - the current date
  - four disabled buttons: *Governor*, *Tavern*, *Merchant*, *Shipwright*, each
    with the small caption "Coming soon"
  - one enabled button: **Set sail**
- **Set sail** places the ship at `harbour`, sets the sail to full, speed to 0, and
  points the heading at open water. Sample 32 directions and pick the one whose
  point 20 px out has the largest `distToLand`. It then returns to `sailing`.

## 5. Wind

A single global wind (no spatial variation in this slice), in `sim/sailing/wind.ts`.
It is a pure function of game time, so it needs no state and no randomness:

```
days = elapsedHours / 24
towardRad = BASE_TOWARD + 0.45·sin(days/9) + 0.25·sin(days/2.3 + 1)
speedKn   = clamp(12 + 4·sin(days/5 + 2) + 2·sin(days·1.7), 5, 20)
```

- `towardRad` is the direction the wind blows **toward**, in screen convention.
- `BASE_TOWARD = π − 0.35` means the wind blows toward the WSW, i.e. the **trade
  winds come from the ENE**, which matches the real Caribbean. Over time the wind
  swings roughly between E and NE with occasional SE, so heading east is usually
  hard work. That asymmetry is the heart of Caribbean sailing and should be kept.
- Also expose `fromBearingDeg` for display (compass bearing the wind comes from).

Tests: the output is deterministic, speed stays within [5, 20], and the average
direction over 365 days lies within ±20° of BASE.

## 6. Ship model

### 6.1 Data

`src/data/ships.ts`:

```ts
interface ShipClass {
  readonly id: 'sloop';           // union grows in later slices
  readonly name: string;          // "Sloop"
  readonly guns: number;          // 8 (display only in this slice)
  readonly maxSpeedKn: number;    // 9
  readonly turnRateRadPerSec: number; // 1.6 at full way
  readonly accelPerSec: number;   // 0.7 (fraction of gap closed per second)
  readonly polar: readonly (readonly [relDeg: number, factor: number])[];
}
```

The sloop polar, where `relDeg` is the angle between the ship's heading and the
wind's *toward* direction (0° means the wind is dead astern, 180° means head to wind):

| relDeg | factor | Point of sail                   |
| ------ | ------ | ------------------------------- |
| 0      | 0.72   | Running                         |
| 30     | 0.78   |                                 |
| 60     | 0.90   | Broad reach                     |
| 90     | 1.00   | Beam reach                      |
| 120    | 0.86   | Close-hauled                    |
| 135    | 0.60   |                                 |
| 150    | 0.18   | In irons (starts here)          |
| 180    | 0.05   |                                 |

Interpolate linearly between rows.

### 6.2 Player ship state

```ts
interface PlayerShip {
  x: number; y: number;         // world px (float)
  headingRad: number;           // screen convention, normalised to (−π, π]
  speedKn: number;
  sail: 'furled' | 'half' | 'full';
  classId: ShipClass['id'];
}
```

### 6.3 Update (fixed step `dt` seconds, pure: `stepShip(ship, input, wind, world, dt)`)

1. **Steering:** `turn = turnRateRadPerSec · (0.4 + 0.6 · min(1, speedKn/4))`, so the
   ship still turns slowly when nearly stopped. Turning left subtracts from
   `headingRad`, and turning right adds.
2. **Target speed:**
   `target = maxSpeedKn · polar(relDeg) · clamp(wind.speedKn/14, 0.45, 1.3) · sailFactor`,
   with `sailFactor` = furled 0, half 0.55 and full 1.
3. **Acceleration:** `speedKn += (target − speedKn) · min(1, accelPerSec · dt)`.
4. **Movement:** compute the next position from speed and heading using the time
   scale (§3.2).
5. **Collision:** if `isLand` holds at the next position, **or** at a bow probe 7 px
   ahead along the heading, the ship does not move and `speedKn = 0`. Emit a
   `'shoal'` event, which the UI shows as "Breakers ahead! Bring her about." and
   rate-limits to once per 3 s. The player can always turn away, since turning is
   never blocked.
6. **Map edge:** covered by out-of-bounds counting as land.

Events are returned as a list from the step function (for example
`[{ type: 'shoal' }]`) and are not dispatched as callbacks from inside the sim.

### 6.4 Point of sail label

| relDeg    | Label        |
| --------- | ------------ |
| < 30      | Running      |
| 30–70     | Broad reach  |
| 70–110    | Beam reach   |
| 110–145   | Close-hauled |
| ≥ 145     | In irons     |

### 6.5 Tests (required)

- Angle normalisation and difference across the ±π seam.
- The polar lookup at the table rows and in between.
- A ship pointing straight downwind at full sail and 14 kn wind converges to
  `9 · 0.72` kn.
- A furled sail decelerates to about 0.
- Beam reach beats running beats close-hauled beats in irons.
- A ship heading into a synthetic land block stops before entering it and emits
  `shoal`. Turning away and sailing off works.
- Heading bearing conversion: `headingRad = −π/2` means course 000° N, and `0`
  means 090° E.

## 7. Game clock

`sim/time.ts`: the state is `elapsedHours: number`. The start date is **1 March
1660, 08:00**. Format dates as "1 March 1660" with a pure formatter that does
proleptic Gregorian arithmetic. `Date` may be used internally *only* in a pure
formatting helper that is tested; the sim must never read the current time.

The clock advances only in `sailing` mode (not in port, chart or title).

## 8. Rendering

### 8.1 Canvas setup

- **View canvas** (low-res): pixel scale `s = clamp(floor(min(cssW, cssH) / 200), 2, 5)`.
  Logical size `vw = ceil(cssW / s)`, `vh = ceil(cssH / s)`. CSS size `vw·s × vh·s`,
  with `image-rendering: pixelated`. Recompute on resize and orientation change.
- **Label canvas** (native): full CSS size × `devicePixelRatio`, stacked above, with
  `pointer-events: none`.

### 8.2 Camera

Centred on the ship and clamped to the world bounds. Use integer camera offsets
(avoid sub-pixel shimmer on the map). If the view is larger than the world on an
axis, centre the world.

### 8.3 Draw order (each frame)

1. Map slice: `drawImage(mapCanvas, camX, camY, vw, vh, 0, 0, vw, vh)`.
2. **Sparkles** (disabled under `prefers-reduced-motion`). On a 12-px grid over the
   visible area, each cell hashes to a fixed position and a phase. It is visible
   when `(t·0.5 + phase) mod 1 < 0.3`, only where `distToLand > 5`. Draw a 3×1 px
   highlight in `#6fa8c8` that drifts 0–3 px along the wind direction over its
   lifetime.
3. **Wake.** Every 0.08 s while `speedKn > 1`, record a point at the stern with its
   perpendicular normal. Points live 2.5 s. Draw two pixels at
   `±(1 + age·2)·normal` in `#cfe6ea`, fading out. This makes a V-shaped wake.
4. **Town flags.** Draw a 4-px pole above the town pixel and a 3×2 flag in the
   nation's colours. The flag "waves" by alternating one pixel every 0.4 s.
5. **Ship sprite** (see 8.4) at the rounded ship position, plus a 2×1 px red
   pennant at the stern that flickers.
6. **Labels** on the label canvas: port names centred 7 world px above the town,
   in IM Fell English SC at `13 + 2·s` CSS px, with a dark 3-px stroke
   (`#0b1a2e`) under a parchment fill (`#eadcb4`). Only draw ports on screen.

### 8.4 Ship sprites (procedural, `render/sprites/ship.ts`)

At load, generate **32 headings × 2 sail states** (set / furled) on 26×26 canvases:

- The hull is a pointed-bow shape about 16 px long and 6 px wide (dark `#5a3a1e`, deck
  `#8a5a2c`), with a 3-px bowsprit.
- *Set* shows two square sails across the beam (`#f2ead2`, shade `#cfc3a0`), about 2 px
  deep and 10 px and 8 px wide. *Furled* shows mast dots only (`#2b1a0e`).
- After drawing rotated, **quantise** every pixel to the nearest colour in the ship
  palette, apply an alpha threshold of 128, and add a 1-px outline (`#10213a`) on
  transparent pixels that border opaque ones. The result is crisp pixel art at every
  angle.
- The sprite index is `round(headingRad / 2π · 32) mod 32`. Half sail uses the *set*
  sprite.

## 9. UI (DOM overlays, `src/ui/`)

Palette tokens (CSS custom properties): deep sea `#0b1a2e`, panel
`rgba(9,22,40,.85)`, brass `#c9a24a`, parchment `#eadcb4`, parchment shade `#d9c795`,
ink `#2a1d12`. This is a single dark look. The game does not follow the OS light/dark
theme.

### 9.1 HUD (visible in `sailing`)

- **Top-left "ledger" panel:** date (VT323), then "Sloop · 8 guns", then a **Chart**
  button labelled "Chart (M)".
- **Top-right "helm" panel:**
  - A 72-CSS-px compass canvas (drawn at DPR). It has a brass ring with 16 ticks and an
    "N" mark. A translucent red **no-go sector** covers ±35° around the upwind direction,
    which teaches the player not to point into it. A pale blue wind arrow runs
    across the dial in the direction the wind blows, and a brass needle shows the
    ship's heading.
  - Beside it, text lines: `Course 270° W`, `7.4 kn · Beam reach`,
    `Wind ENE 14 kn`, `Full sail`. Use 16-point compass names. Update the text at
    most 10×/s.
- **Message line:** bottom-centre, above the controls. It shows one message at a time
  for 3 s and fades out. It is used for shoal warnings and for hints.
- **Dock button:** bottom-centre, visible only when near a port.
- All panels respect safe-area insets (`env(safe-area-inset-*)`).

### 9.2 Title screen (`title` mode)

The live map renders behind it, centred on the start port with the ship idle. It has
a centred parchment card with:

- The title "Tradewind Corsair"
- The tagline "The West Indies, 1660. A sloop, forty hands, and the trade winds at
  your back."
- A short controls legend (keyboard, or touch on coarse pointers)
- The buttons **Continue voyage** (only if a valid save exists) and **New voyage**

### 9.3 Chart overlay (`chart` mode, toggled with M or the Chart button; Esc closes)

- A full-screen parchment background with the whole map drawn scaled to fit (smoothed
  downscale is fine here) and a thin brass frame.
- A faint graticule every 5° with degree labels on the edges.
- Every port as a dot in its nation's colour, with its name (small IM Fell).
- The ship as a blinking brass marker.
- A small wind rose showing the current wind.
- The heading "Chart of the West Indies" and the date.
- Game time is paused.

### 9.4 Touch controls (only when `matchMedia('(pointer: coarse)')` matches)

- Bottom-left: **◀** and **▶** hold-to-turn buttons (port and starboard), each at least
  56 px.
- Bottom-right: **Reef** and **Hoist** tap buttons.
- Use pointer events with `setPointerCapture`. Release on
  `pointerup`/`pointercancel`/`lostpointercapture`, so no key stays stuck if a finger
  slides off.
- Prevent double-tap zoom and text selection on the controls
  (`touch-action: manipulation`, `user-select: none`).

### 9.5 Keyboard

| Key                 | Action                                  |
| ------------------- | --------------------------------------- |
| ← / A               | turn to port (hold)                     |
| → / D               | turn to starboard (hold)                |
| ↑ / W               | hoist: furled → half → full             |
| ↓ / S               | reef: full → half → furled              |
| Enter / Space       | drop anchor (when near a port); confirm |
| M                   | open or close the chart                 |
| Esc                 | close the chart or dialog               |

Call `preventDefault` on these keys only while the game has focus, ignore auto-repeat
for one-shot actions, and clear held keys on `blur`/`visibilitychange`.

### 9.6 Hints

The first time a new voyage starts, show these in sequence (5 s apart, once per save):

1. "The trade winds blow from the east. Sail across them for best speed."
2. "The red wedge on the compass is the wind's eye. Steer out of it."
3. "Find a friendly port and drop anchor."

## 10. Start state

- **New voyage:** the ship is at the Bridgetown (Barbados, English) harbour, heading
  the best open-water direction, sail full, speed 0. Date 1 March 1660 08:00.
  Gold 1000 and crew 40 are stored for later slices but not shown except in the save.
- The camera starts on the ship.

## 11. Persistence (`src/persist/`)

- Key: `tradewind.save.v1`. JSON:
  `{ version: 1, ship: {x,y,headingRad,speedKn,sail,classId}, elapsedHours, gold, crew, hintsShown, lastPortId }`.
- **Auto-save** on docking, when leaving port, every 30 s of sailing, and on
  `visibilitychange` to hidden.
- **Load validation.** A save is valid only if every field has the right type and is
  finite, the ship is inside the world, and the ship is not on land. An invalid or
  corrupt save is ignored (and not deleted), and "Continue voyage" is hidden.
- Wrap all `localStorage` access in try/catch. The game must run when storage is
  unavailable (for example in a private window).
- Put a `migrate(save)` function in place even though only v1 exists.

Tests: round-trip, rejection of NaN/out-of-bounds/on-land positions, and rejection of
an unknown version.

## 12. Performance budget

- The map build (mask + distances + render) takes under 400 ms. Show a "Charting the
  West Indies…" text screen while it runs, yielding once to paint it first.
- 60 fps on a mid-range laptop and a recent phone. The per-frame work is a single
  `drawImage` of the map slice plus a few hundred pixel draws. Do not allocate
  per-frame objects in hot paths.
- Bundle: under 100 KB gzipped JS (fonts excluded).

## 13. Milestones (implement and commit in order)

| #  | Milestone                                                                        | Visible result                           |
| -- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| M0 | Scaffolding, scripts, lint/test pass, loop + mode state machine with an empty mode | Blank canvas at 60 fps; `npm run check` green |
| M1 | Projection, geography data, rasteriser, distance fields (+ tests)                | Debug view: land mask in black/white     |
| M2 | Map renderer (water bands, terrain, dithering), camera, pixel-scaled view        | Scrollable pixel-art Caribbean (arrow keys pan the camera temporarily) |
| M3 | Ship model, wind, polar, collision (+ tests); sprites; wake                      | Sailable sloop                           |
| M4 | HUD (ledger, compass, helm text, messages), keyboard + touch input               | Full sailing experience                  |
| M5 | Ports: data, harbour derivation (+ test), towns, flags, labels, docking, port screen | Anchor in any port and leave again    |
| M6 | Chart overlay, title screen, hints, persistence (+ tests)                        | Complete slice                           |
| M7 | Polish pass: tuning, performance check, README, deploy instructions tested        | Deployed to the VPS                      |

## 14. Acceptance criteria (manual checklist)

Run through all of these in `npm run dev` and again against the `npm run preview` build.

- [ ] The loading text appears and then the title screen within 2 s. There are no
      console errors.
- [ ] A new voyage starts at Bridgetown. The ship faces open water and the camera is
      centred on it.
- [ ] With the wind from the ENE, sailing west (running/broad reach) is fast.
      Sailing north or south (beam reach) is fastest. Pointing east-north-east slows
      the ship to a crawl, and the helm shows "In irons".
- [ ] The compass no-go wedge sits on the upwind side and moves as the wind shifts over
      a few in-game weeks.
- [ ] Hoist/Reef steps between furled, half and full. Furled brings the ship to a
      stop within a few seconds. The sprite shows the sails.
- [ ] Sailing into any coast stops the ship with the "Breakers ahead!" message. Turning
      away frees it. The ship never ends up on a land pixel. The map edges also stop
      the ship.
- [ ] Sailing west from Barbados to Veracruz takes roughly 60–90 s of real time, and
      the date advances by about 12–15 days.
- [ ] Every one of the 21 ports shows a town, a waving flag and a readable label, and
      can be docked at. Leaving any port points the ship at open water.
- [ ] The chart (M) shows the whole map, all ports, the ship and the wind, and pauses
      time. Esc/M closes it.
- [ ] Reloading the page offers "Continue voyage", which restores position, heading,
      sail and date. Corrupting the save in DevTools makes the game start cleanly with
      only "New voyage".
- [ ] On a phone in portrait and landscape: the controls are reachable, holding ◀
      turns continuously, sliding a finger off a button stops the turn, the HUD does
      not overlap the notch or home indicator, and there is no page scroll or zoom.
- [ ] `prefers-reduced-motion` disables the sparkles. Everything else still works.
- [ ] `npm run check` passes and `npm run build` succeeds. `dist/` served by Caddy on
      the VPS behaves identically.
- [ ] No text, name or asset refers to the original game (see the IP rules in
      `CLAUDE.md`).

## 15. Open questions (decide in ADRs if they come up)

- Wind that varies by region (for example calmer in the Gulf of Mexico) is attractive but
  deferred. Keep `wind(t)` behind an interface `windAt(x, y, t)` that ignores
  position for now.
- If the coarse coastlines make any narrow passage unsailable (such as the Windward
  Passage or the Florida Straits), widen it in the geography data and note it in an ADR.

---

## Appendix A: Geography data (lon, lat)

Coarse, hand-made outlines. The order is clockwise. The mainland polygon closes through
points beyond the map edges.

```ts
export const MAINLAND: readonly (readonly [number, number])[] = [
  [-99, 31], [-80.5, 31], [-81.4, 30.2], [-80.6, 28.4], [-80.0, 26.8], [-80.1, 25.8],
  [-80.4, 25.2], [-81.1, 25.1], [-81.7, 25.9], [-82.6, 27.5], [-82.7, 28.6],
  [-83.7, 29.9], [-84.5, 30.0], [-85.4, 29.7], [-86.5, 30.4], [-88.0, 30.6],
  [-89.4, 30.2], [-89.2, 29.2], [-90.2, 29.1], [-91.5, 29.5], [-93.8, 29.7],
  [-95.0, 29.3], [-96.8, 28.2], [-97.4, 27.3], [-97.5, 25.9], [-97.8, 24.0],
  [-97.7, 22.0], [-97.2, 20.9], [-96.4, 19.3], [-95.0, 18.6], [-94.4, 18.2],
  [-92.9, 18.5], [-91.4, 18.6], [-90.7, 19.6], [-90.4, 20.9], [-89.5, 21.3],
  [-87.8, 21.5], [-87.0, 21.5], [-86.8, 20.8], [-87.4, 19.6], [-87.8, 18.4],
  [-88.3, 17.5], [-88.2, 16.0], [-88.9, 15.8], [-87.6, 15.8], [-86.0, 16.0],
  [-84.3, 15.8], [-83.4, 15.2], [-83.4, 14.0], [-83.6, 12.5], [-83.7, 11.0],
  [-83.0, 10.0], [-82.2, 9.2], [-81.4, 8.8], [-80.3, 9.2], [-79.5, 9.6],
  [-78.4, 9.3], [-77.3, 8.6], [-76.8, 8.1], [-76.0, 9.4], [-75.5, 10.6],
  [-74.8, 11.1], [-73.3, 11.3], [-72.2, 11.8], [-71.95, 12.4], [-71.3, 11.8],
  [-71.6, 11.0], [-71.55, 10.6], [-71.4, 10.9], [-70.9, 11.3], [-70.2, 11.55],
  [-70.0, 12.2], [-69.7, 11.5], [-68.4, 10.9], [-66.2, 10.6], [-64.4, 10.6],
  [-63.9, 10.7], [-62.3, 10.6], [-61.8, 10.7], [-61.0, 10.1], [-60.5, 8.5],
  [-59, 8.0], [-58, 6.5], [-99, 6.5],
];

export const ISLANDS = [
  { name: 'Cuba', points: [
    [-84.95, 21.85], [-84.0, 22.7], [-82.0, 23.15], [-80.5, 23.1], [-79.0, 22.4],
    [-77.2, 21.6], [-75.7, 21.1], [-74.15, 20.25], [-74.5, 20.0], [-75.8, 19.95],
    [-77.7, 19.85], [-77.1, 20.6], [-78.5, 21.5], [-80.5, 21.9], [-81.8, 22.2],
    [-83.0, 22.0], [-84.3, 21.9] ] },
  { name: 'Hispaniola', points: [
    [-74.45, 18.4], [-73.4, 19.8], [-72.8, 19.95], [-71.7, 19.9], [-70.0, 19.65],
    [-69.2, 19.1], [-68.35, 18.6], [-68.7, 18.2], [-69.9, 18.45], [-71.1, 18.2],
    [-71.7, 17.8], [-72.9, 18.15], [-73.9, 18.0] ] },
  { name: 'Jamaica', points: [
    [-78.35, 18.45], [-77.4, 18.5], [-76.3, 18.2], [-76.2, 17.9], [-77.2, 17.75],
    [-78.2, 18.15] ] },
  { name: 'Puerto Rico', points: [
    [-67.25, 18.5], [-65.6, 18.4], [-65.6, 18.0], [-67.2, 17.95] ] },
  { name: 'Trinidad', points: [
    [-61.9, 10.8], [-60.95, 10.85], [-61.0, 10.1], [-61.9, 10.05] ] },
  { name: 'Andros', points: [
    [-78.2, 25.1], [-77.7, 24.8], [-77.8, 24.0], [-78.3, 24.4] ] },
  { name: 'Grand Bahama', points: [
    [-79.0, 26.7], [-78.0, 26.7], [-78.0, 26.5], [-79.0, 26.55] ] },
  { name: 'Abaco', points: [
    [-77.3, 26.9], [-77.0, 26.5], [-77.1, 26.0], [-77.4, 26.4] ] },
  { name: 'Eleuthera', points: [
    [-76.7, 25.5], [-76.1, 25.1], [-76.2, 24.7], [-76.4, 25.0] ] },
] as const;

// [name, lon, lat, rxDeg, ryDeg]; enforce rx, ry >= 0.08 so every islet is visible.
export const ISLETS = [
  ['Isla de Pinos', -82.85, 21.7, 0.35, 0.22],
  ['Tortuga', -72.8, 20.06, 0.18, 0.05],
  ['New Providence', -77.35, 25.03, 0.2, 0.08],
  ['Exuma', -76.0, 23.6, 0.2, 0.1],
  ['Cat Island', -75.5, 24.3, 0.1, 0.3],
  ['Long Island', -75.1, 23.2, 0.1, 0.35],
  ['Great Inagua', -73.4, 21.05, 0.3, 0.15],
  ['Grand Cayman', -81.25, 19.32, 0.18, 0.08],
  ['Cozumel', -86.9, 20.4, 0.1, 0.18],
  ['Roatán', -86.5, 16.35, 0.3, 0.08],
  ['Virgin Islands', -64.8, 18.35, 0.15, 0.08],
  ['Anguilla', -63.05, 18.2, 0.08, 0.08],
  ['St. Eustatius', -62.98, 17.49, 0.08, 0.08],
  ['St. Kitts', -62.75, 17.3, 0.09, 0.08],
  ['Antigua', -61.8, 17.08, 0.12, 0.1],
  ['Guadeloupe', -61.55, 16.2, 0.25, 0.2],
  ['Dominica', -61.35, 15.42, 0.09, 0.2],
  ['Martinique', -61.0, 14.65, 0.13, 0.22],
  ['St. Lucia', -60.97, 13.9, 0.08, 0.17],
  ['St. Vincent', -61.2, 13.25, 0.08, 0.12],
  ['Barbados', -59.55, 13.15, 0.1, 0.13],
  ['Grenada', -61.68, 12.12, 0.08, 0.1],
  ['Tobago', -60.7, 11.23, 0.18, 0.08],
  ['Margarita', -64.0, 11.0, 0.3, 0.1],
  ['Aruba', -70.0, 12.5, 0.1, 0.08],
  ['Curaçao', -68.95, 12.2, 0.2, 0.08],
  ['Bonaire', -68.25, 12.2, 0.1, 0.08],
] as const;
```

Known data caveats to check in M1: Tortuga must stay separated from Hispaniola by
water (a gap of at least 3 px), and the Florida Straits, Windward Passage, Mona Passage
and Yucatán Channel must all be sailable.

## Appendix B: Ports

The blurbs are original placeholder text. Keep them short, and improve them freely.

| id               | name            | nation | lon     | lat   | blurb |
| ---------------- | --------------- | ------ | ------- | ----- | ----- |
| havana           | Havana          | es     | −82.36  | 23.14 | The treasure fleets gather under its guns before the long run home to Seville. |
| santiago         | Santiago        | es     | −75.83  | 19.99 | A steep harbour mouth and a nervous garrison watching the Windward Passage. |
| santo-domingo    | Santo Domingo   | es     | −69.90  | 18.47 | The oldest Spanish city in the Indies, proud and a little faded. |
| san-juan         | San Juan        | es     | −66.10  | 18.47 | Stone walls on a narrow island guard the gateway to the Spanish Main. |
| st-augustine     | St. Augustine   | es     | −81.31  | 29.90 | A lonely outpost holding the Florida coast against all comers. |
| veracruz         | Veracruz        | es     | −96.13  | 19.20 | Silver from the mines of New Spain comes down the mountain road to this quay. |
| campeche         | Campeche        | es     | −90.53  | 19.85 | Logwood, salt and a town that has learned to fear sails on the horizon. |
| porto-bello      | Porto Bello     | es     | −79.65  | 9.55  | When the fair is on, Peruvian silver is stacked in the streets. |
| cartagena        | Cartagena       | es     | −75.53  | 10.42 | The strongest fortress on the Main, and it knows it. |
| maracaibo        | Maracaibo       | es     | −71.60  | 10.70 | Cacao and hides behind a shallow bar that keeps big ships out. |
| caracas          | Caracas         | es     | −66.93  | 10.60 | The port below the mountain road, busy with cacao for Spain. |
| trinidad         | Trinidad        | es     | −61.45  | 10.65 | A thinly held Spanish island at the edge of the Orinoco's reach. |
| port-royal       | Port Royal      | en     | −76.84  | 17.94 | The busiest harbour in English Jamaica, and the least respectable. |
| bridgetown       | Bridgetown      | en     | −59.62  | 13.10 | Sugar money, planters' mansions and a harbour full of merchantmen. |
| st-johns         | St. John's      | en     | −61.85  | 17.12 | A small English settlement with a large and excellent anchorage. |
| nassau           | Nassau          | en     | −77.35  | 25.06 | A scatter of huts and a good harbour, far from any governor's eye. |
| tortuga          | Tortuga         | fr     | −72.80  | 20.06 | A rock off Hispaniola where no questions are asked and every rumour is told. |
| st-pierre        | St. Pierre      | fr     | −61.17  | 14.74 | The jewel of French Martinique, under a smoking mountain. |
| basse-terre      | Basse-Terre     | fr     | −61.73  | 16.00 | The French governor's seat on green, mountainous Guadeloupe. |
| willemstad       | Willemstad      | nl     | −68.93  | 12.11 | Dutch warehouses where anything can be bought and everything is for sale. |
| st-eustatius     | St. Eustatius   | nl     | −62.98  | 17.48 | A tiny island whose trade makes it worth more than its size. |
