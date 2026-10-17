# 017: Port trade and the tavern

Status: accepted (slice 4, first part)

## Context

The port screen had Governor, Tavern and Merchant disabled ("coming soon"). Slice 2 left
crew recruiting to the tavern "in slice 4"; no slice 4 spec exists yet. The player asked for
trading and the pub; answers given up front: a classic goods market, crew + rumours +
treasure tips at the pub, Governor left for later, plunder stays gold, and the tavern brawl
waits for the sword duel (slice 3 is only a spec so far).

## Decision

- **Goods:** six goods in `data/goods.ts`. Each port produces (×0.7) or wants (×1.35) some
  of them (`PORT_TRADE`); other ports trade at base price. A monthly drift of ±12 % comes
  from a hash of port, good and month, with a fixed seed, so prices never depend on the
  voyage or the RNG.
- **Player pressure:** each unit bought raises that price 0.8 % (sold: lowers), capped at
  ±40 %, halving every 30 days. Pressure is saved as `tradeFlow` keyed `portId/goodId`.
  A batch is priced unit by unit, so buying and selling the same units back at once always
  loses the 5 % spread (tested for every good). Buying rounds up, selling down.
- **Hostile ports** still trade, with 20 % worse prices each way on top of the spread.
- **Hold:** `holdCapacity` per ship class (sloop 30, brigantine 60, fluyt 150, frigate 50,
  galleon 180). Taking a smaller prize throws the surplus overboard (most plentiful goods
  first); defeat loses the cargo with the ship.
- **Tavern:** hands cost 8 gold each, limited by berths and gold; a round costs 10 gold and
  yields one rumour drawn from the live world (prices, wars, pirates, a port's blurb);
  a treasure tip costs 80 gold and can be held up to three at a time.
- **Treasure:** a tip places a land site 120–450 px from the port, beside open water, away
  from harbours and other sites, using the world RNG. Within 22 px of it the sailing prompt
  offers "Dig for treasure": six hours pass, and the hoard (250–700 gold) is there 80 % of
  the time. Sites show as a red X on the chart and on the sea view.
- **Saves:** the new fields (`cargo`, `tradeFlow`, `treasures`) are optional additions to
  save v2, so existing saves load with an empty hold and no tips and no version bump is
  needed. This leaves `v3` free for the slice 3 spec's numbering.
- **Time and the sim:** trading and hiring take no game time; digging takes six hours.
  Rumours use the world RNG, so the same voyage hears the same talk.

## Consequences

- The tavern brawl, a Governor, and goods as plunder are not built. When the duel module
  exists, the brawl can be added as another tavern action.
- Prices only change with the calendar and the player; NPC traders do not affect them yet.
- Prices have not been balance-tuned against a long career; numbers are in `data/goods.ts`
  and `data/tavern.ts`.
