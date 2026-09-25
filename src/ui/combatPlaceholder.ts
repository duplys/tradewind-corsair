// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import { button, el } from './dom';

/** Stands in for the combat screen until slice 2 M4 (ADR 011). */
export class CombatPlaceholder {
  private readonly root = el('div', 'encounter-screen');
  private readonly card = el('div', 'parchment-card encounter-card');
  private readonly heading = el('h2', 'encounter-heading');
  private readonly breakOff = button('parchment-button', STRINGS.combat.breakOff);
  private onBreakOff: (() => void) | null = null;

  constructor() {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.heading.id = 'combat-placeholder-heading';
    this.root.setAttribute('aria-labelledby', this.heading.id);
    this.card.tabIndex = -1;
    this.breakOff.addEventListener('click', () => this.onBreakOff?.());
    const actions = el('div', 'encounter-actions');
    actions.append(this.breakOff);
    this.card.append(
      this.heading,
      el('p', 'encounter-relation', STRINGS.combat.placeholderText),
      actions,
    );
    this.root.append(this.card);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  show(heading: string, onBreakOff: () => void): void {
    this.onBreakOff = onBreakOff;
    this.heading.textContent = heading;
    this.root.hidden = false;
    this.card.focus();
  }

  hide(): void {
    this.root.hidden = true;
    this.onBreakOff = null;
  }
}
