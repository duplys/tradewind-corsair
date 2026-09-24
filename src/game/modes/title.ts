// SPDX-License-Identifier: GPL-3.0-only
import { DEEP_SEA } from '../../render/palette';
import type { Mode } from './mode';

/** Title mode. For M1 it shows the land mask debug view, fitted to the screen. */
export class TitleMode implements Mode {
  readonly id = 'title';

  constructor(private readonly maskCanvas: HTMLCanvasElement) {}

  enter(): void {}

  exit(): void {}

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const { width, height } = ctx.canvas;
    ctx.fillStyle = DEEP_SEA;
    ctx.fillRect(0, 0, width, height);
    const scale = Math.min(width / this.maskCanvas.width, height / this.maskCanvas.height);
    const w = this.maskCanvas.width * scale;
    const h = this.maskCanvas.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.maskCanvas, (width - w) / 2, (height - h) / 2, w, h);
  }
}
