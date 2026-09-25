// SPDX-License-Identifier: GPL-3.0-only
import { PORTS } from '../data/ports';
import { Input } from '../input/input';
import { KeyboardInput } from '../input/keyboard';
import { TouchControls, wantsTouchControls } from '../input/touch';
import { browserStorage, SaveStore } from '../persist/saveStore';
import { LabelLayer } from '../render/labels';
import { watchReducedMotion } from '../render/motion';
import type { SeaScene } from '../render/scene';
import { createShipSprites } from '../render/sprites/ship';
import { View } from '../render/view';
import { newVoyage } from '../sim/voyage';
import type { Port } from '../sim/world/ports';
import type { World } from '../sim/world/world';
import { ChartOverlay } from '../ui/chartOverlay';
import { DockPrompt } from '../ui/dockPrompt';
import { Hud } from '../ui/hud';
import { MessageLine } from '../ui/messageLine';
import { PortScreen } from '../ui/portScreen';
import { ShipwrightPanel } from '../ui/shipwrightPanel';
import { TitleScreen } from '../ui/titleScreen';
import { createLoop, type Loop } from './loop';
import { ModeMachine } from './modeMachine';
import { ChartMode } from './modes/chart';
import type { ModeId } from './modes/mode';
import { PortMode } from './modes/port';
import { SailingMode } from './modes/sailing';
import { TitleMode } from './modes/title';
import type { Session } from './session';

/** Owns the view, input, overlays, saving, the mode state machine and the game loop. */
export class Game {
  private readonly view = new View();
  private readonly labels = new LabelLayer();
  private readonly input = new Input();
  private readonly keyboard = new KeyboardInput(this.input);
  private readonly touch = wantsTouchControls() ? new TouchControls(this.input) : null;
  private readonly hud = new Hud(() => this.input.press('chart'));
  private readonly messages = new MessageLine();
  private readonly dockPrompt = new DockPrompt(() => this.input.press('confirm'));
  private readonly portScreen = new PortScreen(() => this.input.press('confirm'));
  private readonly shipwright = new ShipwrightPanel();
  private readonly titleScreen = new TitleScreen();
  private readonly chart: ChartOverlay;
  private readonly store: SaveStore;
  private readonly session: Session;
  private readonly modes: ModeMachine;
  private readonly loop: Loop;
  private readonly onResize = (): void => this.resize();
  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.autoSave();
  };

  constructor(world: World, map: HTMLCanvasElement, ports: readonly Port[]) {
    const reducedMotion = watchReducedMotion();
    const scene: SeaScene = {
      world,
      map,
      ports,
      sprites: createShipSprites(),
      view: this.view,
      labels: this.labels,
      reducedMotion,
    };
    this.chart = new ChartOverlay(world, map, ports, reducedMotion, () =>
      this.input.press('close'),
    );
    this.store = new SaveStore(browserStorage(), {
      world,
      portIds: new Set(PORTS.map((p) => p.id)),
      ...(import.meta.env.DEV ? { warn: (message: string) => console.warn(message) } : {}),
    });
    this.session = { voyage: newVoyage(world, ports) };
    const session = this.session;
    const switchMode = (id: ModeId): void => this.modes.switchTo(id);
    const save = (): void => this.autoSave();
    this.modes = new ModeMachine([
      new TitleMode({
        scene,
        session,
        titleScreen: this.titleScreen,
        store: this.store,
        touch: this.touch !== null,
        switchMode,
      }),
      new SailingMode({
        scene,
        session,
        held: this.input.held,
        hud: this.hud,
        messages: this.messages,
        dockPrompt: this.dockPrompt,
        touch: this.touch,
        switchMode,
        save,
      }),
      new PortMode({
        scene,
        session,
        portScreen: this.portScreen,
        shipwright: this.shipwright,
        switchMode,
        save,
      }),
      new ChartMode({ session, chart: this.chart, switchMode }),
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
    this.shipwright.attach(root);
    this.chart.attach(root);
    this.titleScreen.attach(root);
    this.resize();
    this.keyboard.attach();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  start(): void {
    this.modes.switchTo('title');
    this.loop.start();
  }

  /** Save the voyage, except on the title screen where no voyage is under way. */
  private autoSave(): void {
    if (this.modes.current && this.modes.current.id !== 'title') {
      this.store.save(this.session.voyage);
    }
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
    this.chart.relayout();
  }
}
