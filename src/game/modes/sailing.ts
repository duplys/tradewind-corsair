// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../../data/strings';
import { AUTOSAVE_INTERVAL_SEC } from '../../data/voyage';
import type { Action, HeldActions } from '../../input/actions';
import type { TouchControls } from '../../input/touch';
import { Wake } from '../../render/effects/wake';
import { drawSeaScene, type SeaScene } from '../../render/scene';
import { DEV_DAMAGE_STEP } from '../../data/condition';
import { WORLD_SAILING_SCALE } from '../../data/sailing';
import { SHIP_CLASSES } from '../../data/ships';
import { changeSail, stepShip, type StepParams } from '../../sim/sailing/ship';
import { damageCondition, performanceOf, type ShipCondition } from '../../sim/ships/condition';
import { windAt, type Wind } from '../../sim/sailing/wind';
import { advanceClock } from '../../sim/time';
import { dockAt } from '../../sim/voyage';
import { nearPort, type Port } from '../../sim/world/ports';
import type { DockPrompt } from '../../ui/dockPrompt';
import type { Hud } from '../../ui/hud';
import type { MessageLine } from '../../ui/messageLine';
import { hintDue } from '../hints';
import type { Session } from '../session';
import type { Mode, ModeId, SwitchMode } from './mode';

export interface SailingDeps {
  readonly scene: SeaScene;
  readonly session: Session;
  readonly held: Readonly<HeldActions>;
  readonly hud: Hud;
  readonly messages: MessageLine;
  readonly dockPrompt: DockPrompt;
  readonly touch: TouchControls | null;
  readonly switchMode: SwitchMode;
  /** Write the current voyage to the save slot. */
  readonly save: () => void;
}

export class SailingMode implements Mode {
  readonly id = 'sailing';
  private wind: Wind;
  /** Physics parameters for the player's ship, recomputed only when its condition changes. */
  private stepParams: StepParams | null = null;
  private stepParamsFor: ShipCondition | null = null;
  private near: Port | null = null;
  /** Real seconds spent sailing; drives effects only. */
  private timeSec = 0;
  private readonly wake = new Wake();
  private sinceSaveSec = 0;
  private sinceHintSec = 0;

  constructor(private readonly deps: SailingDeps) {
    const { ship, elapsedHours } = deps.session.voyage;
    this.wind = windAt(ship.x, ship.y, elapsedHours);
  }

  enter(from: ModeId | null): void {
    // The chart only pauses the voyage; anything else means the ship was placed afresh.
    if (from !== 'chart') this.wake.clear();
    if (from === 'title') {
      this.sinceSaveSec = 0;
      this.sinceHintSec = 0;
    }
    const { ship, elapsedHours } = this.deps.session.voyage;
    this.wind = windAt(ship.x, ship.y, elapsedHours);
    this.updateNearPort();
    this.deps.hud.show();
    this.deps.touch?.show();
  }

  exit(): void {
    this.deps.hud.hide();
    this.deps.touch?.hide();
    this.deps.messages.hide();
    this.deps.dockPrompt.setPort(null);
  }

  handleAction(action: Action): void {
    const { session } = this.deps;
    const ship = session.voyage.ship;
    if (action === 'hoist') {
      session.voyage = { ...session.voyage, ship: { ...ship, sail: changeSail(ship.sail, 1) } };
    } else if (action === 'reef') {
      session.voyage = { ...session.voyage, ship: { ...ship, sail: changeSail(ship.sail, -1) } };
    } else if (action === 'confirm' && this.near) {
      session.voyage = dockAt(session.voyage, this.near);
      this.deps.save();
      this.deps.switchMode('port');
    } else if (action === 'debugDamage' && import.meta.env.DEV) {
      session.voyage = {
        ...session.voyage,
        condition: damageCondition(session.voyage.condition, DEV_DAMAGE_STEP),
      };
    } else if (action === 'chart') {
      this.deps.switchMode('chart');
    }
  }

  update(dtSec: number): void {
    const { held, scene, messages, session } = this.deps;
    const voyage = session.voyage;
    const wind = windAt(voyage.ship.x, voyage.ship.y, voyage.elapsedHours);
    this.wind = wind;
    // A damaged or short-handed ship is slower on the world map too (slice 2 spec §3.2).
    const result = stepShip(
      voyage.ship,
      held,
      wind,
      scene.world,
      dtSec,
      this.params(voyage.condition),
    );
    for (const event of result.events) {
      if (event.type === 'shoal') messages.show(STRINGS.shoal, this.timeSec);
    }
    session.voyage = {
      ...voyage,
      ship: result.ship,
      elapsedHours: advanceClock(voyage.elapsedHours, dtSec),
    };
    this.timeSec += dtSec;
    this.wake.update(this.timeSec, dtSec, result.ship);
    this.updateNearPort();
    this.updateHints(dtSec);

    this.sinceSaveSec += dtSec;
    if (this.sinceSaveSec >= AUTOSAVE_INTERVAL_SEC) {
      this.sinceSaveSec = 0;
      this.deps.save();
    }
  }

  render(): void {
    drawSeaScene(
      this.deps.scene,
      this.deps.session.voyage.ship,
      this.timeSec,
      this.wind.towardRad,
      this.wake,
    );
    this.deps.hud.update(this.deps.session.voyage, this.wind, this.timeSec);
    this.deps.messages.update(this.timeSec);
  }

  private params(condition: ShipCondition): StepParams {
    if (!this.stepParams || condition !== this.stepParamsFor) {
      const cls = SHIP_CLASSES[this.deps.session.voyage.ship.classId];
      this.stepParams = { performance: performanceOf(cls, condition), scale: WORLD_SAILING_SCALE };
      this.stepParamsFor = condition;
    }
    return this.stepParams;
  }

  /** First-voyage hints, shown once per save (spec §9.6). */
  private updateHints(dtSec: number): void {
    const { session, messages } = this.deps;
    const shown = session.voyage.hintsShown;
    if (shown >= STRINGS.hints.length) return;
    this.sinceHintSec += dtSec;
    if (!hintDue(shown, this.sinceHintSec, STRINGS.hints.length)) return;
    messages.show(STRINGS.hints[shown]!, this.timeSec);
    session.voyage = { ...session.voyage, hintsShown: shown + 1 };
    this.sinceHintSec = 0;
  }

  private updateNearPort(): void {
    const { ship } = this.deps.session.voyage;
    this.near = nearPort(this.deps.scene.ports, ship.x, ship.y);
    this.deps.dockPrompt.setPort(this.near);
  }
}
