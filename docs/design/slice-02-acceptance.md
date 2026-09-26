# Slice 2 acceptance run-through

The run-through of spec §14 at the end of M8 (2026-09-26). **Auto** means an automated test
covers the behaviour. **Manual** means it needs a person at a browser; the steps say what
to look for. Rendering and feel can only be checked by hand, and this environment had no
browser.

| # | Criterion (spec §14, with ADR 013's horizon) | Status | Evidence / how to check |
| - | -------------------------------------------- | ------ | ----------------------- |
| 1 | Ships appear near Bridgetown, sail plausibly toward ports, tack when heading east, never cross land, fade in | Auto + manual | `tests/sim/npc/world.test.ts` (six ships in 1.5 s, never on land over 90 s), `sail.test.ts` (every class reaches an upwind goal by tacking). Manual: watch the fade-in and the tacking. |
| 2 | Spanish warships and pirates chase; merchantmen run; English, French and Dutch warships ignore you | Auto | `tests/sim/npc/intent.test.ts` |
| 3 | Encounter dialog: nation, class, name, strength hint; friendly warning before attacking a Dutch fluyt | Auto (text) + manual | `tests/ui/encounterText.test.ts`. Manual: close with a Dutch fluyt and choose Attack. |
| 4 | Running from a frigate in a sloop: usually works upwind, rarely downwind | Auto | `tests/sim/npc/escape.test.ts`: 0.90 upwind, 0.27 downwind (ADR 016) |
| 5 | Smoke drifts downwind; turning into the wind slows you as on the world map | Auto (physics) + manual | The shared `stepShip` (`stepShip.test.ts`); smoke is manual |
| 6 | Broadsides ripple, reload independently, slower with a depleted crew; Fire fires the side that bears | Auto + manual | `tests/sim/combat/step.test.ts`, `condition.test.ts` (reload time by crew); manual: the reload bars |
| 7 | Hits show the right effects and damage; rigging damage slows her; holes below 60 % rigging | Auto (damage) + manual | `hits.test.ts`, `condition.test.ts`; manual: splinters, canvas scraps and holes |
| 8 | A fluyt usually strikes after a few hits and must be boarded; the boarding overlay plays and can be skipped | Auto + manual | Balance: the frigate captures the fluyt in 86 % of fights and she strikes in every one; traders strike after 4 hits (ADR 013). Manual: the overlay. |
| 9 | Sinking gives no plunder; capture gives gold and recruits; "Take her" works and the new ship sails with its own polar | Auto + manual | `tests/sim/combat/outcome.test.ts`; manual: sail a captured galleon upwind |
| 10 | Defeat: ashore at the nearest non-hostile port, sloop with 12 crew, half the gold, 14 days later | Auto | `outcome.test.ts` |
| 11 | Getting over the horizon ends the fight either way; an escaped enemy is still on the map with her damage | Auto | `step.test.ts` (horizon, who escaped), `outcome.test.ts` (enemy escaped) |
| 12 | Repairs show cost and days; disabled at Spanish ports | Auto + manual | `repair.test.ts`, `relations.test.ts`; manual: the Shipwright at San Juan |
| 13 | Reloading mid-combat restores the pre-encounter save; a slice 1 save still loads | Auto (save) + manual | `tests/persist/save.test.ts` (real v1 fixture); manual: reload during a fight |
| 14 | Touch: steer, hoist, reef, fire and pause in portrait and landscape; no stuck buttons | Manual | On a phone: `npm run dev -- --host` |
| 15 | `npm run check` and `npm run test:balance` pass; `npm run build` succeeds; the same on the VPS | Auto + manual | All pass locally and in CI; the VPS deploy is the owner's step |
| 16 | No names, art or text from the original game | Auto (names) | A `git grep` for the names CLAUDE.md forbids finds nothing outside CLAUDE.md. All art is procedural. |

## Performance (spec §12), measured headless

| Budget | Measured |
| ------ | -------- |
| Grid and first path cache under 150 ms at load | Grid plus all 420 sea lanes: 46 ms (world 39 ms and map pixels 80 ms are slice 1 work) |
| NPC AI at 10 Hz, physics at 60 Hz; 60 fps with 10 NPCs | NPC step: median 0.002 ms, 99th percentile 0.06 ms, worst 7.6 ms (a spawn check planning two routes) |
| At most 2 paths per frame | At most 2 ships spawn per check, and sea lanes are cached at load (ADR 016) |
| 200 balance fights under 5 s | 0.7–1.6 s per matchup |
| Combat at 60 fps with 400 particles and 40 balls | Pools of 400 particles and 64 balls, no per-frame allocation in the effects; frame rate is manual |
| Bundle under 100 KB gzipped (slice 1 budget) | 43.7 KB JS + 3.1 KB CSS |

## Still to check by hand before calling the slice done

Items 1, 3, 5–9 and 12–14 (the visual and feel parts), in Chrome, Firefox and Safari, on a
desktop and a phone, then the VPS deploy (item 15).
