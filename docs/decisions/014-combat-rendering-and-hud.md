# 014: Combat rendering, HUD, touch and pause (slice 2 M6)

Status: accepted (slice 2, milestone M6)

## Context

M6 gives combat its look (spec §10.1–10.2), its HUD and touch layout (§10.3), and the pause
(§6.1). A few details are open, and ADR 013 replaced the arena edge with the horizon.

## Decision

- **Sprites:** one drawing routine now serves world and combat sizes through a shared ship
  geometry (hull, masts, sail rectangles).
  - Combat sprites are generated when a fight starts: 32 headings × all sails / only the
    main sail / furled, with gunports (one per gun a side, at least 2 px apart, so capped
    by the hull length).
  - A struck or sinking ship uses the furled set.
  - The stern flag (2 × 2 pixels of the nation's flag, or England's for the player) and
    the white square that replaces it on striking are drawn at runtime.
  - So are the sail holes: 2–4, seeded per ship, placed inside the sail rectangles and
    shown below 60 % rigging. Below 30 % only the main sail is drawn.
- **Effects:**
  - All particles live in one pool of 400 (the oldest is replaced when full):
    - smoke: 3–5 px puffs that grow, fade over 2.5 s and drift at 30 % of the wind speed
    - splinters: 4–6 per hull hit, plus a one-frame lighter flash of the sprite
    - canvas scraps: 2–3 per rigging hit, drifting downwind
    - bubbles while a ship sinks, then 5–8 pieces of debris that stay
  - Splashes are a three-frame ring. Each ship has a wake sized to half its hull.
  - A sinking ship disappears from bow to stern over 3 s (a clip in the ship's frame).
- **Sea:**
  - The deep-ocean colour, with sparkles anchored to the sea.
  - The swell is a dithered pattern tile, rotated to lie across the wind and rolling
    downwind at 4 px/s; one fill per frame. Swell and sparkles are off under reduced
    motion.
- **Horizon and pointer:** there is no arena edge (ADR 013).
  - The spec's edge vignette becomes a darkening of the screen edges in the last 40 px
    before the ships reach the 450 px horizon.
  - When the enemy is off screen, a small arrow at the edge points at her, and the label
    canvas shows her range in yards beside it.
- **HUD** (it replaces the interim status panel):
  - **Your panel:** name and class, "Crew 40, needs 40", guns manned a side, hull and
    rigging bars, and a 48 px compass (hidden on narrow screens).
  - **Enemy panel:** flag, name and class, crew "about" the nearest 10 beyond 100 px
    (exact within), and bars.
  - **Gun panel:** the range, and PORT and STARBOARD bars that fill as the guns reload. A
    bar glows brass when ready, is framed when its side bears, and flashes red when fire
    was ordered before it was ready.
  - The ‖ pause button sits at the top centre for every device, not only on touch.
- **Touch:** in combat a large Fire button (the side that bears) appears bottom-right, with
  Hoist and Reef above it and ◀ ▶ bottom-left. In combat the message line moves above the
  gun panel, which on phones sits above the controls.
- **Pause:**
  - P, Esc and ‖ toggle it. Hiding the tab pauses the fight (a new optional `onHidden`
    hook on modes).
  - The overlay offers Resume, and Surrender unless the enemy is a trader. Surrendering
    ends the fight as a defeat, which still uses the interim card until M7.
  - The simulation does not step while paused.
- **Fix:** the label canvas now clears when a fight starts and ends, so port names from the
  world map no longer show over the fight.

## Consequences

M7 replaces the result card with the outcome screens. The HUD, pause and effects need no
changes for that.
