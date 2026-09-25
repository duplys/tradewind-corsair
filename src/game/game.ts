// SPDX-License-Identifier: GPL-3.0-only
import { PORTS } from '../data/ports';
import { Input } from '../input/input';
import { KeyboardInput } from '../input/keyboard';
import { TouchControls, wantsTouchControls } from '../input/touch';
import { browserStorage, SaveStore } from '../persist/saveStore';
import { LabelLayer } from '../render/labels';
import { watchReducedMotion } from '../render/motion';
import type { SeaScene } from '../render/scene';
import { ShipSpriteCache } from '../render/sprites/ship';
import { View } from '../render/view';
import { newVoyage } from '../sim/voyage';
import type { Navigator } from '../sim/npc/navigator';
import type { Port } from '../sim/world/ports';
import type { World } from '../sim/world/world';
import { ChartOverlay } from '../ui/chartOverlay';
import { CombatPlaceholder } from '../ui/combatPlaceholder';
import { ContextPrompt } from '../ui/contextPrompt';
import { EncounterDialog } from '../ui/encounterDialog';
import { Hud } from '../ui/hud';
import { MessageLine } from '../ui/messageLine';
import { PortScreen } from '../ui/portScreen';
import { ShipwrightPanel } from '../ui/shipwrightPanel';
import { TitleScreen } from '../ui/titleScreen';
import { createLoop, type Loop } from './loop';
import { ModeMachine } from './modeMachine';
import { ChartMode } from './modes/chart';
import { CombatMode } from './modes/combat';
import { EncounterMode } from './modes/encounter';
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
  private readonly prompt = new ContextPrompt(() => this.input.press('confirm'));
  private readonly encounterDialog = new EncounterDialog();
  private readonly combatPlaceholder = new CombatPlaceholder();
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

  constructor(world: World, map: HTMLCanvasElement, ports: readonly Port[], nav: Navigator) {
    const reducedMotion = watchReducedMotion();
    const scene: SeaScene = {
      world,
      map,
      ports,
      sprites: new ShipSpriteCache(),
      view: this.view,
      labels: this.labels,
      reducedMotion,
      npcLabels: [],
    };
    this.chart = new ChartOverlay(world, map, ports, reducedMotion, () =>
      this.input.press('close'),
    );
    this.store = new SaveStore(browserStorage(), {
      world,
      portIds: new Set(PORTS.map((p) => p.id)),
      ...(import.meta.env.DEV ? { warn: (message: string) => console.warn(message) } : {}),
    });
    this.session = { voyage: newVoyage(world, ports), encounter: null, notice: null };
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
        nav,
        held: this.input.held,
        hud: this.hud,
        messages: this.messages,
        prompt: this.prompt,
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
      new EncounterMode({ scene, session, dialog: this.encounterDialog, switchMode, save }),
      new CombatMode({ session, placeholder: this.combatPlaceholder, switchMode }),
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
    this.prompt.attach(root);
    this.touch?.attach(root);
    this.portScreen.attach(root);
    this.shipwright.attach(root);
    this.chart.attach(root);
    this.encounterDialog.attach(root);
    this.combatPlaceholder.attach(root);
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

  /**
   * Save the voyage, except on the title screen (no voyage under way) and during combat (the
   * save from just before the encounter must stand, slice 2 spec §11).
   */
  private autoSave(): void {
    const mode = this.modes.current?.id;
    if (mode && mode !== 'title' && mode !== 'combat') {
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
