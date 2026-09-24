---
description: Implement one milestone of the current slice spec, test it, and commit
argument-hint: <milestone, e.g. M3>
---

Implement milestone **$ARGUMENTS** of the current slice.

1. Read `CLAUDE.md` in full, then the current slice spec in `docs/specs/` (the
   highest-numbered `slice-NN-*.md` that is not finished). Find the row for
   $ARGUMENTS in the spec's milestone table and every spec section it relies on.
2. Restate a short plan for $ARGUMENTS: the files you will add or change, the tests you
   will write, and any spec ambiguities. Resolve each ambiguity with the smallest
   reasonable choice and record it in `docs/decisions/NNN-title.md` (context, decision,
   consequence). Stop and ask only if a choice would be expensive to reverse.
3. Implement **only** $ARGUMENTS. Do not build ahead of it. Follow the architecture
   rules in `CLAUDE.md`: keep `src/sim/` pure, put constants in data tables, put strings in
   `src/data/strings.ts`, and start each new source file with the SPDX header.
4. Add or update unit tests for every simulation change, covering the edge cases named
   in the spec.
5. Run `npm run check` and fix what fails until it passes. Also run `npm run build`.
6. Commit with Conventional Commits (split into a few logical commits if that helps).
   Do not push.
7. Stop and summarise:
   - what was done (files and behaviour)
   - the ADRs written, if any
   - a short manual checklist of what I should verify by hand in `npm run dev`
