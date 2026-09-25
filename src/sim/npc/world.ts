// SPDX-License-Identifier: GPL-3.0-only
import {
  NPC_AI_TICK_HOURS,
  NPC_DESPAWN_PX,
  NPC_MAX,
  NPC_NEARBY_RADIUS_PX,
  NPC_SPAWN_CHECK_HOURS,
  NPC_TARGET_NEARBY,
} from '../../data/npc';
import { WORLD_SAILING_SCALE } from '../../data/sailing';
import { SHIP_CLASSES } from '../../data/ships';
import { restoreRng, type Rng, type RngState } from '../rng';
import { stepShip } from '../sailing/ship';
import type { Wind } from '../sailing/wind';
import { performanceOf } from '../ships/condition';
import type { WorldPoint } from '../world/projection';
import type { Navigator } from './navigator';
import type { NpcShip } from './npc';
import { decideSailing, helmInput } from './sail';
import { spawnNpc } from './spawn';

/** The part of the voyage that the NPC simulation reads and writes. */
export interface NpcWorldState {
  readonly npcs: readonly NpcShip[];
  readonly nextNpcId: number;
  readonly rngState: RngState;
}

export interface NpcStepContext {
  readonly nav: Navigator;
  readonly wind: Wind;
  readonly player: WorldPoint;
  /** Game time before and after this step. */
  readonly hoursBefore: number;
  readonly hoursAfter: number;
}

export interface NpcStepResult {
  readonly state: NpcWorldState;
  /** Ships that appeared this step (their ids), and ships that left the map. */
  readonly spawned: readonly number[];
  readonly departed: readonly NpcShip[];
}

/** True when game time crossed a multiple of `interval` during the step. */
function crossed(before: number, after: number, interval: number): boolean {
  return Math.floor(after / interval) !== Math.floor(before / interval);
}

function dist(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const NONE: readonly never[] = Object.freeze([]);

/**
 * Advance every NPC by one fixed step (slice 2 spec §4.3–4.4): the AI decides 10 times per
 * second of game play, the shared `stepShip` moves every ship each step, ships leave when they
 * are far from the player or reach port, and every 2 game hours new ships fill the waters
 * around the player. Pure: the same state and inputs always give the same result.
 */
export function stepNpcWorld(
  state: NpcWorldState,
  ctx: NpcStepContext,
  dtSec: number,
): NpcStepResult {
  const { nav, wind, player, hoursAfter } = ctx;
  const aiTick = crossed(ctx.hoursBefore, hoursAfter, NPC_AI_TICK_HOURS);
  let rng: Rng | null = null;
  const worldRng = (): Rng => (rng ??= restoreRng(state.rngState));

  const npcs: NpcShip[] = [];
  let departed: NpcShip[] | null = null;
  for (const before of state.npcs) {
    let npc = before;
    if (aiTick) {
      const decision = decideSailing(npc, { wind, hours: hoursAfter, nav, rng: worldRng });
      if ('leave' in decision) {
        (departed ??= []).push(before);
        continue;
      }
      npc = decision.npc;
    }
    const cls = SHIP_CLASSES[npc.classId];
    const moved = stepShip(npc.ship, helmInput(npc), wind, nav.world, dtSec, {
      performance: performanceOf(cls, npc.condition),
      scale: WORLD_SAILING_SCALE,
    });
    npc = { ...npc, ship: moved.ship };
    if (dist(npc.ship, player) > NPC_DESPAWN_PX) {
      (departed ??= []).push(npc);
      continue;
    }
    npcs.push(npc);
  }

  let nextNpcId = state.nextNpcId;
  let spawned: number[] | null = null;
  if (crossed(ctx.hoursBefore, hoursAfter, NPC_SPAWN_CHECK_HOURS)) {
    let nearby = npcs.filter((n) => dist(n.ship, player) <= NPC_NEARBY_RADIUS_PX).length;
    let attempts = 2 * NPC_TARGET_NEARBY;
    const namesInUse = new Set(npcs.map((n) => n.name));
    while (nearby < NPC_TARGET_NEARBY && npcs.length < NPC_MAX && attempts-- > 0) {
      const npc = spawnNpc({
        nav,
        player,
        hours: hoursAfter,
        rng: worldRng(),
        id: nextNpcId,
        namesInUse,
      });
      if (!npc) continue;
      npcs.push(npc);
      namesInUse.add(npc.name);
      (spawned ??= []).push(npc.id);
      nextNpcId++;
      nearby++;
    }
  }

  return {
    state: { npcs, nextNpcId, rngState: rng ? (rng as Rng).state() : state.rngState },
    spawned: spawned ?? NONE,
    departed: departed ?? NONE,
  };
}
