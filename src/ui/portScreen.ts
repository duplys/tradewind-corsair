// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS } from '../data/nations';
import { STRINGS } from '../data/strings';
import type { Port } from '../sim/world/ports';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The port screen (slice 1 spec §4.2): a parchment card with the port's name, nation and flag,
 * blurb and date, four buttons for later slices, and Set sail.
 */
export class PortScreen {
  private readonly root = el('div', 'port-screen');
  private readonly name = el('h1', 'port-name');
  private readonly flag = el('span', 'flag-icon');
  private readonly nation = el('span', 'port-nation-name');
  private readonly blurb = el('p', 'port-blurb');
  private readonly date = el('p', 'port-date');
  private readonly card = el('div', 'parchment-card');
  private readonly setSail = el('button', 'parchment-button set-sail', STRINGS.port.setSail);

  constructor(onSetSail: () => void) {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.name.id = 'port-name';
    this.root.setAttribute('aria-labelledby', this.name.id);

    const card = this.card;
    // Focus lands on the card, not on Set sail: the Space keyup that dropped anchor must not
    // press Set sail. Enter/Space on the card still set sail through the confirm action.
    card.tabIndex = -1;
    const nationLine = el('p', 'port-nation');
    this.flag.setAttribute('role', 'img');
    for (let i = 0; i < 6; i++) this.flag.append(el('span', 'flag-pixel'));
    nationLine.append(this.flag, this.nation);

    const actions = el('div', 'port-actions');
    const future = [
      STRINGS.port.governor,
      STRINGS.port.tavern,
      STRINGS.port.merchant,
      STRINGS.port.shipwright,
    ];
    for (const label of future) {
      const button = el('button', 'parchment-button', label);
      button.type = 'button';
      button.disabled = true;
      button.append(el('small', 'caption', STRINGS.port.comingSoon));
      actions.append(button);
    }
    this.setSail.type = 'button';
    this.setSail.addEventListener('click', onSetSail);

    card.append(this.name, nationLine, this.blurb, this.date, actions, this.setSail);
    this.root.append(card);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  show(port: Port, dateText: string): void {
    const nation = NATIONS[port.def.nation];
    this.name.textContent = port.def.name;
    this.nation.textContent = nation.name;
    this.flag.setAttribute('aria-label', STRINGS.port.flagOf(nation.name));
    this.flag.querySelectorAll<HTMLElement>('.flag-pixel').forEach((pixel, i) => {
      pixel.style.background = nation.flag[i] ?? 'transparent';
    });
    this.blurb.textContent = port.def.blurb;
    this.date.textContent = dateText;
    this.root.hidden = false;
    this.card.focus();
  }

  hide(): void {
    this.root.hidden = true;
  }
}
