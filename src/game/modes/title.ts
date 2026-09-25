// SPDX-License-Identifier: GPL-3.0-only
import type { SaveStore } from '../../persist/saveStore';
import { drawSeaScene, type SeaScene } from '../../render/scene';
import type { PlayerShip } from '../../sim/sailing/ship';
import { windAt } from '../../sim/sailing/wind';
import { START_ELAPSED_HOURS } from '../../sim/time';
import { newVoyage, type Voyage } from '../../sim/voyage';
import type { TitleScreen } from '../../ui/titleScreen';
import type { Session } from '../session';
import type { Mode, SwitchMode } from './mode';

export interface TitleDeps {
  readonly scene: SeaScene;
  readonly session: Session;
  readonly titleScreen: TitleScreen;
  readonly store: SaveStore;
  readonly touch: boolean;
  readonly switchMode: SwitchMode;
}

/**
 * Title screen (slice 1 spec §9.2): the live map around the start port with the ship idle,
 * under a card offering Continue voyage (when a valid save exists) and New voyage.
 */
export class TitleMode implements Mode {
  readonly id = 'title';
  private readonly previewShip: PlayerShip;
  private saved: Voyage | null = null;
  /** Decorative time only (waving flags). */
  private timeSec = 0;

  constructor(private readonly deps: TitleDeps) {
    this.previewShip = newVoyage(deps.scene.world, deps.scene.ports).ship;
  }

  enter(): void {
    this.saved = this.deps.store.load();
    this.deps.titleScreen.show({
      canContinue: this.saved !== null,
      touch: this.deps.touch,
      onContinue: () => this.continueVoyage(),
      onNew: () => this.startNewVoyage(),
    });
  }

  exit(): void {
    this.deps.titleScreen.hide();
  }

  handleAction(): void {}

  update(dtSec: number): void {
    this.timeSec += dtSec;
  }

  render(): void {
    const ship = this.previewShip;
    drawSeaScene(
      this.deps.scene,
      ship,
      this.timeSec,
      windAt(ship.x, ship.y, START_ELAPSED_HOURS).towardRad,
      null,
    );
  }

  private continueVoyage(): void {
    if (!this.saved) return;
    this.deps.session.voyage = this.saved;
    this.deps.switchMode('sailing');
  }

  private startNewVoyage(): void {
    this.deps.session.voyage = newVoyage(this.deps.scene.world, this.deps.scene.ports);
    this.deps.switchMode('sailing');
  }
}
