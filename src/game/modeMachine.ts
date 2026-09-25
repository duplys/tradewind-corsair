// SPDX-License-Identifier: GPL-3.0-only
import type { Mode, ModeId } from './modes/mode';

/** A small explicit state machine over the registered modes. */
export class ModeMachine {
  private readonly modes: ReadonlyMap<ModeId, Mode>;
  private currentMode: Mode | null = null;

  constructor(modes: readonly Mode[]) {
    this.modes = new Map(modes.map((mode) => [mode.id, mode]));
  }

  get current(): Mode | null {
    return this.currentMode;
  }

  switchTo(id: ModeId): void {
    const next = this.modes.get(id);
    if (!next) throw new Error(`Unknown mode: ${id}`);
    if (next === this.currentMode) return;
    const from = this.currentMode;
    from?.exit();
    this.currentMode = next;
    next.enter(from?.id ?? null);
  }

  update(dtSec: number): void {
    this.currentMode?.update(dtSec);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.currentMode?.render(ctx);
  }
}
