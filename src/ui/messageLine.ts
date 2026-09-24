// SPDX-License-Identifier: GPL-3.0-only
import { MessageTimer } from './messageTimer';

/** One message at a time, bottom-centre, shown for 3 s and then faded out (slice 1 spec §9.1). */
export class MessageLine {
  private readonly el = document.createElement('p');
  private readonly timer = new MessageTimer();
  private visible = false;

  constructor() {
    this.el.className = 'message-line';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
  }

  attach(parent: HTMLElement): void {
    parent.append(this.el);
  }

  show(text: string, nowSec: number): void {
    if (!this.timer.show(text, nowSec)) return;
    this.el.textContent = text;
    this.setVisible(true);
  }

  update(nowSec: number): void {
    if (this.visible && !this.timer.isVisible(nowSec)) this.setVisible(false);
  }

  hide(): void {
    this.setVisible(false);
  }

  private setVisible(visible: boolean): void {
    this.visible = visible;
    this.el.classList.toggle('is-visible', visible);
  }
}
