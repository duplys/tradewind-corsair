// SPDX-License-Identifier: GPL-3.0-only
import type { ShipClass } from '../../data/ships';

/**
 * A ship's state of repair and manning (slice 2 spec §3.2). Applies to the player and every
 * NPC. The effects on sailing and gunnery arrive in slice 2 M1.
 */
export interface ShipCondition {
  /** 0..100 */
  readonly hullPct: number;
  /** 0..100 */
  readonly riggingPct: number;
  /** Integer ≥ 0. */
  readonly crew: number;
  /** 0..class guns */
  readonly gunsIntact: number;
}

/** A ship in perfect repair with every gun, manned by `crew` hands. */
export function fullCondition(cls: ShipClass, crew: number): ShipCondition {
  return { hullPct: 100, riggingPct: 100, crew, gunsIntact: cls.guns };
}
