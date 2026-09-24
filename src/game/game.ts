// SPDX-License-Identifier: GPL-3.0-only
import { Input } from '../input/input';
import { KeyboardInput } from '../input/keyboard';
import { TouchControls, wantsTouchControls } from '../input/touch';
import { LabelLayer } from '../render/labels';
import type { SeaScene } from '../render/scene';
import { createShipSprites } from '../render/sprites/ship';
import { View } from '../render/view';
import { newVoyage } from '../sim/voyage';
import type { Port } from '../sim/world/ports';
import type { World } from '../sim/world/world';
import { DockPrompt } from '../ui/dockPrompt';
import { Hud } from '../ui/hud';
import { MessageLine } from '../ui/messageLine';
import { PortScreen } from '../ui/portScreen';
import { createLoop, type Loop } from './loop';
import { ModeMachine } from './modeMachine';
import { PortMode } from './modes/port';
import { SailingMode } from './modes/sailing';
import { TitleMode } from './modes/title';
import type { Session } from './session';

/** Owns the view, input, overlays, the mode state machine and the game loop. */
export class Game {
  private readonly view = new View();
  private readonly labels = new LabelLayer();
  private readonly input = new Input();
  private readonly keyboard = new KeyboardInput(this.input);
  private readonly touch = wantsTouchControls() ? new TouchControls(this.input) : null;
  private readonly hud = new Hud();
  private readonly messages = new MessageLine();
  private readonly dockPrompt = new DockPrompt(() => this.input.press('confirm'));
  private readonly portScreen = new PortScreen(() => this.input.press('confirm'));
  private readonly modes: ModeMachine;
  private readonly loop: Loop;
  private readonly onResize = (): void => this.resize();

  constructor(world: World, map: HTMLCanvasElement, ports: readonly Port[]) {
    const scene: SeaScene = {
      world,
      map,
      ports,
      sprites: createShipSprites(),
      view: this.view,
      labels: this.labels,
    };
    const session: Session = { voyage: newVoyage(world, ports) };
    const switchMode = (id: Parameters<ModeMachine['switchTo']>[0]): void => {
      this.modes.switchTo(id);
    };
    this.modes = new ModeMachine([
      new TitleMode(),
      new SailingMode({
        scene,
        session,
        held: this.input.held,
        hud: this.hud,
        messages: this.messages,
        dockPrompt: this.dockPrompt,
        touch: this.touch,
        switchMode,
      }),
      new PortMode({ scene, session, portScreen: this.portScreen, switchMode }),
    ]);
    this.loop = createLoop({
      step: (dtSec) => this.step(dtSec),
      render: () => this.modes.render(this.view.ctx),
    });
  }

  attach(root: HTMLElement): void {
    root.classList.toggle('has-touch', this.touch !== null);
    root.append(this.view.canvas, this.labels.canvas);
    this.hud.attach(root);
    this.messages.attach(root);
    this.dockPrompt.attach(root);
    this.touch?.attach(root);
    this.portScreen.attach(root);
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
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.view.resize(w, h);
    this.labels.resize(w, h, window.devicePixelRatio || 1);
  }
}
