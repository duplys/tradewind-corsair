// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import type { FlagPixels } from '../data/nations';
import { button, el } from './dom';

export type EncounterChoice = 'attack' | 'attackAnyway' | 'leave' | 'fight' | 'run';

export interface EncounterView {
  readonly heading: string;
  readonly flag: FlagPixels;
  readonly flagLabel: string;
  readonly description: { readonly before: string; readonly name: string; readonly after: string };
  readonly strength: string | null;
  readonly relation: string;
  /** Shown instead of the usual lines before attacking a friendly ship. */
  readonly warning: string | null;
  readonly choices: readonly EncounterChoice[];
}

const LABELS: Readonly<Record<EncounterChoice, string>> = {
  attack: STRINGS.encounter.attack,
  attackAnyway: STRINGS.encounter.attackAnyway,
  leave: STRINGS.encounter.leave,
  fight: STRINGS.encounter.fight,
  run: STRINGS.encounter.run,
};

/** The encounter dialog (slice 2 spec §5.4): who she is, how strong, and what to do. */
export class EncounterDialog {
  private readonly root = el('div', 'encounter-screen');
  private readonly card = el('div', 'parchment-card encounter-card');
  private readonly heading = el('h2', 'encounter-heading');
  private readonly flag = el('span', 'flag-icon');
  private readonly description = el('p', 'encounter-description');
  private readonly strength = el('p', 'encounter-strength');
  private readonly relation = el('p', 'encounter-relation');
  private readonly warning = el('p', 'encounter-warning');
  private readonly actions = el('div', 'encounter-actions');
  private onChoice: ((choice: EncounterChoice) => void) | null = null;

  constructor() {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.heading.id = 'encounter-heading';
    this.root.setAttribute('aria-labelledby', this.heading.id);
    // Focus the card, not a button: the Space keyup that opened the dialog must not choose.
    this.card.tabIndex = -1;
    this.flag.setAttribute('role', 'img');
    for (let i = 0; i < 6; i++) this.flag.append(el('span', 'flag-pixel'));
    const who = el('div', 'encounter-who');
    who.append(this.flag, this.description);
    this.card.append(this.heading, who, this.strength, this.relation, this.warning, this.actions);
    this.root.append(this.card);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  show(view: EncounterView, onChoice: (choice: EncounterChoice) => void): void {
    this.onChoice = onChoice;
    this.heading.textContent = view.heading;
    this.flag.setAttribute('aria-label', view.flagLabel);
    this.flag.querySelectorAll<HTMLElement>('.flag-pixel').forEach((pixel, i) => {
      pixel.style.background = view.flag[i] ?? 'transparent';
    });
    const name = el('em', 'encounter-name', view.description.name);
    this.description.replaceChildren(view.description.before, name, view.description.after);
    this.strength.textContent = view.strength ?? '';
    this.strength.hidden = view.strength === null;
    this.relation.textContent = view.relation;
    this.warning.textContent = view.warning ?? '';
    this.warning.hidden = view.warning === null;
    this.actions.replaceChildren(
      ...view.choices.map((choice) => {
        const b = button('parchment-button', LABELS[choice]);
        b.addEventListener('click', () => this.onChoice?.(choice));
        return b;
      }),
    );
    this.root.hidden = false;
    this.card.focus();
  }

  hide(): void {
    this.root.hidden = true;
    this.onChoice = null;
  }
}
