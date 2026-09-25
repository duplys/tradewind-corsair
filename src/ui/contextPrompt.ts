// SPDX-License-Identifier: GPL-3.0-only

/**
 * The bottom-centre action button at sea: "Close with the Spanish fluyt" or "Drop anchor at
 * Port Royal" (slice 1 spec §4.2, slice 2 spec §5.3). Only one shows at a time.
 */
export class ContextPrompt {
  private readonly button = document.createElement('button');
  private key: string | null = null;

  constructor(onPress: () => void) {
    this.button.type = 'button';
    this.button.className = 'context-prompt';
    this.button.hidden = true;
    this.button.addEventListener('click', onPress);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.button);
  }

  /** Show `text`; `key` identifies what it is for, so the DOM changes only when that changes. */
  show(key: string, text: string): void {
    if (key === this.key) return;
    this.key = key;
    this.button.textContent = text;
    this.button.hidden = false;
  }

  hide(): void {
    if (this.key === null) return;
    this.key = null;
    this.button.hidden = true;
  }
}
