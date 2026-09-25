// SPDX-License-Identifier: GPL-3.0-only
import type { NpcRole } from '../../data/npc';
import type { Allegiance } from '../../data/relations';
import type { ShipClassId } from '../../data/ships';
import type { SailingShip } from '../sailing/ship';
import type { ShipCondition } from '../ships/condition';
import type { WorldPoint } from '../world/projection';

export type { NpcRole };
export type NpcIntent = 'travel' | 'chase' | 'flee' | 'ignore-player';

export interface NpcTack {
  /** +1: the course is clockwise of the wind's eye; −1: anticlockwise. */
  readonly side: -1 | 1;
  /** Change tack at the latest at this game time. */
  readonly untilHours: number;
}

/** Where an NPC was when its progress was last checked (stuck detection, §4.4). */
export interface NpcProgress {
  readonly x: number;
  readonly y: number;
  readonly atHours: number;
}

/**
 * A ship sailed by the computer on the world map (slice 2 spec §4.1). Plain data: it is saved
 * as it is. `home`, `loiterUntilHours`, `targetHeadingRad`, `progress` (ADR 010) and
 * `intentSinceHours` (ADR 011) are additions to the spec's model.
 */
export interface NpcShip {
  /** Unique within the save. */
  readonly id: number;
  readonly classId: ShipClassId;
  readonly nation: Allegiance;
  readonly role: NpcRole;
  readonly name: string;
  readonly ship: SailingShip;
  readonly condition: ShipCondition;
  readonly destPortId: string;
  /** Remaining waypoints, next first. */
  readonly path: readonly WorldPoint[];
  readonly tack: NpcTack | null;
  readonly intent: NpcIntent;
  /** When the current intent began (a chase gives up after 3 days, slice 2 spec §5.2). */
  readonly intentSinceHours: number;
  readonly ignorePlayerUntilHours: number;
  /** Where the ship appeared. Pirates loiter around it. */
  readonly home: WorldPoint;
  /** Pirates loiter near home until this game time, then sail off (0 for other roles). */
  readonly loiterUntilHours: number;
  /** The course the helmsman steers for, set by the AI 10 times per second. */
  readonly targetHeadingRad: number;
  readonly progress: NpcProgress;
}
