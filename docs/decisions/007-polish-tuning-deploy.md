# 007: Polish pass: tuning, reduced motion and deployment

Status: accepted (slice 1, milestone M7)

## Context

M7 asks for tuning, a performance check and tested deploy instructions before the slice
ships.

## Decision

- **Crossing time is left at the spec's values.** An autopilot
  (`tests/sim/sailing/crossing.test.ts`) sails Bridgetown to Veracruz, south of the
  Antilles and through the Yucatán Channel, once for each month of the year. With the
  sloop at 9 kn it takes 72–113 s:

  | Start           | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec | Jan | Feb |
  | --------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Real seconds    | 113 | 97  | 101 | 80  | 88  | 72  | 84  | 73  | 85  | 80  | 88  | 88  |

  The median is about 86 s and 14 days, inside the 60–90 s and 12–15 day target. The
  slow months are March and April, when the wind's seasonal swing is least favourable.
  Raising the top speed to 10.5 kn fixes those two months but makes 7 of 12 crossings
  shorter than 12 days, so the spec's values stay. The test pins the median to the
  target, so tuning changes cannot silently break it. The feel should still be judged by
  playing.
- **Reduced motion** covers every purely decorative animation (CLAUDE.md), not just the
  sparkles the spec names. It turns off the sea sparkles, holds the flags and stern
  pennant still, and keeps the chart's ship marker lit instead of blinking. The wake
  stays, because it shows the ship's speed and course.
- **Sparkles** are anchored to 12-px world cells, so they stay put on the sea while the
  camera moves.
- **Performance:**
  - map build about 120 ms in Node (the dev build logs the browser figure)
  - JS bundle 17.7 KB gzipped (budget 100 KB)
  - per frame: one map `drawImage`, a few hundred 1-px rectangles, and labels redrawn
    only when the camera moves (now compared as numbers, not a string key)
- **Caddy cache headers:** `header /index.html …` did not match requests for `/`, so the
  page could be cached and point at assets that `rsync --delete` had removed. A
  `@page path / /index.html` matcher now covers both, in `deploy/Caddyfile` and the
  CLAUDE.md example.
- **Deploy rehearsal:** `deploy/deploy.sh` was run against a local folder, which was then
  served over HTTP. Every file loads, and `--delete` removes stale files. The real
  upload to the VPS needs the owner's host and SSH key, so it is not part of the
  repository.

## Consequences

If playtesting shows early crossings feel slow, the simplest lever is the wind's
starting phase (spec §5), not the ship's speed.
