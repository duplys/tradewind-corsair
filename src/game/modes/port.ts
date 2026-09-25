// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../../data/strings';
import type { Action } from '../../input/actions';
import { drawSeaScene, type SeaScene } from '../../render/scene';
import { formatDate } from '../../sim/time';
import { setSailFrom } from '../../sim/voyage';
import { findPort, type Port } from '../../sim/world/ports';
import type { PortScreen } from '../../ui/portScreen';
import type { Session } from '../session';
import type { Mode, SwitchMode } from './mode';

export interface PortDeps {
  readonly scene: SeaScene;
  readonly session: Session;
  readonly portScreen: PortScreen;
  readonly switchMode: SwitchMode;
  /** Write the current voyage to the save slot. */
  readonly save: () => void;
}

/** At anchor (slice 1 spec §4.2). Game time is paused; the port screen covers the map. */
export class PortMode implements Mode {
  readonly id = 'port';
  private port: Port | null = null;
  /** Decorative time only (waving flags); the game clock does not advance in port. */
  private timeSec = 0;

  constructor(private readonly deps: PortDeps) {}

  enter(): void {
    const { session, scene, portScreen } = this.deps;
    const id = session.voyage.dockedPortId;
    if (id === null) throw new Error('Entered port mode without a docked port');
    this.port = findPort(scene.ports, id);
    portScreen.show(this.port, formatDate(session.voyage.elapsedHours, STRINGS.months));
  }

  exit(): void {
    this.deps.portScreen.hide();
    this.port = null;
  }

  handleAction(action: Action): void {
    if (action === 'confirm') this.setSail();
  }

  update(dtSec: number): void {
    this.timeSec += dtSec;
  }

  render(): void {
    drawSeaScene(this.deps.scene, this.deps.session.voyage.ship, this.timeSec, null);
  }

  private setSail(): void {
    if (!this.port) return;
    const { session, scene } = this.deps;
    session.voyage = setSailFrom(session.voyage, scene.world, this.port);
    this.deps.save();
    this.deps.switchMode('sailing');
  }
}
