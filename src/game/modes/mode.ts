// SPDX-License-Identifier: GPL-3.0-only

/** Every mode the game can be in. Grows with each slice (sailing, port, chart, ...). */
export type ModeId = 'title';

/** A mode owns its update, render and overlay lifecycle. A mode that does not step is paused. */
export interface Mode {
  readonly id: ModeId;
  enter(): void;
  exit(): void;
  update(dtSec: number): void;
  render(ctx: CanvasRenderingContext2D): void;
}
