// SPDX-License-Identifier: GPL-3.0-only
import {
  COMBAT_GAME_HOURS,
  DEFEAT_CREW,
  DEFEAT_DAYS,
  DEFEAT_GOLD_KEPT_SHARE,
  ENEMY_ESCAPED_IGNORE_HOURS,
  LET_GO_REPUTATION_REFUND,
  PLAYER_ESCAPE_SEPARATION_PX,
  PLAYER_ESCAPED_IGNORE_HOURS,
  PLUNDER_RANGE,
  PLUNDER_ROLE_FACTOR,
  RECRUIT_SHARE_RANGE,
} from '../../data/combat';
import { hostileToPlayer } from '../../data/relations';
import { SHIP_CLASSES } from '../../data/ships';
import { breakContact, moveAlongHeading, updateNpc } from '../npc/encounter';
import type { NpcShip } from '../npc/npc';
import { randRange } from '../random';
import type { Rng } from '../rng';
import { departFrom } from '../sailing/start';
import { fullCondition, type ShipCondition } from '../ships/condition';
import type { StatsNation, Voyage, VoyageStats } from '../voyage';
import type { Port } from '../world/ports';
import type { World } from '../world/world';
import { MeleeBoardingResolver, type BoardingResolver, type BoardingResult } from './boarding';
import type { CombatState } from './state';

/** How a fight ended for the player, once any boarding has been fought out (spec §8). */
export type Conclusion =
  | { readonly kind: 'prize'; readonly boarding: BoardingResult | null }
  | { readonly kind: 'defeat'; readonly boarding: BoardingResult | null }
  | { readonly kind: 'enemySunk' }
  | { readonly kind: 'enemyEscaped' }
  | { readonly kind: 'playerEscaped' };

/**
 * Settle a finished fight: a boarding is fought out with the melee resolver (spec §9; the
 * duel in slice 3 replaces it behind the same interface) using the fight's own RNG.
 */
export function concludeFight(
  state: CombatState,
  resolver: BoardingResolver = new MeleeBoardingResolver(),
): Conclusion {
  const outcome = state.outcome;
  if (!outcome) throw new Error('The fight has not ended');
  switch (outcome.type) {
    case 'sunk':
      return outcome.shipIndex === 1 ? { kind: 'enemySunk' } : { kind: 'defeat', boarding: null };
    case 'captured':
      return { kind: 'prize', boarding: null };
    case 'surrendered':
      return { kind: 'defeat', boarding: null };
    case 'escaped':
      return outcome.shipIndex === 1 ? { kind: 'enemyEscaped' } : { kind: 'playerEscaped' };
    case 'boarding': {
      const side = (index: 0 | 1) => {
        const ship = state.ships[index];
        return { crew: ship.condition.crew, startingCrew: ship.startCrew, isPlayer: index === 0 };
      };
      const defender = outcome.attacker === 0 ? 1 : 0;
      const boarding = resolver.resolve(side(outcome.attacker), side(defender), state.rng);
      const winner = boarding.winner === 'attacker' ? outcome.attacker : defender;
      return winner === 0 ? { kind: 'prize', boarding } : { kind: 'defeat', boarding };
    }
  }
}

/** The enemy crew left after the fight (and any boarding). */
export function survivingEnemyCrew(state: CombatState, boarding: BoardingResult | null): number {
  const last = boarding?.rounds.at(-1);
  if (!last) return state.ships[1].condition.crew;
  const outcome = state.outcome;
  const enemyAttacked = outcome?.type === 'boarding' && outcome.attacker === 1;
  return enemyAttacked ? last.attackerCrew : last.defenderCrew;
}

/** The player's crew left after the fight (and any boarding). */
export function survivingPlayerCrew(state: CombatState, boarding: BoardingResult | null): number {
  const last = boarding?.rounds.at(-1);
  if (!last) return state.ships[0].condition.crew;
  const outcome = state.outcome;
  const playerAttacked = outcome?.type === 'boarding' && outcome.attacker === 0;
  return playerAttacked ? last.attackerCrew : last.defenderCrew;
}

export interface Prize {
  readonly plunder: number;
  readonly recruits: number;
}

/**
 * What a captured ship yields (spec §8.1): plunder of cargoValue × rand(0.6, 1.4) × the role
 * factor, and recruits from her surviving crew (10–30 %), no more than the player has berths for.
 */
export function rollPrize(
  npc: NpcShip,
  enemyCrew: number,
  playerClassId: NpcShip['classId'],
  playerCrew: number,
  rng: Rng,
): Prize {
  const cls = SHIP_CLASSES[npc.classId];
  const plunder = Math.round(
    cls.cargoValue *
      randRange(rng, PLUNDER_RANGE[0], PLUNDER_RANGE[1]) *
      PLUNDER_ROLE_FACTOR[npc.role],
  );
  const willing = Math.floor(
    enemyCrew * randRange(rng, RECRUIT_SHARE_RANGE[0], RECRUIT_SHARE_RANGE[1]),
  );
  const berths = Math.max(0, SHIP_CLASSES[playerClassId].crewMax - playerCrew);
  return { plunder, recruits: Math.min(willing, berths) };
}

function record(stats: VoyageStats, nation: StatsNation, field: 'captured' | 'sunk'): VoyageStats {
  const entry = stats.byNation[nation];
  return {
    ...stats,
    [field]: stats[field] + 1,
    byNation: { ...stats.byNation, [nation]: { ...entry, [field]: entry[field] + 1 } },
  };
}

