// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import type { PrizeChoice } from '../sim/combat/outcome';
import { button, el } from './dom';

export interface PrizeView {
  readonly shipName: string;
  readonly plunderLine: string;
  readonly recruitsLine: string;
  /** "Frigate: 28 guns, 8 kn (your sloop 9 kn). Slower upwind than your sloop. …" */
  readonly comparison: string;
}

/** The prize screen (spec §8.1): what she yields, and take her, sink her or let her go. */
export class PrizeScreen {
  private readonly root = el('div', 'encounter-screen');
  private readonly card = el('div', 'parchment-card encounter-card');
  private readonly heading = el('h2', 'encounter-heading');
  private readonly plunder = el('p', 'encounter-relation');
  private readonly recruits = el('p', 'encounter-relation');
  private readonly lootKept = el('p', 'encounter-relation', STRINGS.combat.lootKept);
  private readonly comparison = el('p', 'encounter-strength');
  private readonly take = button('parchment-button prize-take', STRINGS.combat.take);
  private readonly sink = button('parchment-button', STRINGS.combat.sink);
  private readonly letGo = button('parchment-button', STRINGS.combat.letGo);
  private onChoice: ((choice: PrizeChoice) => void) | null = null;

  constructor() {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.heading.id = 'prize-heading';
    this.root.setAttribute('aria-labelledby', this.heading.id);
    this.card.tabIndex = -1;
    this.take.addEventListener('click', () => this.onChoice?.('take'));
    this.sink.addEventListener('click', () => this.onChoice?.('sink'));
    this.letGo.addEventListener('click', () => this.onChoice?.('letGo'));
    const actions = el('div', 'encounter-actions prize-actions');
    actions.append(this.take, this.sink, this.letGo);
    this.card.append(
      this.heading,
      this.plunder,
      this.recruits,
      this.lootKept,
      this.comparison,
      actions,
    );
    this.root.append(this.card);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  show(view: PrizeView, onChoice: (choice: PrizeChoice) => void): void {
    this.onChoice = onChoice;
    this.heading.replaceChildren(
      STRINGS.combat.prizeBefore,
      el('em', 'encounter-name', view.shipName),
      STRINGS.combat.prizeAfter,
    );
    this.plunder.textContent = view.plunderLine;
    this.recruits.textContent = view.recruitsLine;
    this.comparison.textContent = view.comparison;
    this.root.hidden = false;
    this.card.focus();
  }

  hide(): void {
    this.root.hidden = true;
    this.onChoice = null;
  }
}
