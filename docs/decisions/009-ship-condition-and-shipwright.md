# 009: Ship condition, ledger and Shipwright (slice 2 M1)

Status: accepted (slice 2, milestone M1)

## Context

M1 adds the five ship classes, the effects of ship condition (spec §3.2), the extended
ledger (§3.3) and the Shipwright (§3.4). A few details are not settled by the spec.

## Decision

- **Relations are pulled forward from M3.** The Shipwright must be closed at ports hostile to
  the player (§3.4, §5.1), so `data/relations.ts` (`atWar`, `hostileToPlayer`,
  `PLAYER_NATION = 'en'`) is added now, with tests. M3 adds the behaviour that uses it at
  sea. Hostile ports show the Shipwright button disabled, with the caption "Closed to
  English ships".
- **Condition constants** live in `data/condition.ts`, and repair prices and times in
  `data/shipyard.ts`. `BASE_RELOAD_S` (6) and the 20 s cap are there too, next to the
  formula that uses them. `data/combat.ts` (M4) holds only combat constants.
- **The player's world-map speed** now goes through `performanceOf(class, condition)` and the
  generic `stepShip`. At full condition with at least a quarter of the typical crew, the
  result equals the class values, so slice 1's feel (and the crossing test) is unchanged.
  The parameters are cached until the condition object changes.
- **"Repair what I can afford"** repairs the hull first, then the rigging. A part that cannot
  be fully paid for is repaired by **whole percentage points**, so the price never exceeds
  the gold (a test checks this across many amounts). Time follows the updated spec: 2 days
  per 25 points, pro rata, rounded to the nearest hour.
- **Replacing guns** replaces as many lost guns as the gold pays for, up to the class
  maximum, and takes no time.
- **Prices and times are shown on the buttons** themselves ("720 gold · 4 days"), so the
  player sees both before confirming. There is no second confirmation step. Every repair
  auto-saves, and the port screen's date updates.
- **The Shipwright panel** is its own dialog over the port screen. Esc or **Back** closes it
  and returns focus to the port card. While it is open, Enter/Space do not set sail.
- **Ledger:**
  - date
  - "Swallow · Sloop · 8 guns" (intact guns)
  - gold
  - "Crew 40 of 60 berths"
  - hull and rigging as ten-segment pixel bars (`role="meter"`, with the value in the
    `aria-label` and tooltip), amber below 50 % and red below 25 %
  - Percentages are shown as whole numbers, and never 0 while something is left.
- **Dev-only damage key (K):** in dev builds, K takes 12 % hull, 12 % rigging, 4 crew and 1
  gun (clamped at 0). It is compiled out of production builds.
- **Saves** now reject a crew above the class's `crewMax`.
- **Test change:** `tests/persist/save.test.ts` used `classId: 'galleon'` as an example of
  an unknown class. The galleon is now real, so the case uses `'man-o-war'` instead.

## Consequences

Damage now matters on the world map. M4's combat uses the same `performanceOf`,
`gunsMannedPerBroadside` and `reloadTimeSec`, and M7's prize swap only has to replace the
class and the condition.
