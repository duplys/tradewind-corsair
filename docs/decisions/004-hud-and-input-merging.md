# 004: HUD Chart button before the chart exists; merged input sources

Status: accepted (slice 1, milestone M4)

## Context

Spec §9.1 puts a "Chart (M)" button in the ledger panel, but the chart overlay is M6.
Keyboard and touch can also hold the same action (such as turning) at the same time.

## Decision

- **Chart button:** it is rendered now but disabled, with a "Coming soon" caption like
  the disabled port-screen buttons (§4.2). M6 enables it.
- **Input:** `input/input.ts` keeps a held-action record per source (keyboard, touch)
  plus one shared queue of one-shot actions. Once per step, `refresh()` fills a single
  reused `held` record with the OR of the sources. Releasing a key therefore never
  cancels a finger that is still holding a touch button, and blur or visibilitychange
  clears only the keyboard.
- **Touch hold release:** besides `pointerup`, `pointercancel` and `lostpointercapture`,
  a hold also ends when the captured pointer moves outside the button. With pointer
  capture, sliding off would otherwise keep turning, which contradicts the acceptance
  criterion.

## Consequences

M6 only needs to wire the Chart button's click to the `chart` action and enable it.
