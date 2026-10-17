# 018: The Governor

Status: accepted (slice 4, second part)

## Context

The Governor button was the last disabled building on the port screen. Nothing specified it.
The player chose: bounty for prizes and sunk ships, a letter of marque, standing with the
nations, and rank with promotion; governors only serve friendly ports; no switching of
allegiance for now.

## Decision

- **Bounty:** taking (`take`/`sink`) or sinking a pirate or a ship of a nation at war with
  England adds a bounty, by class (`BOUNTY_BY_CLASS`) × role (pirate 1.5, warship 1.25,
  trader 1). Letting a ship go earns none; friendly ships earn none. It waits in
  `voyage.bounty`: a `pirate` pool any friendly governor pays, and a `crown` pool only
  English governors pay.
- **Claiming** pays the gold and adds 0.01 reputation per gold with that governor's nation.
- **Rank:** per nation, from the career gold claimed from that nation's governors
  (`claimed`): thresholds 150 / 500 / 1,200 / 2,500, each promotion paying a reward
  (100 / 200 / 400 / 800). Promotion is automatic on claiming; a large claim can skip ranks
  and pays every reward passed. Titles are original, one ladder per nation.
- **Standing** shows the four nations' reputation as Hated, Distrusted, Unknown, Respected or
  Honoured. It is display only: no prices or hostility depend on it yet.
- **Letter of marque:** shown, not traded. The player keeps the fixed English commission;
  other governors note that it is respected. Switching nation would rework hostility, ports,
  NPC behaviour and saves, and is left for its own slice.
- **Access:** the governor is closed to the player in ports hostile to England, like the
  Shipwright.
- **Saves:** `bounty` and `claimed` are optional v2 fields, defaulting to nothing owed and
  nothing claimed, like the other slice 4 additions.

## Consequences

- Reputation now rises as well as falls, but still has no gameplay effect.
- The numbers are untuned; they live in `data/governor.ts`.
