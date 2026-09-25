# 006: Title screen, chart, hints and saves

Status: accepted (slice 1, milestone M6)

## Context

M6 completes slice 1's features: chart overlay, title screen, hints and persistence. The
spec leaves a few details open.

## Decision

- **Save contents:** the save follows spec §11 exactly. It has no "docked" flag, so a
  voyage saved in port loads at sea at the anchorage, just outside the harbour. That
  position always passes validation because harbours are in clear water.
- **Validation** rejects:
  - non-object JSON and any version other than the number 1
  - non-finite or wrongly typed fields, and negative speed, time, crew or hint counts
  - unknown sail settings, ship classes or port ids
  - positions outside the world or on land
  Headings are normalised on load. `migrate()` passes v1 through and rejects the rest.
- **When saves happen:**
  - when docking and when leaving port
  - every 30 s of sailing (real time; the timer pauses in port and chart)
  - when the tab is hidden, in any mode except the title screen
  Starting a new voyage does not overwrite the old save until the first of these
  triggers.
- **Storage failures** (no storage, access throws, quota) are swallowed. The game runs
  without saving.
- **Hints:** the first appears 1 s after a new voyage starts, then one every 5 s, each
  on the message line. The count is stored in the save (`hintsShown`), so each hint
  appears once per save even across reloads.
- **Chart:** it can be closed with M, Esc or a **Close chart** button (needed on touch
  devices, which have no Esc). The HUD's Chart button is now live (see ADR 004). Map,
  graticule, ports and wind rose are drawn once per open or resize; each frame only
  composites that layer and the blinking ship marker.
- **Title:** the live map behind the card shows a new voyage's ship idle at Bridgetown,
  even when a save exists.
- **CSS:** a global `[hidden] { display: none !important }` rule keeps overlays with
  their own `display` (such as the flex touch controls) hideable.

## Consequences

ADR 003's temporary shortcuts are all retired. A future save version needs a real
migration step in `persist/save.ts`.
