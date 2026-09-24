// SPDX-License-Identifier: GPL-3.0-only
import { Input } from '../input/input';
import { KeyboardInput } from '../input/keyboard';
import { TouchControls, wantsTouchControls } from '../input/touch';
import { createShipSprites } from '../render/sprites/ship';
import { View } from '../render/view';
import type { World } from '../sim/world/world';
import { Hud } from '../ui/hud';
import { MessageLine } from '../ui/messageLine';
import { createLoop, type Loop } from './loop';
import { ModeMachine } from './modeMachine';
import { SailingMode } from './modes/sailing';
import { TitleMode } from './modes/title';

/** Owns the view, input, overlays, the mode state machine and the game loop. */
export class Game {
  private readonly view = new View();
  private readonly input = new Input();
  private readonly keyboard = new KeyboardInput(this.input);
  private readonly touch = wantsTouchControls() ? new TouchControls(this.input) : null;
  private readonly hud = new Hud();
  private readonly messages = new MessageLine();
  private readonly modes: ModeMachine;
  private readonly loop: Loop;
  private readonly onResize = (): void => this.resize();

  constructor(world: World, map: HTMLCanvasElement) {
    this.modes = new ModeMachine([
      new TitleMode(),
      new SailingMode({
        world,
        map,
        sprites: createShipSprites(),
        held: this.input.held,
        hud: this.hud,
        messages: this.messages,
        touch: this.touch,
      }),
    ]);
    this.loop = createLoop({
      step: (dtSec) => this.step(dtSec),
      render: () => this.modes.render(this.view.ctx),
    });
  }

  attach(root: HTMLElement): void {
    root.classList.toggle('has-touch', this.touch !== null);
    root.append(this.view.canvas);
    this.hud.attach(root);
    this.messages.attach(root);
    this.touch?.attach(root);
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
    this.input.refresh();
    for (let action = this.input.poll(); action; action = this.input.poll()) {
      this.modes.current?.handleAction(action);
    }
    this.modes.update(dtSec);
  }

  private resize(): void {
    this.view.resize(window.innerWidth, window.innerHeight);
  }
}
