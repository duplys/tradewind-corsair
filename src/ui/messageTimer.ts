// SPDX-License-Identifier: GPL-3.0-only

export const MESSAGE_SEC = 3;

/** Which message is showing and until when. Repeats of the showing message are ignored. */
export class MessageTimer {
  private text = '';
  private untilSec = -Infinity;

  /** Returns true when the message is newly shown (and the display needs updating). */
  show(text: string, nowSec: number): boolean {
    if (text === this.text && nowSec < this.untilSec) return false;
    this.text = text;
    this.untilSec = nowSec + MESSAGE_SEC;
    return true;
  }

  isVisible(nowSec: number): boolean {
    return nowSec < this.untilSec;
  }

  get current(): string {
    return this.text;
  }
}
