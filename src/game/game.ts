// SPDX-License-Identifier: GPL-3.0-only
import { createLoop, type Loop } from './loop';
import { ModeMachine } from './modeMachine';
import { createMaskCanvas } from '../render/map/maskDebug';
import type { World } from '../sim/world/world';
import { TitleMode } from './modes/title';

/** Owns the view canvas, the mode state machine and the game loop. */
export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly modes: ModeMachine;
  private readonly loop: Loop;
  private readonly onResize = (): void => this.resize();

  constructor(world: World) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'view';
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context is not available');
    this.ctx = ctx;

    this.modes = new ModeMachine([new TitleMode(createMaskCanvas(world))]);
    this.loop = createLoop({
      step: (dtSec) => this.modes.update(dtSec),
      render: () => this.modes.render(this.ctx),
    });
  }

  attach(root: HTMLElement): void {
    root.append(this.canvas);
    this.resize();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
  }

  start(): void {
    this.modes.switchTo('title');
    this.loop.start();
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
  }
}
