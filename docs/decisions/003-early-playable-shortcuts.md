# 003: Early playable build before HUD, ports and title screen

Status: superseded. All shortcuts were retired by M6 (see ADRs 004–006).

## Context

M1–M3 were built in one go to reach a sailable sloop quickly, so the feel of sailing can be
judged early. Some pieces the spec assigns to later milestones are needed to make M3
usable.

## Decision

- **Boot goes straight to `sailing`** (retired in M6: the game now boots to the title screen). `title` stays registered and becomes the real title
  screen in M6.
- **Start position** (replaced in M5 by the port table, see ADR 005): `sim/sailing/start.ts` derives Bridgetown's harbour directly from
  `START_LON/START_LAT` with the §4.1 searches (`sim/world/search.ts`). In M5 it should read
  the port table instead. The search helpers themselves are the M5 ones.
- **Dev readout** (removed in M4; the HUD and message line replaced it): in dev builds only, a small panel (`ui/devReadout.ts`) shows course,
  speed, point of sail, wind, sail and voyage day. It also shows "Breakers ahead!" at most
  once per 3 s. The M4 HUD and message line replace it.
- **No shoal event when not moving:** `stepShip` only checks collision when the ship would
  move. A furled, stopped ship facing a coast does not re-trigger the warning every step.
  Turning is never blocked, as the spec requires.
- **Test angle:** spec §6.5 wants "close-hauled < running". At 120° the polar gives 0.86,
  which beats running at 0.72. The test therefore uses 135°, which is still in the
  close-hauled band.
- **Sparkles (§8.3 step 2)** are not part of any M1–M3 row and are left for polish.

## Consequences

M4–M6 must remove the readout, route the start through the port data and put the title
screen in front of sailing.
