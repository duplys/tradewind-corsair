// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS } from '../data/nations';
import { STRINGS } from '../data/strings';
import type { Port } from '../sim/world/ports';
import { el } from './dom';

/**
 * The port screen (slice 1 spec §4.2): a parchment card with the port's name, nation and flag,
 * blurb and date, a button for each building, and Set sail.
 */
/** What the port's buildings do. `shipwright` is null where it will not serve the player. */
export interface PortHandlers {
  /** Null where the governor will not see the player (a port hostile to England). */
  readonly onGovernor: (() => void) | null;
  readonly onTavern: () => void;
  readonly onMerchant: () => void;
  readonly onShipwright: (() => void) | null;
}

export class PortScreen {
  private readonly root = el('div', 'port-screen');
  private readonly name = el('h1', 'port-name');
  private readonly flag = el('span', 'flag-icon');
  private readonly nation = el('span', 'port-nation-name');
  private readonly blurb = el('p', 'port-blurb');
  private readonly date = el('p', 'port-date');
  private readonly card = el('div', 'parchment-card');
  private readonly setSail = el('button', 'parchment-button set-sail', STRINGS.port.setSail);
  private readonly governor = el('button', 'parchment-button', STRINGS.port.governor);
  private readonly governorCaption = el('small', 'caption');
  private readonly tavern = el('button', 'parchment-button', STRINGS.port.tavern);
  private readonly merchant = el('button', 'parchment-button', STRINGS.port.merchant);
  private readonly shipwright = el('button', 'parchment-button', STRINGS.port.shipwright);
  private readonly shipwrightCaption = el('small', 'caption');
  private handlers: PortHandlers | null = null;

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
    this.governor.type = 'button';
    this.governor.append(this.governorCaption);
    this.governor.addEventListener('click', () => this.handlers?.onGovernor?.());
    for (const [node, open] of [
      [this.tavern, () => this.handlers?.onTavern()],
      [this.merchant, () => this.handlers?.onMerchant()],
    ] as const) {
      node.type = 'button';
      node.addEventListener('click', open);
    }
    this.shipwright.type = 'button';
    this.shipwright.append(this.shipwrightCaption);
    this.shipwright.addEventListener('click', () => this.handlers?.onShipwright?.());
    actions.append(this.governor, this.tavern, this.merchant, this.shipwright);
    this.setSail.type = 'button';
    this.setSail.addEventListener('click', onSetSail);

    card.append(this.name, nationLine, this.blurb, this.date, actions, this.setSail);
    this.root.append(card);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  /**
   * Show a port. The shipwright handler is null where the shipwright will not serve the player
   * (a port hostile to England, slice 2 spec §3.4).
   */
  show(port: Port, dateText: string, handlers: PortHandlers): void {
    this.handlers = handlers;
    const governorOpen = handlers.onGovernor !== null;
    this.governor.disabled = !governorOpen;
    this.governorCaption.textContent = governorOpen ? '' : STRINGS.port.closedToUs;
    this.governorCaption.hidden = governorOpen;
    const shipwrightOpen = handlers.onShipwright !== null;
    this.shipwright.disabled = !shipwrightOpen;
    this.shipwrightCaption.textContent = shipwrightOpen ? '' : STRINGS.port.closedToUs;
    this.shipwrightCaption.hidden = shipwrightOpen;
    const nation = NATIONS[port.def.nation];
    this.name.textContent = port.def.name;
    this.nation.textContent = nation.name;
    this.flag.setAttribute('aria-label', STRINGS.port.flagOf(nation.sentenceName));
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
    this.handlers = null;
  }
}
