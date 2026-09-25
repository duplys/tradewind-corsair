// SPDX-License-Identifier: GPL-3.0-only
import type { Port } from '../sim/world/ports';
import type { CameraOffset } from './camera';
import { LABEL_FILL, LABEL_STROKE, NPC_LABEL_HOSTILE } from './palette';

/** A label under an NPC ship (slice 2 spec §4.5). Positions are world px. */
export interface NpcLabel {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly hostile: boolean;
  readonly alpha: number;
}

/** Labels sit this many world px above the town. */
const LABEL_OFFSET_PX = 7;
const STROKE_CSS_PX = 3;

/**
 * Port names drawn at native resolution on a canvas stacked above the pixel view (slice 1 spec
 * §8.3 step 6). Redrawn only when the camera or scale changes.
 */
export class LabelLayer {
  readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private lastCamX = NaN;
  private lastCamY = NaN;
  private lastScale = NaN;
  private hadNpcLabels = false;

  constructor() {
    this.canvas.className = 'labels';
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');
    this.ctx = ctx;
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.invalidate();
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.invalidate();
  }

  private invalidate(): void {
    this.lastCamX = this.lastCamY = this.lastScale = NaN;
  }

  /**
   * Port names above the towns, and names under nearby NPC ships. Only port labels are cached:
   * while NPC labels are showing (their ships move) the layer is redrawn every frame.
   */
  draw(
    cam: CameraOffset,
    scale: number,
    ports: readonly Port[],
    npcLabels: readonly NpcLabel[] = [],
  ): void {
    const hasNpcLabels = npcLabels.length > 0;
    const unchanged =
      cam.x === this.lastCamX && cam.y === this.lastCamY && scale === this.lastScale;
    if (unchanged && !hasNpcLabels && !this.hadNpcLabels) return;
    this.hadNpcLabels = hasNpcLabels;
    this.lastCamX = cam.x;
    this.lastCamY = cam.y;
    this.lastScale = scale;

    const { ctx, dpr } = this;
    const k = scale * dpr;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.font = `${(13 + 2 * scale) * dpr}px 'IM Fell English SC', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineJoin = 'round';
    ctx.lineWidth = STROKE_CSS_PX * dpr;
    ctx.strokeStyle = LABEL_STROKE;
    ctx.fillStyle = LABEL_FILL;
    const margin = 200 * dpr;
    for (const port of ports) {
      const x = (port.town.x - cam.x) * k;
      const y = (port.town.y - LABEL_OFFSET_PX - cam.y) * k;
      if (
        x < -margin ||
        y < 0 ||
        x > this.canvas.width + margin ||
        y > this.canvas.height + margin
      ) {
        continue;
      }
      ctx.strokeText(port.def.name, x, y);
      ctx.fillText(port.def.name, x, y);
    }

    ctx.font = `${(10 + 2 * scale) * dpr}px 'IM Fell English', Georgia, serif`;
    ctx.textBaseline = 'top';
    for (const label of npcLabels) {
      const x = (label.x - cam.x) * k;
      const y = (label.y - cam.y) * k;
      ctx.globalAlpha = label.alpha;
      ctx.strokeText(label.text, x, y);
      ctx.fillStyle = label.hostile ? NPC_LABEL_HOSTILE : LABEL_FILL;
      ctx.fillText(label.text, x, y);
    }
    ctx.globalAlpha = 1;
  }
}
