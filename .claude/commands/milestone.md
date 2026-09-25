---
description: Implement one milestone of a slice spec, test it, and commit
argument-hint: <milestone, e.g. M3> [slice, e.g. slice-02]
---

Implement one milestone. Arguments: `$ARGUMENTS`

1. **Work out what to build.** The first argument is the milestone (for example `M3`). The
   optional second argument names the slice (for example `slice-02` or `02`): use the
   spec file in `docs/specs/` whose name starts with that slice (`slice-02-*.md`). Without
   a second argument, use the highest-numbered `slice-NN-*.md` in `docs/specs/`. If the
   milestone or spec cannot be found, stop and say so.
2. **Read** `CLAUDE.md` in full, then that spec in full. Skim earlier slice specs for units
   and conventions they define, and read the ADRs in `docs/decisions/`. Where the code and
   a spec disagree, the code and the ADRs win unless they break a rule in `CLAUDE.md`.
   Find the milestone's row in the spec's milestone table and every section it relies on.
3. **Restate a short plan:** the files you will add or change, the tests you will write,
   and any spec ambiguities. Resolve each ambiguity with the smallest reasonable choice
   and record it in `docs/decisions/NNN-title.md` (context, decision, consequence), using
   the next free number. Stop and ask only if a choice would be expensive to reverse.
4. **Implement only that milestone.** Do not build ahead of it. Follow the architecture
   rules in `CLAUDE.md`: keep `src/sim/` pure, put constants in data tables, put strings in
   `src/data/strings.ts`, and start each new source file with the SPDX header.
5. **Test:** add or update unit tests for every simulation change, covering the edge cases
   named in the spec. Do not change existing tests unless the milestone requires it; when
   you do, say why in the ADR.
6. **Run** `npm run check` and fix what fails until it passes. Also run `npm run build`.
   If `package.json` has a `test:balance` script and you changed combat code or ship or
   combat data, run it too and keep it green.
7. **Commit** with Conventional Commits (split into a few logical commits if that helps).
   Do not push.
8. **Stop and summarise:**
   - what was done (files and behaviour)
   - the ADRs written, if any
   - a short manual checklist of what I should verify by hand in `npm run dev`
