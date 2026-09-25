# 010: NPC ships on the world map (slice 2 M2)

Status: accepted (slice 2, milestone M2)

## Context

M2 adds the navigation grid, NPC spawning, the world-map sailing AI and its rendering (spec
§4, §11, §12). Several details are open or needed adjusting once the simulation ran.

## Decision

- **No leg may graze land.** A first version let A* move between neighbouring navigable
  cells whose connecting line passed within 1 px of land (6 of 1,353 legs), where a ship's
  7 px bow probe would run aground. The grid therefore precomputes the allowed moves of each
  cell: a move needs line of sight (the same check as smoothing) and, for diagonals, both
  side cells navigable. Every leg of every port-to-port path now has line of sight (tested).
- **Paths are computed on demand**, and port-to-port paths are cached. The grid builds in
  about 10 ms, and all 420 port-to-port paths take about 50 ms together, so no
  per-frame limit is needed (§12 asked for at most 2 per frame). Results depend only on the
  world, so caching never changes the simulation.
- **Additions to the `NpcShip` model** (spec §4.1), all saved and validated:
  - `home`: the spawn point that pirates loiter around (§4.4 step 4 needs it).
  - `loiterUntilHours`: see below.
  - `targetHeadingRad`: the AI (10 Hz) chooses a course, and a helmsman steers toward it
    every physics step with the ±4° dead band. Steering at only 10 Hz with on/off input
    would overshoot by about 9° each decision.
  - `progress`: the position and time of the last stuck check (§4.4 step 3).
- **Timing without extra state:** the AI runs whenever game time crosses a multiple of
  0.4 game hours (10 times per second of sailing), and spawn checks whenever it crosses a
  multiple of 2 game hours. So no timers need saving.
- **Nation weighting** (§4.3) uses the ports within 300 px of the **spawn point**; if there
  are none, it uses the nearest port's nation.
- **Lanes** (§4.3) are the cached paths between ports within 400 px of the player. The spawn
  point is a sample on such a lane 140–240 px from the player. Choosing lanes this way
  doesn't depend on which paths happen to be cached, so it stays deterministic across a
  reload. Destinations are at least 60 px away from the spawn point.
- **Spawning:** at each check, as many ships as needed are spawned (at most 12 attempts),
  capped at **10 NPCs** on the map (the performance budget in §12). A fresh voyage
  therefore shows about six ships within half a second of sailing.
- **Pirates loiter for 4 game days** (about 24 s of sailing), then sail toward their named
  port and leave the map when they reach it or fall 320 px behind. Without this, a player
  who stayed in one area was surrounded only by pirates within two minutes: traders and
  warships come and go, but pirates never left.
- **Sprites:**
  - One generator draws every class at world scale from its data: hull length, beam scaled
    from the combat hull, masts, and a sterncastle on the fluyt and galleon.
  - Sprites are generated lazily per class and sail colour, and cached.
  - The sloop, the player's too, now has one mast with a fore-and-aft mainsail and a jib.
  - Canvases grow with the hull (26 px for the sloop, as in slice 1, up to 34 px for the
    galleon).
  - The M1 data test that compared every class with a fixed 26 px canvas now checks the
    per-class canvas size instead.
- **Fading** is presentation only (`render/effects/npcFade.ts`):
  - Ships fade in over 1.5 s the first time they are drawn, and departed ships fade out
    where they left.
  - A voyage that is started or loaded shows its ships at once.
- **Labels:**
  - Within 50 px of the player, NPC labels ("Spanish fluyt", "Pirate brigantine") sit under
    the ship, tinted red when hostile.
  - The label layer redraws every frame while NPC labels show, and otherwise only when the
    camera moves.
  - Nations gained `adjective`. `sentenceName` and the "Dutch Republic" rename come with the
    encounter dialog in M3.

## Consequences

- Near a port that many NPCs are bound for (such as Bridgetown), ships arrive and leave
  often, about 30 per real minute while the player waits nearby. This is worth tuning in
  M8 if it feels busy.
- M3's chase and flee plug into `decideSailing` through the existing `intent` field.
