// SPDX-License-Identifier: GPL-3.0-only
import type { Action } from '../../input/actions';

/** Every mode the game can be in. Grows with each slice (combat, duel, ...). */
export type ModeId = 'title' | 'sailing' | 'port' | 'chart';

/** A mode owns its update, render and overlay lifecycle. A mode that does not step is paused. */
export interface Mode {
  readonly id: ModeId;
  /** `from` is the mode being left, or null at boot. */
  enter(from: ModeId | null): void;
  exit(): void;
  /** A one-shot action from the input queue, delivered before the next update. */
  handleAction(action: Action): void;
  update(dtSec: number): void;
  render(ctx: CanvasRenderingContext2D): void;
}

/** Lets a mode ask the game to switch to another mode. */
export type SwitchMode = (id: ModeId) => void;
