// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import { button, el } from './dom';
import { formatGold } from './format';

export interface TavernView {
  readonly gold: number;
  readonly crew: number;
  readonly crewMax: number;
  /** Hands the player could sign on now (berths and gold). */
  readonly maxHires: number;
  readonly berths: number;
  readonly hireSteps: readonly number[];
  readonly hireCostPerHand: number;
  readonly rumourCost: number;
  readonly tipCost: number;
  readonly canRumour: boolean;
  /** Why a tip cannot be bought, if it cannot. */
  readonly tipBlock: 'gold' | 'full' | null;
  /** What the last action produced: a rumour, a tip result or a hiring. */
  readonly note: string;
}

export interface TavernHandlers {
  readonly onHire: (count: number) => void;
  readonly onRumour: () => void;
  readonly onTip: () => void;
  readonly onBack: () => void;
}

interface Offer {
  readonly node: HTMLButtonElement;
  readonly label: HTMLSpanElement;
  readonly caption: HTMLElement;
}

function offer(className: string): Offer {
  const node = button(`parchment-button ${className}`, '');
  const label = el('span', 'offer-label');
  const caption = el('small', 'caption');
  node.append(label, caption);
  return { node, label, caption };
}

/** The Tavern: sign on crew, stand a round for a rumour, or buy a treasure tip. */
export class TavernPanel {
  private readonly root = el('div', 'shipwright-screen tavern-screen');
  private readonly card = el('div', 'parchment-card shipwright-card');
  private readonly purse = el('p', 'shipwright-purse');
  private readonly crew = el('p', 'shipwright-state');
  private readonly note = el('p', 'shipwright-note tavern-note');
  private readonly actions = el('div', 'shipwright-actions');
  private readonly hires: Offer[] = [];
  private readonly fill = offer('tavern-fill');
  private readonly rumour = offer('tavern-rumour');
  private readonly tip = offer('tavern-tip');
  private readonly back = button('parchment-button shipwright-back', STRINGS.tavern.back);
  private handlers: TavernHandlers | null = null;
  private steps: readonly number[] = [];

  constructor() {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    const heading = el('h2', 'shipwright-heading', STRINGS.tavern.heading);
    heading.id = 'tavern-heading';
    this.root.setAttribute('aria-labelledby', heading.id);
    this.card.tabIndex = -1;
    this.note.setAttribute('aria-live', 'polite');
    this.rumour.label.textContent = STRINGS.tavern.rumour;
    this.tip.label.textContent = STRINGS.tavern.tip;
    this.card.append(heading, this.purse, this.crew, this.note, this.actions, this.back);
    this.root.append(this.card);

    this.fill.node.addEventListener('click', () => this.handlers?.onHire(Infinity));
    this.rumour.node.addEventListener('click', () => this.handlers?.onRumour());
    this.tip.node.addEventListener('click', () => this.handlers?.onTip());
    this.back.addEventListener('click', () => this.handlers?.onBack());
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  show(view: TavernView, handlers: TavernHandlers): void {
    this.handlers = handlers;
    this.buildHires(view.hireSteps);
    this.root.hidden = false;
    this.update(view);
    this.card.focus();
  }

  private buildHires(steps: readonly number[]): void {
    if (steps === this.steps) return;
    this.steps = steps;
    this.hires.length = 0;
    for (const count of steps) {
      const o = offer('tavern-hire');
      o.node.addEventListener('click', () => this.handlers?.onHire(count));
      this.hires.push(o);
    }
    this.actions.replaceChildren(
      ...this.hires.map((o) => o.node),
      this.fill.node,
      this.rumour.node,
      this.tip.node,
    );
  }

  /** Refresh after an action. Focus stays in the panel. */
  update(view: TavernView): void {
    const s = STRINGS.tavern;
    this.purse.textContent = s.purse(formatGold(view.gold));
    this.crew.textContent = s.crew(view.crew, view.crewMax);
    this.note.textContent = view.note;

    const full = view.berths === 0;
    view.hireSteps.forEach((count, i) => {
      const o = this.hires[i]!;
      o.label.textContent = s.hire(count);
      o.caption.textContent = full
        ? s.fullyManned
        : view.maxHires < count
          ? s.cannotAfford
          : s.hireCost(formatGold(count * view.hireCostPerHand));
      o.node.disabled = view.maxHires < count;
    });
    this.fill.label.textContent = s.hireFill(view.maxHires);
    this.fill.caption.textContent = full
      ? s.fullyManned
      : view.maxHires === 0
        ? s.cannotAfford
        : s.hireCost(formatGold(view.maxHires * view.hireCostPerHand));
    this.fill.node.disabled = view.maxHires === 0;

    this.rumour.caption.textContent = view.canRumour
      ? s.rumourCost(formatGold(view.rumourCost))
      : s.cannotAfford;
    this.rumour.node.disabled = !view.canRumour;
    this.tip.caption.textContent =
      view.tipBlock === null
        ? s.tipCost(formatGold(view.tipCost))
        : view.tipBlock === 'full'
          ? s.tipsFull
          : s.cannotAfford;
    this.tip.node.disabled = view.tipBlock !== null;

    if (document.activeElement instanceof HTMLButtonElement && document.activeElement.disabled) {
      this.card.focus();
    }
  }

  hide(): void {
    this.root.hidden = true;
    this.handlers = null;
  }
}
