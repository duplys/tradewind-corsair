// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { GOOD_IDS, HOSTILE_MARKUP } from '../../../src/data/goods';
import { PORTS } from '../../../src/data/ports';
import { SHIP_CLASSES } from '../../../src/data/ships';
import { basePriceAt, quoteAt, applyFlow, effectiveNet } from '../../../src/sim/trade/market';
import {
  buyGoods,
  cargoUsed,
  emptyCargo,
  fitCargo,
  holdCapacityOf,
  maxBuyable,
  sellGoods,
} from '../../../src/sim/trade/trade';
import { newVoyage, type Voyage } from '../../../src/sim/voyage';
import { derivePorts, type Port } from '../../../src/sim/world/ports';
import { buildWorld } from '../../../src/sim/world/world';

let ports: Port[];
let voyage: Voyage;
const port = (id: string) => PORTS.find((p) => p.id === id)!;

beforeAll(() => {
  const world = buildWorld();
  ports = derivePorts(world, PORTS);
  voyage = newVoyage(world, ports);
});

describe('prices', () => {
  it('are cheaper where a good is produced and dearer where it is wanted', () => {
    // Bridgetown makes sugar and wants timber; Willemstad wants sugar, Nassau makes timber.
    for (const hours of [0, 700, 5000]) {
      expect(basePriceAt(port('bridgetown'), 'sugar', hours)).toBeLessThan(
        basePriceAt(port('willemstad'), 'sugar', hours),
      );
      expect(basePriceAt(port('bridgetown'), 'timber', hours)).toBeGreaterThan(
        basePriceAt(port('nassau'), 'timber', hours),
      );
    }
  });

  it('drift from month to month but are stable within a month', () => {
    const p = port('havana');
    expect(basePriceAt(p, 'rum', 10)).toBe(basePriceAt(p, 'rum', 700));
    const months = new Set([0, 1, 2, 3, 4, 5].map((m) => basePriceAt(p, 'rum', m * 720 + 1)));
    expect(months.size).toBeGreaterThan(1);
  });

  it('always buy above and sell below the middle, and charge more in hostile ports', () => {
    const friendly = quoteAt(port('port-royal'), 'cloth', {}, 100);
    expect(friendly.buy).toBeGreaterThan(friendly.sell);
    // Spain is at war with England: same base kind of price, wider spread.
    const hostile = quoteAt(port('havana'), 'cloth', {}, 100);
    const hostileMid = basePriceAt(port('havana'), 'cloth', 100);
    expect(hostile.buy).toBeGreaterThan(hostileMid * (1 + HOSTILE_MARKUP));
    expect(hostile.sell).toBeLessThan(hostileMid * (1 - HOSTILE_MARKUP));
  });

  it('rise with the player’s buying and fade over time', () => {
    const p = port('nassau');
    const flow = applyFlow({}, p.id, 'rum', 0, 20);
    expect(quoteAt(p, 'rum', flow, 0).buy).toBeGreaterThan(quoteAt(p, 'rum', {}, 0).buy);
    expect(effectiveNet(flow, p.id, 'rum', 720)).toBeCloseTo(10, 5);
    expect(applyFlow(flow, p.id, 'rum', 0, -20)[`${p.id}/rum`]).toBeUndefined();
  });
});

describe('buying and selling', () => {
  const at = port('port-royal');

  it('moves gold and goods', () => {
    const bought = buyGoods(voyage, at, 'sugar', 10);
    expect(bought.cargo.sugar).toBe(10);
    expect(bought.gold).toBeLessThan(voyage.gold);
    const sold = sellGoods(bought, at, 'sugar', 10);
    expect(sold.cargo.sugar).toBe(0);
    expect(sold.gold).toBeGreaterThan(bought.gold);
  });

  it('never makes money by buying and selling the same goods straight back', () => {
    for (const good of GOOD_IDS) {
      const rich = {
        ...voyage,
        gold: 100000,
        ship: { ...voyage.ship, classId: 'galleon' as const },
      };
      const bought = buyGoods(rich, at, good, 100);
      const sold = sellGoods(bought, at, good, 100);
      expect(sold.gold, good).toBeLessThan(rich.gold);
    }
  });

  it('is limited by hold space and by gold', () => {
    const cap = holdCapacityOf(voyage);
    expect(cap).toBe(SHIP_CLASSES.sloop.holdCapacity);
    const full = buyGoods({ ...voyage, gold: 1e6 }, at, 'timber', 1000);
    expect(cargoUsed(full.cargo)).toBe(cap);
    expect(maxBuyable(full, at, 'sugar')).toBe(0);
    const poor = { ...voyage, gold: 50 };
    const n = maxBuyable(poor, at, 'spices');
    expect(buyGoods(poor, at, 'spices', 1000).cargo.spices).toBe(n);
    expect(buyGoods(poor, at, 'spices', 1000).gold).toBeGreaterThanOrEqual(0);
  });

  it('does nothing for an empty request or an empty hold', () => {
    expect(buyGoods(voyage, at, 'sugar', 0)).toBe(voyage);
    expect(sellGoods(voyage, at, 'sugar', 5)).toBe(voyage);
  });

  it('can only sell what it holds', () => {
    const v = buyGoods(voyage, at, 'rum', 3);
    expect(sellGoods(v, at, 'rum', 50).cargo.rum).toBe(0);
  });
});

describe('fitCargo', () => {
  it('leaves a fitting cargo alone and throws the most plentiful goods over otherwise', () => {
    const cargo = { ...emptyCargo(), sugar: 10, rum: 4, cloth: 2 };
    expect(fitCargo(cargo, 20)).toEqual(cargo);
    const fit = fitCargo(cargo, 8);
    expect(cargoUsed(fit)).toBe(8);
    expect(fit).toEqual({ ...emptyCargo(), sugar: 3, rum: 3, cloth: 2 });
  });
});
