// SPDX-License-Identifier: GPL-3.0-only
// Trade goods and market tuning (slice 4 spec §2). All prices are in gold per unit.

export type GoodId = 'sugar' | 'tobacco' | 'rum' | 'cloth' | 'timber' | 'spices';

export interface Good {
  readonly id: GoodId;
  readonly name: string;
  /** Price at a port that neither produces nor wants it, in a neutral month. */
  readonly basePrice: number;
}

export const GOOD_IDS: readonly GoodId[] = ['sugar', 'tobacco', 'rum', 'cloth', 'timber', 'spices'];

export const GOODS: Readonly<Record<GoodId, Good>> = {
  sugar: { id: 'sugar', name: 'Sugar', basePrice: 24 },
  tobacco: { id: 'tobacco', name: 'Tobacco', basePrice: 32 },
  rum: { id: 'rum', name: 'Rum', basePrice: 40 },
  cloth: { id: 'cloth', name: 'Cloth', basePrice: 55 },
  timber: { id: 'timber', name: 'Timber', basePrice: 14 },
  spices: { id: 'spices', name: 'Spices', basePrice: 90 },
};

/** Price factor where a good is produced (cheap) and where it is wanted (dear). */
export const PRODUCED_PRICE_FACTOR = 0.7;
export const WANTED_PRICE_FACTOR = 1.35;

/** Each month every port's prices drift by up to this share either way. */
export const MONTHLY_DRIFT = 0.12;
/** Fixed seed for the drift, so prices do not depend on the voyage. */
export const MARKET_SEED = 1660;

/** The merchant buys below and sells above the middle price by this share. */
export const SPREAD = 0.05;
/** Extra mark-up on what we pay and mark-down on what we get in a port hostile to England. */
export const HOSTILE_MARKUP = 0.2;

/** Each unit the player has bought moves that port's price up by this share (sold: down). */
export const IMPACT_PER_UNIT = 0.008;
/** The player's pressure never moves a price by more than this share. */
export const IMPACT_MAX = 0.4;
/** The player's pressure on a price halves every this many game hours (30 days). */
export const IMPACT_HALF_LIFE_HOURS = 720;
/** Pressure below this many units is forgotten (keeps saves small). */
export const IMPACT_FORGET_UNITS = 0.5;

/** The quantity steps the merchant panel offers. */
export const TRADE_STEPS: readonly number[] = [1, 10];

export interface PortTrade {
  readonly produces: readonly GoodId[];
  readonly wants: readonly GoodId[];
}

/** What each port makes cheaply and craves. Ports not listed trade at base prices. */
export const PORT_TRADE: Readonly<Record<string, PortTrade>> = {
  havana: { produces: ['tobacco', 'sugar'], wants: ['cloth', 'timber'] },
  santiago: { produces: ['sugar'], wants: ['cloth', 'rum'] },
  'santo-domingo': { produces: ['sugar', 'tobacco'], wants: ['cloth', 'spices'] },
  'san-juan': { produces: ['sugar', 'rum'], wants: ['timber', 'cloth'] },
  'st-augustine': { produces: ['timber'], wants: ['cloth', 'rum', 'spices'] },
  veracruz: { produces: ['spices'], wants: ['timber', 'cloth'] },
  campeche: { produces: ['timber'], wants: ['cloth', 'rum'] },
  'porto-bello': { produces: ['spices'], wants: ['cloth', 'timber'] },
  cartagena: { produces: ['spices', 'tobacco'], wants: ['cloth', 'rum'] },
  maracaibo: { produces: ['tobacco'], wants: ['cloth', 'timber'] },
  caracas: { produces: ['tobacco'], wants: ['rum', 'cloth'] },
  trinidad: { produces: ['tobacco', 'sugar'], wants: ['timber', 'cloth'] },
  'port-royal': { produces: ['rum', 'sugar'], wants: ['cloth', 'timber'] },
  bridgetown: { produces: ['sugar', 'rum'], wants: ['timber', 'cloth'] },
  'st-johns': { produces: ['sugar'], wants: ['timber', 'spices'] },
  nassau: { produces: ['timber'], wants: ['rum', 'cloth'] },
  tortuga: { produces: ['tobacco', 'rum'], wants: ['cloth', 'spices'] },
  'st-pierre': { produces: ['sugar', 'rum'], wants: ['cloth', 'timber'] },
  'basse-terre': { produces: ['sugar', 'tobacco'], wants: ['cloth', 'spices'] },
  willemstad: { produces: ['cloth', 'spices'], wants: ['timber', 'sugar'] },
  'st-eustatius': { produces: ['cloth', 'spices'], wants: ['sugar', 'rum', 'tobacco'] },
};
