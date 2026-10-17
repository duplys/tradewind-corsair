# Slice 4 (first part): trade and the tavern

Decisions and numbers: `docs/decisions/017-port-trade-and-tavern.md`. This slice part
enables the **Merchant** and **Tavern** buttons on the port screen. The Governor stays
disabled; the tavern brawl is deferred until the sword duel (slice 3) exists.

## Acceptance

- [ ] The port screen shows Governor (disabled, "Coming soon"), Tavern, Merchant and
      Shipwright. Merchant and Tavern open in every port, including ports hostile to England.
- [ ] Merchant: shows gold, hold used/capacity and, for six goods, the buy and sell price,
      the amount held, and "Cheap here" / "Dear here". Buy 1/10 and Sell 1/10/all work;
      buttons disable when impossible (hold full, no gold, nothing to sell). Esc and
      "Back to the quay" close it.
- [ ] Buying where a good is cheap and selling where it is dear makes gold; buying and
      selling straight back at one port loses gold.
- [ ] Prices at hostile ports are visibly worse, with a note on the panel.
- [ ] Tavern: hire 5 / 10 / fill the ship at 8 gold a hand, stopping at berths and gold.
      A round (10 gold) shows one rumour; a treasure tip (80 gold) adds a red X to the chart.
- [ ] Sailing within reach of an X offers "Dig for treasure"; digging takes six hours,
      finds gold or an empty hole, and removes the X.
- [ ] Cargo, price pressure and treasure sites survive Continue; an older save loads with an
      empty hold. Taking a smaller prize ship drops surplus cargo; defeat clears it.
- [ ] No console errors or warnings; usable on a phone (the merchant list scrolls).
