// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS } from '../data/nations';
import { STRINGS } from '../data/strings';
import type { Port } from '../sim/world/ports';
import { el } from './dom';

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
  private readonly shipwright = el('button', 'parchment-button', STRINGS.port.shipwright);
  private readonly shipwrightCaption = el('small', 'caption');
  private onShipwright: (() => void) | null = null;

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
    const future = [STRINGS.port.governor, STRINGS.port.tavern, STRINGS.port.merchant];
    for (const label of future) {
      const button = el('button', 'parchment-button', label);
      button.type = 'button';
      button.disabled = true;
      button.append(el('small', 'caption', STRINGS.port.comingSoon));
      actions.append(button);
    }
    this.shipwright.type = 'button';
    this.shipwright.append(this.shipwrightCaption);
    this.shipwright.addEventListener('click', () => this.onShipwright?.());
    actions.append(this.shipwright);
    this.setSail.type = 'button';
    this.setSail.addEventListener('click', onSetSail);

    card.append(this.name, nationLine, this.blurb, this.date, actions, this.setSail);
    this.root.append(card);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  /**
   * Show a port. \`onShipwright\` is null where the shipwright will not serve the player (a
   * port hostile to England, slice 2 spec §3.4).
   */
  show(port: Port, dateText: string, onShipwright: (() => void) | null): void {
    this.onShipwright = onShipwright;
    this.shipwright.disabled = onShipwright === null;
    this.shipwrightCaption.textContent = onShipwright ? '' : STRINGS.port.closedToUs;
    this.shipwrightCaption.hidden = onShipwright !== null;
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

  /** Refresh the date after time passes in port (repairs). */
  setDate(dateText: string): void {
    this.date.textContent = dateText;
  }

  /** Give focus back to the card, e.g. after closing the Shipwright. */
  focus(): void {
    this.card.focus();
  }

  hide(): void {
    this.root.hidden = true;
    this.onShipwright = null;
  }
}
