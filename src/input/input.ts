// SPDX-License-Identifier: GPL-3.0-only
import { createHeldActions, type Action, type HeldActions } from './actions';

export type InputSource = 'keyboard' | 'touch';

/**
 * Shared input state: each source (keyboard, touch) writes its own held actions and queues
 * one-shot presses. The game reads the merged `held` record, refreshed once per step.
 */
export class Input {
  /** Held actions merged across sources. Reused; never reallocated. */
  readonly held: HeldActions = createHeldActions();
  private readonly sources: Record<InputSource, HeldActions> = {
    keyboard: createHeldActions(),
    touch: createHeldActions(),
  };
  private readonly queue: Action[] = [];

  source(name: InputSource): HeldActions {
    return this.sources[name];
  }

  press(action: Action): void {
    this.queue.push(action);
  }

  /** Merge the sources into `held`. Call once per simulation step. */
  refresh(): void {
    const { keyboard, touch } = this.sources;
    for (const key of Object.keys(this.held) as Action[]) {
      this.held[key] = keyboard[key] || touch[key];
    }
  }

  /** Next queued one-shot action, or undefined when the queue is empty. */
  poll(): Action | undefined {
    return this.queue.shift();
  }

  clearSource(name: InputSource): void {
    const held = this.sources[name];
    for (const key of Object.keys(held) as Action[]) held[key] = false;
  }

  clearQueue(): void {
    this.queue.length = 0;
  }
}
