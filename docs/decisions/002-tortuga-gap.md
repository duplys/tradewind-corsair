# 002: Move Tortuga north to keep a channel

Status: accepted (slice 1, milestone M1)

## Context

Appendix A of the slice 1 spec places Tortuga at 20.06° N with a 0.05° north-south
radius. Every islet radius is raised to the 0.08° minimum, so the rasterised islet
reaches down to about 19.98° N, while Hispaniola's north coast reaches 19.95° N. That
leaves only 2 px of water, and the spec requires at least 3 px.

## Decision

Move Tortuga's centre to 20.14° N in `src/data/geography.ts`. The gap becomes about
4 px. The Tortuga port keeps its real coordinates (20.06° N). Harbour derivation
(spec §4.1) finds the nearest land and water from there.

## Consequences

Tortuga sits roughly 8 km north of its real position, which is invisible at this map
scale. A unit test in `tests/sim/world/world.test.ts` guards the gap.
