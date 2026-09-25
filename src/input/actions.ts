// SPDX-License-Identifier: GPL-3.0-only

/** Abstract player actions. Keys and touches map to these; the game never sees raw events. */
export type Action =
  | 'turnLeft'
  | 'turnRight'
  | 'hoist'
  | 'reef'
  | 'confirm'
  | 'chart'
  | 'close'
  /** Dev builds only (K): damage the player's ship, to test the HUD and repairs. */
  | 'debugDamage';

/** Actions that are held down (read each step). Every action is also queued once per press. */
export type HeldActions = Record<Action, boolean>;

export function createHeldActions(): HeldActions {
  return {
    turnLeft: false,
    turnRight: false,
    hoist: false,
    reef: false,
    confirm: false,
    chart: false,
    close: false,
    debugDamage: false,
  };
}
