// SPDX-License-Identifier: GPL-3.0-only
import {
  ARENA_H_PX,
  ARENA_W_PX,
  CAUGHT_START_DISTANCE_PX,
  MAX_BALLS,
  START_DISTANCE_PX,
} from '../../data/combat';
import type { NpcRole } from '../../data/npc';
import type { ShipClassId } from '../../data/ships';
import type { Rng } from '../rng';
import type { SailingShip } from '../sailing/ship';
import type { Wind } from '../sailing/wind';
import type { ShipCondition } from '../ships/condition';

export type BroadsideSide = 'port' | 'starboard';

/** A broadside being fired: balls leave one by one (a ripple). */
export interface Volley {
  /** Guns firing in this broadside, and how many have fired so far. */
  total: number;
  fired: number;
  /** Seconds until the next ball leaves. */
  untilNextSec: number;
}

/** One ship in the fight. Mutable: `stepCombat` updates it in place. */
export interface CombatShip {
  readonly index: 0 | 1;
  readonly classId: ShipClassId;
  /** 'player' for the player's ship; the NPC's role otherwise. */
  readonly role: 'player' | NpcRole;
  /** Crew at the start of the fight (striking colours depends on it). */
  readonly startCrew: number;
  ship: SailingShip;
  condition: ShipCondition;
  /** Seconds until each side is loaded again (0 = ready). */
  reloadSec: Record<BroadsideSide, number>;
  volley: Record<BroadsideSide, Volley | null>;
  struck: boolean;
  /** Seconds since the ship began to sink, or null while afloat. */
  sinkingSec: number | null;
}

/** Balls in flight, in a fixed-size pool of parallel arrays (no allocation per shot). */
export class BallPool {
  readonly active = new Uint8Array(MAX_BALLS);
  readonly x = new Float64Array(MAX_BALLS);
  readonly y = new Float64Array(MAX_BALLS);
  readonly vx = new Float64Array(MAX_BALLS);
  readonly vy = new Float64Array(MAX_BALLS);
  /** Distance flown so far, in combat px. */
  readonly flown = new Float64Array(MAX_BALLS);
  readonly owner = new Uint8Array(MAX_BALLS);

  /** Launch a ball; returns false when the pool is full (the shot is lost). */
  launch(owner: number, x: number, y: number, vx: number, vy: number): boolean {
    for (let i = 0; i < MAX_BALLS; i++) {
      if (this.active[i]) continue;
      this.active[i] = 1;
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.flown[i] = 0;
      this.owner[i] = owner;
      return true;
    }
    return false;
  }

  count(): number {
    let n = 0;
    for (let i = 0; i < MAX_BALLS; i++) n += this.active[i]!;
    return n;
  }
}

export type CombatOutcome =
  | { readonly type: 'sunk'; readonly shipIndex: 0 | 1 }
  /** The player came alongside an enemy that had struck: the prize is taken. */
  | { readonly type: 'captured' }
  /** The hulls met before the enemy struck: a boarding fight follows (spec §9, M7). */
  | { readonly type: 'boarding' }
  | { readonly type: 'escaped'; readonly shipIndex: 0 | 1 }
  | { readonly type: 'surrendered' };

/** The whole fight. The player's ship is ships[0], the enemy ships[1]. */
export interface CombatState {
  readonly arenaW: number;
  readonly arenaH: number;
  /** Fixed for the whole fight (spec §6.1). */
  readonly wind: Wind;
  readonly ships: readonly [CombatShip, CombatShip];
  readonly balls: BallPool;
  /** A child stream forked from the world RNG for this encounter. */
  readonly rng: Rng;
  timeSec: number;
  /** How long the hulls have been touching. */
  contactSec: number;
  outcome: CombatOutcome | null;
}

export interface CombatantSetup {
  readonly classId: ShipClassId;
  readonly role: 'player' | NpcRole;
  readonly condition: ShipCondition;
  readonly headingRad: number;
  readonly speedKn: number;
  readonly sail: SailingShip['sail'];
}

export interface CombatSetup {
  readonly player: CombatantSetup;
  readonly enemy: CombatantSetup;
  readonly wind: Wind;
  readonly rng: Rng;
  /** World bearing from the player to the enemy, kept in the arena (spec §6.2). */
  readonly bearingToEnemyRad: number;
  /** After a failed escape: closer, with the enemy upwind of the player. */
  readonly escapeFailed: boolean;
}

function combatant(index: 0 | 1, s: CombatantSetup, x: number, y: number): CombatShip {
  return {
    index,
    classId: s.classId,
    role: s.role,
    startCrew: s.condition.crew,
    ship: { x, y, headingRad: s.headingRad, speedKn: s.speedKn, sail: s.sail },
    condition: { ...s.condition },
    reloadSec: { port: 0, starboard: 0 },
    volley: { port: null, starboard: null },
    struck: false,
    sinkingSec: null,
  };
}

/**
 * Set up a fight in the middle of the arena (spec §6.2). Normally the ships start 220 px
 * apart on the same bearing as on the world map, keeping their headings; after a failed
 * escape they start 150 px apart with the enemy upwind.
 */
export function createCombat(setup: CombatSetup): CombatState {
  const cx = ARENA_W_PX / 2;
  const cy = ARENA_H_PX / 2;
  const distance = setup.escapeFailed ? CAUGHT_START_DISTANCE_PX : START_DISTANCE_PX;
  // Direction from the player to the enemy.
  const angle = setup.escapeFailed ? setup.wind.towardRad + Math.PI : setup.bearingToEnemyRad;
  const dx = (Math.cos(angle) * distance) / 2;
  const dy = (Math.sin(angle) * distance) / 2;
  return {
    arenaW: ARENA_W_PX,
    arenaH: ARENA_H_PX,
    wind: setup.wind,
    ships: [
      combatant(0, setup.player, cx - dx, cy - dy),
      combatant(1, setup.enemy, cx + dx, cy + dy),
    ],
    balls: new BallPool(),
    rng: setup.rng,
    timeSec: 0,
    contactSec: 0,
    outcome: null,
  };
}
