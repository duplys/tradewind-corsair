// SPDX-License-Identifier: GPL-3.0-only
import type { Action } from '../../input/actions';

/** Every mode the game can be in. Grows with each slice (port, chart, ...). */
export type ModeId = 'title' | 'sailing';

/** A mode owns its update, render and overlay lifecycle. A mode that does not step is paused. */
export interface Mode {
  readonly id: ModeId;
  enter(): void;
  exit(): void;
  /** A one-shot action from the input queue, delivered before the next update. */
  handleAction(action: Action): void;
  update(dtSec: number): void;
  render(ctx: CanvasRenderingContext2D): void;
}
