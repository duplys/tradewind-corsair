// SPDX-License-Identifier: GPL-3.0-only
import { DEEP_SEA } from '../../render/palette';
import type { Mode } from './mode';

/** Title mode. Empty until the title screen milestone (slice 1 spec §9.2, M6). */
export class TitleMode implements Mode {
  readonly id = 'title';

  enter(): void {}

  exit(): void {}

  handleAction(): void {}

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = DEEP_SEA;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}
