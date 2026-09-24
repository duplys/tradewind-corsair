# CLAUDE.md — Tradewind Corsair

Guidance for Claude Code when working in this repository. Read this file fully before
starting any task. The current slice specification lives in `docs/specs/`. Read the spec
you are implementing before writing code.

## What this project is

**Tradewind Corsair** (working title) is a browser game. It is a *spiritual successor* to
the 1987 classic about privateering in the 17th-century Caribbean. It is an open-world
sandbox made of small, tight mini-games (sailing, ship combat, sword duels, towns and
trade, land battles) tied together by a simple world simulation, with a career that
ends in retirement.

The game is single-player and runs entirely in the browser. The production build is a
set of static files served from a Hetzner VPS (Caddy). There is no backend, no
accounts and no server-side state. Saves live in the player's browser.

## Legal and IP rules (non-negotiable)

Game mechanics are free to reuse. The expression of the original game is not.

- Never use the names "Sid Meier", "Pirates!", "MicroProse", "Firaxis", "2K" or
  "Take-Two" anywhere in code, assets, UI text, commit messages, metadata or the page
  title. (This file names the constraint once; nothing else should.)
- Never copy, trace, sample or recreate the original's graphics, music, sound effects,
  fonts, UI layouts, screen compositions or text. Do not look up the original's assets
  or strings to "match" them.
- All art is either generated in code (procedural pixel art on canvas) or created fresh
  for this project. All writing (port descriptions, dialogue, rank titles) is original.
- Real history and geography are fine: real Caribbean coastlines, real port names, real
  nations and real dates.
- Third-party assets or libraries need a license compatible with free public hosting
  (MIT, BSD, Apache-2.0, CC0, CC-BY or OFL for fonts). Record each one in
  `THIRD_PARTY.md` with its source and license.

## Tech stack

| Concern         | Choice                                                                     |
| --------------- | -------------------------------------------------------------------------- |
| Language        | TypeScript, `strict: true`, no `any` except at typed boundaries            |
| Build/dev       | Vite (vanilla TS template), no UI framework                                |
| Rendering       | HTML5 Canvas 2D; a low-resolution logical canvas scaled up with nearest-neighbour filtering |
| UI overlays     | Plain DOM + CSS for menus, HUD panels and dialogs                          |
| Tests           | Vitest (unit tests for all simulation code)                                |
| Lint/format     | ESLint (typescript-eslint) + Prettier                                      |
| Package manager | npm                                                                        |
| Runtime deps    | None unless a spec explicitly allows one                                   |
| Hosting         | Static files in `dist/`, served by Caddy on the Hetzner VPS                |

Do not add React, Phaser, Pixi or any game engine. The game is simple enough that
owning the loop, the renderer and the input layer keeps it small and understandable.

## Commands

```bash
npm install          # install dev dependencies
npm run dev          # Vite dev server with HMR
npm run build        # type-check (tsc --noEmit) then vite build -> dist/
npm run preview      # serve dist/ locally
npm test             # vitest run
npm run test:watch   # vitest in watch mode
npm run lint         # eslint .
npm run format       # prettier --write .
npm run check        # lint + type-check + test (run before every commit)
```

If a script is missing, add it to `package.json` rather than working around it.

## Architecture

The central rule is to **keep simulation separate from presentation**.

```
src/
  main.ts              # boot: create Game, attach to DOM, start loop
  game/                # orchestration: Game class, mode/scene state machine, loop
  sim/                 # PURE simulation: no DOM, no canvas, no Date.now(), no Math.random()
    world/             # geography data, land mask, ports
    sailing/           # ship physics, wind model, polar tables
    time.ts            # game calendar
    rng.ts             # seeded PRNG
  render/              # canvas drawing: map rendering, sprites, camera, effects
  ui/                  # DOM overlays: HUD, dialogs, touch controls, title screen
  input/               # keyboard + pointer -> abstract actions
  persist/             # save/load (localStorage), versioned schema
  data/                # static tables (ports, ships, nations) as typed TS modules
  styles/              # CSS
tests/                 # mirrors src/sim etc.; *.test.ts
docs/
  specs/               # one spec per slice (slice-01-sailing.md, ...)
  decisions/           # short ADRs when a spec leaves a choice open
```

Rules:

1. **`src/sim/` is pure and deterministic.** It does not import from `render/`, `ui/`,
   `input/` or any browser API. All randomness goes through the seeded PRNG in
   `sim/rng.ts`. Time comes from the game clock and never from the wall clock. Given
   the same seed and the same inputs, the simulation produces the same result. This is
   what makes it testable.
2. **Fixed-timestep simulation, variable-rate rendering.** The loop advances the sim in
   fixed steps (1/60 s) using an accumulator, then renders once per animation frame.
   Clamp frame delta to 250 ms so a background tab does not fast-forward the world.
3. **Input produces actions, not side effects.** `input/` maps keys and touches to
   an `InputState` (held actions such as `turnLeft`) plus a queue of one-shot
   commands (such as `hoistSail` or `enterPort`). The game reads these each step.
