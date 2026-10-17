// SPDX-License-Identifier: GPL-3.0-only
import {
  GOODS,
  HOSTILE_MARKUP,
  IMPACT_FORGET_UNITS,
  IMPACT_HALF_LIFE_HOURS,
  IMPACT_MAX,
  IMPACT_PER_UNIT,
  MARKET_SEED,
  MONTHLY_DRIFT,
  PORT_TRADE,
  PRODUCED_PRICE_FACTOR,
  SPREAD,
  WANTED_PRICE_FACTOR,
  type GoodId,
} from '../../data/goods';
import type { PortDef } from '../../data/ports';
import { hostileToPlayer } from '../../data/relations';
import { clamp } from '../math';
import { hash2, hashString } from '../rng';

/** The player's lingering pressure on one price: net units bought (negative: sold). */
export interface FlowEntry {
  readonly net: number;
  readonly atHours: number;
}

/** Pressure per "portId/goodId". Prices are a function of the date, the port and this. */
export type TradeFlow = Readonly<Record<string, FlowEntry>>;

const HOURS_PER_MONTH = 30 * 24;

export function flowKey(portId: string, good: GoodId): string {
  return `${portId}/${good}`;
}

/** The pressure still felt at `nowHours`: it halves every 30 days. */
export function effectiveNet(
  flow: TradeFlow,
  portId: string,
  good: GoodId,
  nowHours: number,
): number {
  const entry = flow[flowKey(portId, good)];
  if (!entry) return 0;
  const age = Math.max(0, nowHours - entry.atHours);
  return entry.net * 0.5 ** (age / IMPACT_HALF_LIFE_HOURS);
}

/** The price before the player's own pressure: base × what the port makes or wants × drift. */
export function basePriceAt(port: PortDef, good: GoodId, nowHours: number): number {
  const trade = PORT_TRADE[port.id];
  let factor = 1;
  if (trade?.produces.includes(good)) factor = PRODUCED_PRICE_FACTOR;
  else if (trade?.wants.includes(good)) factor = WANTED_PRICE_FACTOR;
  const month = Math.floor(nowHours / HOURS_PER_MONTH);
  const noise = hash2(hashString(port.id), hashString(good) ^ month, MARKET_SEED) * 2 - 1;
  return GOODS[good].basePrice * factor * (1 + MONTHLY_DRIFT * noise);
}

/** The middle price after `net` units of the player's pressure. */
export function midPrice(base: number, net: number): number {
  return base * (1 + clamp(net * IMPACT_PER_UNIT, -IMPACT_MAX, IMPACT_MAX));
}

/** Hostile ports charge more and pay less. */
function markup(port: PortDef): number {
  return hostileToPlayer(port.nation) ? HOSTILE_MARKUP : 0;
}

/** What one unit costs and fetches right now (for display), in gold. */
export interface Quote {
  readonly buy: number;
  readonly sell: number;
}

export function quoteAt(port: PortDef, good: GoodId, flow: TradeFlow, nowHours: number): Quote {
  const base = basePriceAt(port, good, nowHours);
  const net = effectiveNet(flow, port.id, good, nowHours);
  const mid = midPrice(base, net);
  const m = markup(port);
  return {
    buy: Math.max(1, Math.ceil(mid * (1 + SPREAD + m))),
    sell: Math.max(1, Math.floor(mid * (1 - SPREAD - m))),
  };
}

/**
 * The gold for a batch. Every unit is priced after the pressure of the ones before it, so
 * buying and selling the same units back at once always loses the spread (no free profit by
 * bulk trading). Buying rounds up, selling rounds down.
 */
export function batchGold(
  port: PortDef,
  good: GoodId,
  flow: TradeFlow,
  nowHours: number,
  side: 'buy' | 'sell',
  qty: number,
): number {
  const base = basePriceAt(port, good, nowHours);
  let net = effectiveNet(flow, port.id, good, nowHours);
  const m = markup(port);
  let total = 0;
  for (let i = 0; i < qty; i++) {
    if (side === 'buy') {
      total += midPrice(base, net) * (1 + SPREAD + m);
      net += 1;
    } else {
      net -= 1;
      total += midPrice(base, net) * (1 - SPREAD - m);
    }
  }
  return side === 'buy' ? Math.ceil(total) : Math.floor(total);
}

/** The flow after the player moved `delta` units (buy +, sell −). Faded entries are dropped. */
export function applyFlow(
  flow: TradeFlow,
  portId: string,
  good: GoodId,
  nowHours: number,
  delta: number,
): TradeFlow {
  const key = flowKey(portId, good);
  const net = effectiveNet(flow, portId, good, nowHours) + delta;
  const next: Record<string, FlowEntry> = { ...flow };
  if (Math.abs(net) < IMPACT_FORGET_UNITS) delete next[key];
  else next[key] = { net, atHours: nowHours };
  return next;
}
