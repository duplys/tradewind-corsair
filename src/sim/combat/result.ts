// SPDX-License-Identifier: GPL-3.0-only
import {
  COMBAT_GAME_HOURS,
  ENEMY_ESCAPED_IGNORE_HOURS,
  INTERIM_DEFEAT_HULL_PCT,
  PLAYER_ESCAPE_SEPARATION_PX,
  PLAYER_ESCAPED_IGNORE_HOURS,
} from '../../data/combat';
import { breakContact, moveAlongHeading, updateNpc } from '../npc/encounter';
import type { Voyage } from '../voyage';
import type { World } from '../world/world';
import type { CombatState } from './state';

/**
 * Carry a finished fight back to the voyage (interim rules until the outcome screens in M7,
 * ADR 012): both ships keep their damage and the clock moves on 6 hours. A sunk or captured
 * enemy leaves the map; one that got away remembers the fight for 48 hours; if the player
 * slipped away they gain 25 px. Boarding fights and defeats are not resolved yet.
 */
export function applyCombatResult(
  voyage: Voyage,
  world: World,
  npcId: number,
  state: CombatState,
): Voyage {
  const outcome = state.outcome;
  const [player, enemy] = state.ships;
  const hours = voyage.elapsedHours + COMBAT_GAME_HOURS;
  let condition = player.condition;
  if (outcome?.type === 'sunk' && outcome.shipIndex === 0) {
    condition = { ...condition, hullPct: INTERIM_DEFEAT_HULL_PCT };
  }
  let next: Voyage = { ...voyage, condition, elapsedHours: hours };

  const enemyGone =
    (outcome?.type === 'sunk' && outcome.shipIndex === 1) || outcome?.type === 'captured';
  if (enemyGone) {
    return { ...next, npcs: next.npcs.filter((n) => n.id !== npcId) };
  }
  const ignoreHours =
    outcome?.type === 'escaped' && outcome.shipIndex === 1
      ? ENEMY_ESCAPED_IGNORE_HOURS
      : PLAYER_ESCAPED_IGNORE_HOURS;
  next = updateNpc(next, npcId, (npc) => ({
    ...breakContact(npc, hours + ignoreHours, hours),
    condition: enemy.condition,
  }));
  if (outcome?.type === 'escaped' && outcome.shipIndex === 0) {
    next = {
      ...next,
      ship: { ...next.ship, ...moveAlongHeading(world, next.ship, PLAYER_ESCAPE_SEPARATION_PX) },
    };
  }
  return next;
}