/** The world clock moves on 6 hours for every fight (spec §6.1), and the player's damage stays. */
function afterFight(voyage: Voyage, condition: ShipCondition): Voyage {
  return { ...voyage, condition, elapsedHours: voyage.elapsedHours + COMBAT_GAME_HOURS };
}

function removeNpc(voyage: Voyage, npcId: number): Voyage {
  return { ...voyage, npcs: voyage.npcs.filter((n) => n.id !== npcId) };
}

export type PrizeChoice = 'take' | 'sink' | 'letGo';

/**
 * Take the prize (spec §8.1): plunder and recruits come aboard, then the player takes her as
 * their ship, sinks her or lets her go. Either way she leaves the map and counts as captured.
 * Taking her swaps class and condition (hull, rigging, guns), with the crew capped at her
 * berths. Letting a ship of a friendly nation go gives back half a point of reputation.
 */
export function applyPrize(
  voyage: Voyage,
  state: CombatState,
  npc: NpcShip,
  prize: Prize,
  playerCrew: number,
  enemyCondition: ShipCondition,
  choice: PrizeChoice,
): Voyage {
  const crew = playerCrew + prize.recruits;
  let next = afterFight(voyage, { ...state.ships[0].condition, crew });
  next = {
    ...next,
    gold: next.gold + prize.plunder,
    stats: record(next.stats, npc.nation, 'captured'),
  };
  if (choice === 'take') {
    const cls = SHIP_CLASSES[npc.classId];
    next = {
      ...next,
      ship: { ...next.ship, classId: npc.classId },
      condition: { ...enemyCondition, crew: Math.min(crew, cls.crewMax) },
    };
  } else if (choice === 'letGo' && npc.nation !== 'pirate' && !hostileToPlayer(npc.nation)) {
    next = {
      ...next,
      reputation: {
        ...next.reputation,
        [npc.nation]: next.reputation[npc.nation] + LET_GO_REPUTATION_REFUND,
      },
    };
  }
  return removeNpc(next, npc.id);
}

/** She went down (spec §8.2): no plunder; recorded in the stats. */
export function applyEnemySunk(voyage: Voyage, state: CombatState, npc: NpcShip): Voyage {
  const next = afterFight(voyage, state.ships[0].condition);
  return removeNpc({ ...next, stats: record(next.stats, npc.nation, 'sunk') }, npc.id);
}

/** She got away (spec §8.2): back on the map with her damage, ignoring the player for 48 h. */
export function applyEnemyEscaped(voyage: Voyage, state: CombatState, npcId: number): Voyage {
  const next = afterFight(voyage, state.ships[0].condition);
  const hours = next.elapsedHours;
  return updateNpc(next, npcId, (npc) => ({
    ...breakContact(npc, hours + ENEMY_ESCAPED_IGNORE_HOURS, hours),
    condition: state.ships[1].condition,
  }));
}

/** The player slipped away (spec §8.4): 25 px on along their heading; she ignores them 24 h. */
export function applyPlayerEscaped(
  voyage: Voyage,
  world: World,
  state: CombatState,
  npcId: number,
): Voyage {
  let next = afterFight(voyage, state.ships[0].condition);
  const hours = next.elapsedHours;
  next = updateNpc(next, npcId, (npc) => ({
    ...breakContact(npc, hours + PLAYER_ESCAPED_IGNORE_HOURS, hours),
    condition: state.ships[1].condition,
  }));
  next = { ...next, stats: { ...next.stats, escapedFrom: next.stats.escapedFrom + 1 } };
  return {
    ...next,
    ship: { ...next.ship, ...moveAlongHeading(world, next.ship, PLAYER_ESCAPE_SEPARATION_PX) },
  };
}

/** The nearest port, by harbour, whose nation is not at war with England. */
export function nearestFriendlyPort(ports: readonly Port[], x: number, y: number): Port {
  let best: Port | null = null;
  let bestD = Infinity;
  for (const port of ports) {
    if (hostileToPlayer(port.def.nation)) continue;
    const d = Math.hypot(port.harbour.x - x, port.harbour.y - y);
    if (d < bestD) {
      bestD = d;
      best = port;
    }
  }
  if (!best) throw new Error('No friendly port');
  return best;
}

/**
 * Defeat (spec §8.3): half the gold is lost, and the player is put ashore at the nearest port
 * that is not hostile, in a sound sloop with the same name and 12 hands, 14 days later. The
 * enemy leaves the player alone for two days. Recorded in the stats.
 */
export function applyDefeat(
  voyage: Voyage,
  world: World,
  ports: readonly Port[],
  npcId: number,
): Voyage {
  const port = nearestFriendlyPort(ports, voyage.ship.x, voyage.ship.y);
  const sloop = SHIP_CLASSES.sloop;
  const hours = voyage.elapsedHours + COMBAT_GAME_HOURS + DEFEAT_DAYS * 24;
  const next: Voyage = {
    ...voyage,
    ship: departFrom(world, port.harbour, 'sloop'),
    condition: fullCondition(sloop, DEFEAT_CREW),
    gold: Math.floor(voyage.gold * DEFEAT_GOLD_KEPT_SHARE),
    elapsedHours: hours,
    lastPortId: port.def.id,
    dockedPortId: null,
    stats: { ...voyage.stats, defeats: voyage.stats.defeats + 1 },
  };
  return updateNpc(next, npcId, (npc) =>
    breakContact(npc, hours + ENEMY_ESCAPED_IGNORE_HOURS, hours),
  );
}
