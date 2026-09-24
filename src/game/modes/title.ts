// SPDX-License-Identifier: GPL-3.0-only
import { DEEP_SEA } from '../../render/palette';
import type { Mode } from './mode';

/** Title mode. Empty in M0: it only clears the canvas to the deep sea colour. */
export class TitleMode implements Mode {
  readonly id = 'title';

  enter(): void {}

  exit(): void {}

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = DEEP_SEA;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}
