// SPDX-License-Identifier: GPL-3.0-only
import { GOOD_IDS, type GoodId } from '../../data/goods';
import type { PortDef } from '../../data/ports';
import { SHIP_CLASSES } from '../../data/ships';
import type { Voyage } from '../voyage';
import { applyFlow, batchGold } from './market';

/** Units of each good in the hold. */
export type Cargo = Readonly<Record<GoodId, number>>;

export function emptyCargo(): Cargo {
  return Object.fromEntries(GOOD_IDS.map((id) => [id, 0])) as Record<GoodId, number>;
}

export function cargoUsed(cargo: Cargo): number {
  return GOOD_IDS.reduce((sum, id) => sum + cargo[id], 0);
}

export function holdCapacityOf(voyage: Voyage): number {
  return SHIP_CLASSES[voyage.ship.classId].holdCapacity;
}

/**
 * Shrink a cargo to fit a hold by throwing the most plentiful goods over the side one unit at
 * a time (used when the player takes a smaller prize ship).
 */
export function fitCargo(cargo: Cargo, capacity: number): Cargo {
  const next: Record<GoodId, number> = { ...cargo };
  let excess = cargoUsed(next) - capacity;
  while (excess > 0) {
    let most: GoodId = GOOD_IDS[0]!;
    for (const id of GOOD_IDS) if (next[id] > next[most]) most = id;
    next[most] -= 1;
    excess -= 1;
  }
  return next;
}

/** The most units of `good` the player can buy: limited by space, gold and (optionally) `want`. */
export function maxBuyable(voyage: Voyage, port: PortDef, good: GoodId, want = Infinity): number {
  const space = holdCapacityOf(voyage) - cargoUsed(voyage.cargo);
  let qty = Math.min(space, want);
  // Gold is cheapest to find by walking down: batches are small (a hold is at most 180 units).
  while (
    qty > 0 &&
    batchGold(port, good, voyage.tradeFlow, voyage.elapsedHours, 'buy', qty) > voyage.gold
  ) {
    qty -= 1;
  }
  return Math.max(0, qty);
}

/** Buy up to `qty` units; what does not fit or cannot be paid for is simply not bought. */
export function buyGoods(voyage: Voyage, port: PortDef, good: GoodId, qty: number): Voyage {
  const n = maxBuyable(voyage, port, good, qty);
  if (n <= 0) return voyage;
  const cost = batchGold(port, good, voyage.tradeFlow, voyage.elapsedHours, 'buy', n);
  return {
    ...voyage,
    gold: voyage.gold - cost,
    cargo: { ...voyage.cargo, [good]: voyage.cargo[good] + n },
    tradeFlow: applyFlow(voyage.tradeFlow, port.id, good, voyage.elapsedHours, n),
  };
}

/** Sell up to `qty` units of what is in the hold. */
export function sellGoods(voyage: Voyage, port: PortDef, good: GoodId, qty: number): Voyage {
  const n = Math.min(qty, voyage.cargo[good]);
  if (n <= 0) return voyage;
  const revenue = batchGold(port, good, voyage.tradeFlow, voyage.elapsedHours, 'sell', n);
  return {
    ...voyage,
    gold: voyage.gold + revenue,
    cargo: { ...voyage.cargo, [good]: voyage.cargo[good] - n },
    tradeFlow: applyFlow(voyage.tradeFlow, port.id, good, voyage.elapsedHours, -n),
  };
}
