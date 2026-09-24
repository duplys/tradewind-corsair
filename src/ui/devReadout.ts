// SPDX-License-Identifier: GPL-3.0-only
// Temporary developer readout (dev builds only) until the HUD arrives in M4. See ADR 003.

const UPDATE_INTERVAL_SEC = 0.1;
const MESSAGE_SEC = 3;

export class DevReadout {
  private readonly el = document.createElement('pre');
  private lastUpdateSec = -Infinity;
  private message = '';
  private messageUntilSec = -Infinity;

  constructor() {
    this.el.className = 'dev-readout';
  }

  attach(root: HTMLElement): void {
    root.append(this.el);
  }

  /** Show a message for 3 s; repeats of the showing message are ignored (rate limit). */
  flash(message: string, nowSec: number): void {
    if (message === this.message && nowSec < this.messageUntilSec) return;
    this.message = message;
    this.messageUntilSec = nowSec + MESSAGE_SEC;
    this.lastUpdateSec = -Infinity;
  }

  /** Update the text at most 10 times per second. */
  update(nowSec: number, lines: () => string): void {
    if (nowSec - this.lastUpdateSec < UPDATE_INTERVAL_SEC) return;
    this.lastUpdateSec = nowSec;
    const message = nowSec < this.messageUntilSec ? `\n\n${this.message}` : '';
    this.el.textContent = lines() + message;
  }
}
