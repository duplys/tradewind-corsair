# 005: Ports, docking and shared voyage state

Status: accepted (slice 1, milestone M5)

## Context

M5 adds ports, docking and the port screen. A few details are not settled by the spec.

## Decision

- **St. Augustine moves to 29.5° N** (real: 29.9° N). The map's north edge is 30° N, so
  the derived town sat 4 px from the edge and its flag and label were drawn off the
  map. A test keeps every town at least 16 world px from the top edge.
- **Shared voyage state:** `sim/voyage.ts` holds the voyage (ship, clock, last port,
  docked port) with pure `newVoyage`, `dockAt` and `setSailFrom`. The sailing and port
  modes share it through `game/session.ts`. This is the object M6 will save.
- **New voyages start from the port table** (Bridgetown's derived harbour), replacing
  the direct lookup noted in ADR 003.
- **Docking input:** the "Drop anchor" button and Enter/Space both queue the `confirm`
  action. In port, Set sail and Enter/Space do the same.
- **Port screen focus:** focus goes to the card, not to Set sail. Space activates a
  focused button on keyup, so the Space press that dropped anchor would otherwise set
  sail at once.
- **Auto-save on docking and leaving port** (spec §4.2) arrives with persistence in M6.
- **Flags:** 3×2 pixels. England is white with a red cross made of the top-middle pixel
  and the bottom row. The fly column dips one pixel every other 0.4 s.
- **Labels:** redrawn only when the camera or scale changes.

## Consequences

M6 needs to add save and load around `Session.voyage` and call a save in
`dockAt`/`setSailFrom`'s callers.
