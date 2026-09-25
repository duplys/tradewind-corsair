// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import { button, el } from './dom';
import { displayPct, formatDuration, formatGold } from './format';

/** One repair option as the panel shows it. */
export interface RepairOffer {
  readonly costGold: number;
  readonly hours: number;
  /** The repair changes nothing (the ship is already sound, or no gold for any of it). */
  readonly empty: boolean;
  readonly affordable: boolean;
}

export interface GunOffer {
  readonly count: number;
  readonly costGold: number;
}

export interface ShipwrightView {
  readonly hullPct: number;
  readonly riggingPct: number;
  readonly gunsIntact: number;
  readonly gunsMax: number;
  readonly gold: number;
  readonly full: RepairOffer;
  readonly affordable: RepairOffer;
  readonly guns: GunOffer;
}

export interface ShipwrightHandlers {
  readonly onRepairAll: () => void;
  readonly onRepairAffordable: () => void;
  readonly onReplaceGuns: () => void;
  readonly onBack: () => void;
}

function offerButton(className: string): {
  button: HTMLButtonElement;
  label: HTMLSpanElement;
  caption: HTMLElement;
} {
  const b = button(`parchment-button ${className}`, '');
  const label = el('span', 'offer-label');
  const caption = el('small', 'caption');
  b.append(label, caption);
  return { button: b, label, caption };
}

/**
 * The Shipwright (slice 2 spec §3.4): the ship's state, the price and time of each repair on
 * its button (so both are shown before confirming), and Back.
 */
export class ShipwrightPanel {
  private readonly root = el('div', 'shipwright-screen');
  private readonly card = el('div', 'parchment-card shipwright-card');
  private readonly state = el('p', 'shipwright-state');
  private readonly purse = el('p', 'shipwright-purse');
  private readonly note = el('p', 'shipwright-note');
  private readonly all = offerButton('shipwright-all');
  private readonly some = offerButton('shipwright-some');
  private readonly guns = offerButton('shipwright-guns');
  private readonly back = button('parchment-button shipwright-back', STRINGS.shipwright.back);
  private handlers: ShipwrightHandlers | null = null;

  constructor() {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    const heading = el('h2', 'shipwright-heading', STRINGS.shipwright.heading);
    heading.id = 'shipwright-heading';
    this.root.setAttribute('aria-labelledby', heading.id);
    this.card.tabIndex = -1;
    this.all.label.textContent = STRINGS.shipwright.repairAll;
    this.some.label.textContent = STRINGS.shipwright.repairAffordable;
    const actions = el('div', 'shipwright-actions');
    actions.append(this.all.button, this.some.button, this.guns.button);
    this.card.append(heading, this.state, this.purse, this.note, actions, this.back);
    this.root.append(this.card);

    this.all.button.addEventListener('click', () => this.handlers?.onRepairAll());
    this.some.button.addEventListener('click', () => this.handlers?.onRepairAffordable());
    this.guns.button.addEventListener('click', () => this.handlers?.onReplaceGuns());
    this.back.addEventListener('click', () => this.handlers?.onBack());
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  show(view: ShipwrightView, handlers: ShipwrightHandlers): void {
    this.handlers = handlers;
    this.root.hidden = false;
    this.update(view);
    this.card.focus();
  }

  /** Refresh after a repair. Focus stays in the panel. */
  update(view: ShipwrightView): void {
    const s = STRINGS.shipwright;
    this.state.textContent = [
      s.hull(displayPct(view.hullPct)),
      s.rigging(displayPct(view.riggingPct)),
      s.guns(view.gunsIntact, view.gunsMax),
    ].join(' · ');
    this.purse.textContent = s.purse(formatGold(view.gold));
    this.note.textContent = view.full.empty ? s.sound : '';

    const repairCaption = (offer: RepairOffer): string => {
      if (offer.empty) return view.full.empty ? s.nothingToDo : s.cannotAfford;
      return s.cost(formatGold(offer.costGold), formatDuration(offer.hours));
    };
    this.all.caption.textContent = view.full.empty
      ? s.nothingToDo
      : view.full.affordable
        ? repairCaption(view.full)
        : `${s.cost(formatGold(view.full.costGold), formatDuration(view.full.hours))} · ${s.cannotAfford}`;
    this.all.button.disabled = view.full.empty || !view.full.affordable;
    this.some.caption.textContent = repairCaption(view.affordable);
    this.some.button.disabled = view.affordable.empty;

    const missing = view.gunsMax - view.gunsIntact;
    this.guns.label.textContent = missing > 0 ? s.replaceGuns(missing) : s.replaceNoGuns;
    this.guns.caption.textContent =
      missing === 0
        ? s.nothingToDo
        : view.guns.count === 0
          ? s.cannotAfford
          : s.gunsCost(formatGold(view.guns.costGold));
    this.guns.button.disabled = view.guns.count === 0;

    // Keep keyboard focus inside the panel if the focused button just became disabled.
    if (document.activeElement instanceof HTMLButtonElement && document.activeElement.disabled) {
      this.card.focus();
    }
  }

  hide(): void {
    this.root.hidden = true;
    this.handlers = null;
  }
}
