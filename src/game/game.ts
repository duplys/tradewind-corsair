// SPDX-License-Identifier: GPL-3.0-only
import { KeyboardInput } from '../input/keyboard';
import { View } from '../render/view';
import type { World } from '../sim/world/world';
import { createLoop, type Loop } from './loop';
import { ModeMachine } from './modeMachine';
import { SailingMode } from './modes/sailing';
import { TitleMode } from './modes/title';

/** Owns the view, input, the mode state machine and the game loop. */
export class Game {
  private readonly view = new View();
  private readonly keyboard = new KeyboardInput();
  private readonly modes: ModeMachine;
  private readonly loop: Loop;
  private readonly onResize = (): void => this.resize();

  constructor(world: World, map: HTMLCanvasElement) {
    this.modes = new ModeMachine([
      new TitleMode(),
      new SailingMode({ world, map, held: this.keyboard.held }),
    ]);
    this.loop = createLoop({
      step: (dtSec) => this.step(dtSec),
      render: () => this.modes.render(this.view.ctx),
    });
  }

  attach(root: HTMLElement): void {
    root.append(this.view.canvas);
    this.resize();
    this.keyboard.attach();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
  }

  start(): void {
    this.modes.switchTo('sailing');
    this.loop.start();
  }

  private step(dtSec: number): void {
    for (let action = this.keyboard.poll(); action; action = this.keyboard.poll()) {
      this.modes.current?.handleAction(action);
    }
    this.modes.update(dtSec);
  }

  private resize(): void {
    this.view.resize(window.innerWidth, window.innerHeight);
  }
}
