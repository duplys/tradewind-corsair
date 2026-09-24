// SPDX-License-Identifier: GPL-3.0-only

/** Minimum and maximum integer pixel scale, and the CSS px per scale step (spec §8.1). */
const MIN_SCALE = 2;
const MAX_SCALE = 5;
const CSS_PX_PER_SCALE_STEP = 200;

export interface ViewSize {
  readonly scale: number;
  readonly width: number;
  readonly height: number;
}

export function computeViewSize(cssW: number, cssH: number): ViewSize {
  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.floor(Math.min(cssW, cssH) / CSS_PX_PER_SCALE_STEP)),
  );
  return { scale, width: Math.ceil(cssW / scale), height: Math.ceil(cssH / scale) };
}

/** The low-resolution view canvas, integer-scaled with nearest-neighbour filtering. */
export class View {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private currentScale = MIN_SCALE;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'view';
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context is not available');
    this.ctx = ctx;
  }

  get scale(): number {
    return this.currentScale;
  }

  resize(cssW: number, cssH: number): void {
    const size = computeViewSize(cssW, cssH);
    this.currentScale = size.scale;
    this.canvas.width = size.width;
    this.canvas.height = size.height;
    this.canvas.style.width = `${size.width * size.scale}px`;
    this.canvas.style.height = `${size.height * size.scale}px`;
    this.ctx.imageSmoothingEnabled = false;
  }
}
