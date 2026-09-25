// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../../data/strings';
import type { Action } from '../../input/actions';
import { windAt } from '../../sim/sailing/wind';
import { formatDate } from '../../sim/time';
import type { ChartOverlay } from '../../ui/chartOverlay';
import type { Session } from '../session';
import type { Mode, SwitchMode } from './mode';

export interface ChartDeps {
  readonly session: Session;
  readonly chart: ChartOverlay;
  readonly switchMode: SwitchMode;
}

/** The full-map chart (slice 1 spec §9.3). Game time is paused while it is open. */
export class ChartMode implements Mode {
  readonly id = 'chart';
  /** Decorative time only (the blinking ship marker). */
  private timeSec = 0;

  constructor(private readonly deps: ChartDeps) {}

  enter(): void {
    const { ship, elapsedHours, npcs } = this.deps.session.voyage;
    this.deps.chart.show(
      ship,
      windAt(ship.x, ship.y, elapsedHours),
      formatDate(elapsedHours, STRINGS.months),
      npcs,
    );
  }

  exit(): void {
    this.deps.chart.hide();
  }

  handleAction(action: Action): void {
    if (action === 'chart' || action === 'close') this.deps.switchMode('sailing');
  }

  update(dtSec: number): void {
    this.timeSec += dtSec;
  }

  render(): void {
    this.deps.chart.render(this.timeSec);
  }
}
