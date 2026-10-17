// SPDX-License-Identifier: GPL-3.0-only
import { GOOD_IDS, GOODS, TRADE_STEPS, type GoodId } from '../data/goods';
import { STRINGS } from '../data/strings';
import { button, el } from './dom';
import { formatGold } from './format';

/** One row of the market as the panel shows it. */
export interface TradeRow {
  readonly good: GoodId;
  readonly held: number;
  readonly buy: number;
  readonly sell: number;
  /** How the middle price compares with the good's usual price. */
  readonly tag: 'cheap' | 'dear' | null;
  /** The most the player can buy right now (space and gold). */
  readonly canBuy: number;
}

export interface TradeView {
  readonly gold: number;
  readonly used: number;
  readonly capacity: number;
  readonly hostile: boolean;
  readonly rows: readonly TradeRow[];
  /** The result of the last trade, or ''. */
  readonly note: string;
}

export interface TradeHandlers {
  readonly onBuy: (good: GoodId, count: number) => void;
  /** A count of Infinity sells everything of that good. */
  readonly onSell: (good: GoodId, count: number) => void;
  readonly onBack: () => void;
}

interface RowNodes {
  readonly held: HTMLElement;
  readonly prices: HTMLElement;
  readonly tag: HTMLElement;
  readonly buys: { readonly count: number; readonly node: HTMLButtonElement }[];
  readonly sells: { readonly count: number; readonly node: HTMLButtonElement }[];
  readonly sellAll: HTMLButtonElement;
}

/**
 * The Merchant: gold and hold, and a row per good with its buy and sell price and buttons for
 * single units, tens and everything. Prices are on the screen before any button is pressed.
 */
export class TradePanel {
  private readonly root = el('div', 'shipwright-screen trade-screen');
  private readonly card = el('div', 'parchment-card shipwright-card trade-card');
  private readonly purse = el('p', 'shipwright-purse');
  private readonly hold = el('p', 'shipwright-state');
  private readonly note = el('p', 'shipwright-note');
  private readonly rows = new Map<GoodId, RowNodes>();
  private readonly back = button('parchment-button shipwright-back', STRINGS.merchant.back);
  private handlers: TradeHandlers | null = null;

  constructor() {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    const heading = el('h2', 'shipwright-heading', STRINGS.merchant.heading);
    heading.id = 'merchant-heading';
    this.root.setAttribute('aria-labelledby', heading.id);
    this.card.tabIndex = -1;

    const list = el('div', 'trade-list');
    for (const id of GOOD_IDS) list.append(this.buildRow(id));
    this.card.append(heading, this.purse, this.hold, this.note, list, this.back);
    this.root.append(this.card);
    this.back.addEventListener('click', () => this.handlers?.onBack());
  }

  private buildRow(id: GoodId): HTMLElement {
    const row = el('div', 'trade-row');
    const head = el('div', 'trade-head');
    const name = el('span', 'trade-name', GOODS[id].name);
    const tag = el('span', 'trade-tag');
    const held = el('span', 'trade-held');
    head.append(name, tag, held);
    const prices = el('p', 'trade-prices');
    const buttons = el('div', 'trade-buttons');
    const buys = TRADE_STEPS.map((count) => {
      const node = button('parchment-button trade-button', STRINGS.merchant.buy(count));
      node.setAttribute('aria-label', `${STRINGS.merchant.buy(count)} ${GOODS[id].name}`);
      node.addEventListener('click', () => this.handlers?.onBuy(id, count));
      return { count, node };
    });
    const sells = TRADE_STEPS.map((count) => {
      const node = button('parchment-button trade-button', STRINGS.merchant.sell(count));
      node.setAttribute('aria-label', `${STRINGS.merchant.sell(count)} ${GOODS[id].name}`);
      node.addEventListener('click', () => this.handlers?.onSell(id, count));
      return { count, node };
    });
    const sellAll = button('parchment-button trade-button', STRINGS.merchant.sellAll);
    sellAll.setAttribute('aria-label', `${STRINGS.merchant.sellAll} ${GOODS[id].name}`);
    sellAll.addEventListener('click', () => this.handlers?.onSell(id, Infinity));
    buttons.append(...buys.map((b) => b.node), ...sells.map((b) => b.node), sellAll);
    row.append(head, prices, buttons);
    this.rows.set(id, { held, prices, tag, buys, sells, sellAll });
    return row;
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  show(view: TradeView, handlers: TradeHandlers): void {
    this.handlers = handlers;
    this.root.hidden = false;
    this.update(view);
    this.card.focus();
  }

  /** Refresh after a trade. Focus stays in the panel. */
  update(view: TradeView): void {
    const s = STRINGS.merchant;
    this.purse.textContent = s.purse(formatGold(view.gold));
    this.hold.textContent = s.hold(view.used, view.capacity);
    const notes = [
      view.note,
      view.hostile ? s.hostile : '',
      view.used >= view.capacity ? s.holdFull : '',
    ];
    this.note.textContent = notes.filter((n) => n !== '').join(' ');
    for (const row of view.rows) {
      const nodes = this.rows.get(row.good)!;
      nodes.held.textContent = s.heldOf(row.held);
      nodes.prices.textContent = `${s.buyPrice(formatGold(row.buy))} · ${s.sellPrice(formatGold(row.sell))}`;
      nodes.tag.textContent = row.tag === 'cheap' ? s.cheap : row.tag === 'dear' ? s.dear : '';
      nodes.tag.dataset.tag = row.tag ?? '';
      for (const b of nodes.buys) b.node.disabled = row.canBuy < 1;
      for (const b of nodes.sells) b.node.disabled = row.held < 1;
      nodes.sellAll.disabled = row.held < 1;
    }
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