4. **Modes/scenes** (`title`, `sailing`, `port`, `chart`, later `combat`, `duel` ...)
   are a small explicit state machine in `game/`. Each mode owns its update, render and
   overlay lifecycle. Pausing is simply "the sim does not step in this mode".
5. **Rendering reads state and never mutates it.**
6. **Units are explicit.** Distances in the sim are *world pixels* (see the slice 1
   spec for the projection). Speeds are in knots. Game time is in hours. Name
   variables and fields with their unit when it is ambiguous (`speedKn`,
   `headingRad`, `elapsedHours`).
7. **Angles:** radians internally, screen convention (0 = east, positive = clockwise
   because y points down). Convert to compass bearings (0° = north, clockwise) only
   for display. Use helpers from `sim/math.ts` and never inline the conversions.
8. **Data-driven balance.** Ship stats, polar tables, wind parameters and time scale
   live in `src/data/` or a `constants.ts` and are never magic numbers inside logic.
   Tuning is most of the work, so make it easy.

## Visual direction

- A low-resolution logical canvas (about 320–400 logical pixels on the short side),
  integer-scaled with `image-rendering: pixelated`. The look is crisp retro pixel art
  with a limited palette and ordered (Bayer) dithering for gradients. It is inspired
  by the 8-bit era, not a copy of any specific game.
- Sprites are generated procedurally at load time (drawn on an offscreen canvas,
  then quantised to the palette and given a 1-px outline). Keep generators in
  `render/sprites/`.
- Text that must stay readable (port names, HUD numbers) is drawn at *native*
  resolution on an overlay canvas or in DOM. Do not draw it on the scaled
  low-res canvas.
- Palette and fonts are defined once (`render/palette.ts`, CSS custom properties) and
  referenced everywhere else.
- Fonts come from Google Fonts (OFL) with system fallbacks. Currently: *IM Fell English*
  / *IM Fell English SC* for period text, and *VT323* for HUD numerals.

## Coding conventions

- Small modules and pure functions where possible. Classes only for things with a
  lifecycle (Game, modes, renderer).
- No global mutable singletons outside `main.ts`. Pass dependencies explicitly.
- Prefer `readonly` types for data tables and `as const` for literal tables.
- Keep the code free of `TODO` without a linked issue or spec section.
- UI text is plain English, active voice and period-flavoured but readable
  ("Hoist sail", "Drop anchor at Port Royal"). Keep all user-facing strings in
  `src/data/strings.ts` so they can be translated later (German is a likely
  second language).
- Accessibility: every interactive DOM element is a real `<button>` with a visible focus
  style. Respect `prefers-reduced-motion` for purely decorative animation.

## Testing

- Every module in `src/sim/` has unit tests. Cover edge cases: angle wrap-around at
  ±π, land-mask boundaries, map edges, zero wind, calendar month and year rollover.
- Tests must not need a browser. If something needs `ImageData` or a canvas to produce
  the land mask, split the pure part (polygon rasterisation into a `Uint8Array`,
  distance transforms) from the canvas part.
- Rendering is checked manually. For each slice, add a short manual test checklist in
  the spec's "Acceptance" section and walk through it in `npm run dev` before
  declaring the slice done.

## Workflow

- Work one slice at a time from `docs/specs/slice-NN-*.md`. Implement the milestones in
  the order given and commit after each one.
- Before coding a milestone, restate your plan briefly. If the spec is ambiguous, make
  the smallest reasonable choice, write it down in `docs/decisions/NNN-title.md`
  (a few lines covering context, decision and consequence), and keep going. Stop and
  ask only when a choice would be expensive to reverse.
- Do not build ahead of the current slice. Leave clean seams (interfaces, mode
  registry) but no speculative features.
- Run `npm run check` before each commit. Never commit with failing tests or type
  errors.
- Commits: Conventional Commits (`feat(sailing): add polar speed table`,
  `fix(map): harbour search ignores lagoons`, `test(sim): ...`, `docs: ...`).
- Keep `README.md` current: what the game is, how to run it and how to deploy it.

## Definition of done (every slice)

1. All acceptance criteria in the slice spec are met.
2. `npm run check` passes, and `npm run build` produces a working `dist/`.
3. The game works in current Chrome, Firefox and Safari, on desktop (keyboard) and
   on a phone (touch, portrait and landscape).
4. Load time is under 2 s on a mid-range laptop, and the frame rate holds 60 fps.
5. There is no console error or warning during a normal session.
6. The README and any new ADRs are updated.

## Deployment (Hetzner VPS)

The build output is fully static. Deploy by syncing `dist/` to the web root:

```bash
npm run build
rsync -avz --delete dist/ deploy@<vps-host>:/var/www/tradewind/
```

Example Caddyfile block (Caddy handles HTTPS automatically):

```
tradewind.example.org {
    root * /var/www/tradewind
    encode zstd gzip
    file_server
    header /assets/* Cache-Control "public, max-age=31536000, immutable"
    header /index.html Cache-Control "no-cache"
}
```

Vite puts content hashes in asset file names, so long cache lifetimes on `/assets/` are
safe. Never add analytics, trackers or third-party requests that would need a cookie
banner. If fonts ever need to avoid Google, self-host them in `public/fonts/`.
