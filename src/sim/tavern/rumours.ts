// SPDX-License-Identifier: GPL-3.0-only
import { GOOD_IDS, type GoodId } from '../../data/goods';
import { NATIONS, type NationId } from '../../data/nations';
import { atWar } from '../../data/relations';
import { pick } from '../random';
import type { Rng } from '../rng';
import { basePriceAt, midPrice, effectiveNet } from '../trade/market';
import type { Voyage } from '../voyage';
import type { Port } from '../world/ports';

/** What the tavern talk is about, as data; `ui/tavernText.ts` turns it into sentences. */
export type Rumour =
  | {
      readonly kind: 'prices';
      readonly good: GoodId;
      readonly dearPort: string;
      readonly cheapPort: string;
    }
  | { readonly kind: 'war'; readonly a: NationId; readonly b: NationId; readonly atWar: boolean }
  | { readonly kind: 'pirates'; readonly nearPort: string }
  | { readonly kind: 'place'; readonly portId: string };

function price(voyage: Voyage, port: Port, good: GoodId): number {
  const base = basePriceAt(port.def, good, voyage.elapsedHours);
  return midPrice(base, effectiveNet(voyage.tradeFlow, port.def.id, good, voyage.elapsedHours));
}

function nearestPort(ports: readonly Port[], x: number, y: number): Port {
  let best = ports[0]!;
  let bestD2 = Infinity;
  for (const port of ports) {
    const d2 = (port.harbour.x - x) ** 2 + (port.harbour.y - y) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = port;
    }
  }
  return best;
}

/**
 * One piece of talk, drawn from the world as it is now: where a good sells dear and cheap,
 * who is at war, where pirate sails were seen, or a word about a port. `here` is never named
 * as the answer to its own price rumour.
 */
export function overhearRumour(
  voyage: Voyage,
  ports: readonly Port[],
  here: Port,
  rng: Rng,
): Rumour {
  const kind = pick(rng, ['prices', 'prices', 'war', 'pirates', 'place'] as const);
  if (kind === 'prices') {
    const good = pick(rng, GOOD_IDS);
    const others = ports.filter((p) => p.def.id !== here.def.id);
    let dear = others[0]!;
    let cheap = others[0]!;
    for (const p of others) {
      if (price(voyage, p, good) > price(voyage, dear, good)) dear = p;
      if (price(voyage, p, good) < price(voyage, cheap, good)) cheap = p;
    }
    return { kind, good, dearPort: dear.def.id, cheapPort: cheap.def.id };
  }
  if (kind === 'war') {
    const nations = Object.keys(NATIONS) as NationId[];
    const a = pick(rng, nations);
    const b = pick(
      rng,
      nations.filter((n) => n !== a),
    );
    return { kind, a, b, atWar: atWar(a, b) };
  }
  if (kind === 'pirates') {
    const pirates = voyage.npcs.filter((n) => n.nation === 'pirate');
    if (pirates.length > 0) {
      const ship = pick(rng, pirates).ship;
      return { kind, nearPort: nearestPort(ports, ship.x, ship.y).def.id };
    }
  }
  const others = ports.filter((p) => p.def.id !== here.def.id);
  return { kind: 'place', portId: pick(rng, others).def.id };
}
