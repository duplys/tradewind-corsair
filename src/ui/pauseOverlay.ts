// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import { button, el } from './dom';

/** The pause overlay in combat (spec §6.1): Resume, and Surrender when it is allowed. */
export class PauseOverlay {
  private readonly root = el('div', 'encounter-screen');
  private readonly card = el('div', 'parchment-card encounter-card');
  private readonly resume = button('parchment-button', STRINGS.combat.resume);
  private readonly surrender = button('parchment-button', STRINGS.combat.surrender);
  private handlers: { onResume: () => void; onSurrender: () => void } | null = null;

  constructor() {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    const heading = el('h2', 'encounter-heading', STRINGS.combat.paused);
    heading.id = 'pause-heading';
    this.root.setAttribute('aria-labelledby', heading.id);
    this.card.tabIndex = -1;
    this.resume.addEventListener('click', () => this.handlers?.onResume());
    this.surrender.addEventListener('click', () => this.handlers?.onSurrender());
    const actions = el('div', 'encounter-actions');
    actions.append(this.resume, this.surrender);
    this.card.append(heading, actions);
    this.root.append(this.card);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** `canSurrender` is false against a trader (spec §6.6). */
  show(canSurrender: boolean, handlers: { onResume: () => void; onSurrender: () => void }): void {
    this.handlers = handlers;
    this.surrender.hidden = !canSurrender;
    this.root.hidden = false;
    this.card.focus();
  }

  hide(): void {
    this.root.hidden = true;
    this.handlers = null;
  }
}
