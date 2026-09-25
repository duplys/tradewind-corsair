// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import { button, el } from './dom';

export interface TitleOptions {
  readonly canContinue: boolean;
  readonly touch: boolean;
  readonly onContinue: () => void;
  readonly onNew: () => void;
}

/** The title card (slice 1 spec §9.2), shown over the live map. */
export class TitleScreen {
  private readonly root = el('div', 'title-screen');
  private readonly legend = el('dl', 'title-controls');
  private readonly continueButton = button(
    'parchment-button title-continue',
    STRINGS.title.continueVoyage,
  );
  private readonly newButton = button('parchment-button title-new', STRINGS.title.newVoyage);
  private options: TitleOptions | null = null;

  constructor() {
    this.root.hidden = true;
    const card = el('div', 'parchment-card title-card');
    const heading = el('h1', 'title-heading', STRINGS.title.heading);
    const tagline = el('p', 'title-tagline', STRINGS.title.tagline);
    const controls = el('section', 'title-controls-section');
    controls.append(el('h2', 'title-controls-heading', STRINGS.title.controlsHeading), this.legend);
    const actions = el('div', 'title-actions');
    actions.append(this.continueButton, this.newButton);
    card.append(heading, tagline, controls, actions);
    this.root.append(card);
    this.continueButton.addEventListener('click', () => this.options?.onContinue());
    this.newButton.addEventListener('click', () => this.options?.onNew());
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  show(options: TitleOptions): void {
    this.options = options;
    const rows = options.touch ? STRINGS.title.touchControls : STRINGS.title.keyboardControls;
    this.legend.replaceChildren(
      ...rows.flatMap(([keys, action]) => [el('dt', '', keys), el('dd', '', action)]),
    );
    this.continueButton.hidden = !options.canContinue;
    this.root.hidden = false;
    (options.canContinue ? this.continueButton : this.newButton).focus();
  }

  hide(): void {
    this.root.hidden = true;
    this.options = null;
  }
}
