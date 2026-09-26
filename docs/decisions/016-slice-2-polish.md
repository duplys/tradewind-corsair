# 016: Slice 2 polish and tuning (M8)

Status: accepted (slice 2, milestone M8)

## Context

M8 is the polish, tuning and performance pass. Earlier ADRs left notes for it: the escape
odds (ADR 011), sloop-against-frigate in combat (ADR 013), and NPC churn near busy ports
(ADR 010).

## Decision

- **Escape roll:** the divisor is 3 kn, not 6. A sloop fleeing a frigate now gets away 90 %
  of the time running upwind and 27 % running downwind (the acceptance list says "most of
  the time" and "rarely"; with 6 the numbers were 73 % and 39 %). Across the wind, or
  against a brigantine, the odds sit in between. The escape tests now assert ≥ 0.85
  upwind and < 0.3 downwind.
- **Spawning:** at most 2 ships per spawn check, and all 420 port-to-port sea lanes are
  computed at load (46 ms together with the grid). Spec §12 asks for the path cache at
  load and at most 2 paths per frame. Before this, a spawn check could plan up to 6 routes
  and lanes at once, a 10 ms step. The worst step is now 7.6 ms, for two long routes.
  A fresh voyage fills its six ships over 1.5 s instead of at once, behind the fade-in. The
  M2 world test now expects two ships after the first check and six after three.
- **Left as they are, with reasons:**
  - **In combat a sloop always escapes a frigate** (ADR 013): it withdraws when outnumbered
    and outpoints the frigate on most courses. The world-map roll already makes running
    downwind a poor bet, so the whole encounter is balanced. Combat can be revisited after
    playtesting.
  - **Ship traffic near ports many NPCs are bound for** (ADR 010) stays busy. Players see
    ships arriving and leaving, which suits a harbour. Worth revisiting after playtesting.
- **Acceptance run-through:** recorded in `docs/design/slice-02-acceptance.md`. The visual
  and feel items remain for a manual pass in the browsers, then the VPS deploy.

## Consequences

The slice is ready for the owner's manual acceptance pass and deploy. The spec's §6.2, §7
and §9 numbers are superseded by ADRs 013 and 016, and the spec text can be updated to
match.
