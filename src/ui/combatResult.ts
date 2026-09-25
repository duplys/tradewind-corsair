// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import { button, el } from './dom';

/** How a fight ended, and a way back to sea (interim until the outcome screens, M7). */
export class CombatResultCard {
  private readonly root = el('div', 'encounter-screen');
  private readonly card = el('div', 'parchment-card encounter-card');
  private readonly heading = el('h2', 'encounter-heading');
  private readonly note = el('p', 'encounter-relation');
  private readonly done = button('parchment-button', STRINGS.combat.continue);
  private onDone: (() => void) | null = null;

  constructor() {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.heading.id = 'combat-result-heading';
    this.root.setAttribute('aria-labelledby', this.heading.id);
    this.card.tabIndex = -1;
    this.done.addEventListener('click', () => this.onDone?.());
    const actions = el('div', 'encounter-actions');
    actions.append(this.done);
    this.card.append(this.heading, this.note, actions);
    this.root.append(this.card);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  show(heading: string, note: string, onDone: () => void): void {
    this.onDone = onDone;
    this.heading.textContent = heading;
    this.note.textContent = note;
    this.note.hidden = note === '';
    this.root.hidden = false;
    this.card.focus();
  }

  hide(): void {
    this.root.hidden = true;
    this.onDone = null;
  }
}
