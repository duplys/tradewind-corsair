// SPDX-License-Identifier: GPL-3.0-only
// Shared helpers for combat tests (not a test file itself).
import { SIM_STEP_SECONDS } from '../../../src/data/constants';
import { SHIP_CLASSES, type ShipClassId } from '../../../src/data/ships';
import { createCombat, type CombatantSetup, type CombatState } from '../../../src/sim/combat/state';
import { HOLD, stepCombat, type CombatEvent, type CombatInput } from '../../../src/sim/combat/step';
import { createRng } from '../../../src/sim/rng';
import type { Wind } from '../../../src/sim/sailing/wind';
import { fullCondition } from '../../../src/sim/ships/condition';

/** Blowing toward the south: east–west courses are beam reaches. */
export const NORTHERLY: Wind = { towardRad: Math.PI / 2, speedKn: 14 };

export function side(
  classId: ShipClassId,
  overrides: Partial<CombatantSetup> = {},
): CombatantSetup {
  const cls = SHIP_CLASSES[classId];
  return {
    classId,
    role: 'player',
    condition: fullCondition(cls, cls.crewTypical),
    headingRad: 0,
    speedKn: 0,
    sail: 'furled',
    ...overrides,
  };
}

/**
 * A fight with both ships stopped and furled, heading east, the enemy `gapPx` due south of
 * the player (so the enemy lies on the player's starboard beam).
 */
export function beamFight(
  player: ShipClassId = 'sloop',
  enemy: ShipClassId = 'sloop',
  seed = 1,
  enemyOverrides: Partial<CombatantSetup> = {},
): CombatState {
  return createCombat({
    player: side(player),
    enemy: side(enemy, { role: 'warship', ...enemyOverrides }),
    wind: NORTHERLY,
    rng: createRng(seed),
    bearingToEnemyRad: Math.PI / 2,
    escapeFailed: false,
  });
}

/** Step until `seconds` pass or the fight ends; collect every event. */
export function run(
  state: CombatState,
  seconds: number,
  player: (t: number) => CombatInput = () => HOLD,
  enemy: (t: number) => CombatInput = () => HOLD,
): CombatEvent[] {
  const events: CombatEvent[] = [];
  for (let i = 0; i < seconds * 60 && !state.outcome; i++) {
    events.push(
      ...stepCombat(state, player(state.timeSec), enemy(state.timeSec), SIM_STEP_SECONDS),
    );
  }
  return events;
}

/** Fire the given side once, at the very start. */
export function fireOnce(sideName: 'port' | 'starboard' | 'bearing'): (t: number) => CombatInput {
  let done = false;
  return () => {
    if (done) return HOLD;
    done = true;
    return { ...HOLD, fire: sideName };
  };
}
