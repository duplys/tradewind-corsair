// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import { button, el } from './dom';
import { formatGold } from './format';

export interface GovernorView {
  readonly portName: string;
  /** True for a governor of the crown that holds the player's letter of marque. */
  readonly crown: boolean;
  readonly gold: number;
  readonly rankTitle: string;
  /** The next rank and the career bounty gold it needs, or null at the top. */
  readonly next: { readonly title: string; readonly atGold: number } | null;
  readonly standing: readonly { readonly nation: string; readonly label: string }[];
  /** Bounty this governor would pay now. */
  readonly owed: number;
  /** What the last claim did, or ''. */
  readonly note: string;
}

export interface GovernorHandlers {
  readonly onClaim: () => void;
  readonly onBack: () => void;
}

/** The Governor: commission, rank, standing with each nation, and bounty to collect. */
export class GovernorPanel {
  private readonly root = el('div', 'shipwright-screen governor-screen');
  private readonly card = el('div', 'parchment-card shipwright-card');
  private readonly greeting = el('p', 'shipwright-note governor-greeting');
  private readonly commission = el('p', 'shipwright-note');
  private readonly purse = el('p', 'shipwright-purse');
  private readonly rank = el('p', 'shipwright-state');
  private readonly next = el('p', 'shipwright-note');
  private readonly standing = el('ul', 'governor-standing');
  private readonly owed = el('p', 'shipwright-state');
  private readonly note = el('p', 'shipwright-note');
  private readonly claim = button('parchment-button governor-claim', '');
  private readonly claimLabel = el('span', 'offer-label', STRINGS.governor.claim);
  private readonly claimCaption = el('small', 'caption');
  private readonly back = button('parchment-button shipwright-back', STRINGS.governor.back);
  private handlers: GovernorHandlers | null = null;

  constructor() {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    const heading = el('h2', 'shipwright-heading', STRINGS.governor.heading);
    heading.id = 'governor-heading';
    this.root.setAttribute('aria-labelledby', heading.id);
    this.card.tabIndex = -1;
    this.note.setAttribute('aria-live', 'polite');
    this.claim.append(this.claimLabel, this.claimCaption);
    const standingHeading = el('h3', 'governor-subheading', STRINGS.governor.standingHeading);
    const actions = el('div', 'shipwright-actions');
    actions.append(this.claim);
    this.card.append(
      heading,
      this.greeting,
      this.commission,
      this.purse,
      this.rank,
      this.next,
      standingHeading,
      this.standing,
      this.owed,
      this.note,
      actions,
      this.back,
    );
    this.root.append(this.card);
    this.claim.addEventListener('click', () => this.handlers?.onClaim());
    this.back.addEventListener('click', () => this.handlers?.onBack());
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  show(view: GovernorView, handlers: GovernorHandlers): void {
    this.handlers = handlers;
    this.root.hidden = false;
    this.update(view);
    this.card.focus();
  }

  /** Refresh after a claim. Focus stays in the panel. */
  update(view: GovernorView): void {
    const s = STRINGS.governor;
    this.greeting.textContent = s.greeting(view.portName);
    this.commission.textContent = view.crown ? s.commissionCrown : s.commissionOther;
    this.purse.textContent = s.purse(formatGold(view.gold));
    this.rank.textContent = s.rank(view.rankTitle);
    this.next.textContent = view.next
      ? s.nextRank(view.next.title, formatGold(view.next.atGold))
      : s.topRank;
    this.standing.replaceChildren(
      ...view.standing.map((row) => el('li', '', s.standingLine(row.nation, row.label))),
    );
    this.owed.textContent = view.owed > 0 ? s.owed(formatGold(view.owed)) : s.nothingOwed;
    this.note.textContent = view.note;
    this.claimCaption.textContent =
      view.owed > 0 ? s.claimCost(formatGold(view.owed)) : s.nothingToClaim;
    this.claim.disabled = view.owed <= 0;
    if (document.activeElement instanceof HTMLButtonElement && document.activeElement.disabled) {
      this.card.focus();
    }
  }

  hide(): void {
    this.root.hidden = true;
    this.handlers = null;
  }
}
