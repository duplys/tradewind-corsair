// SPDX-License-Identifier: GPL-3.0-only
import { MELEE_ROUND_SEC } from '../data/combat';
import { STRINGS } from '../data/strings';
import type { BoardingResult } from '../sim/combat/boarding';
import { button, el } from './dom';

/**
 * The boarding melee (spec §9): both crews count down round by round, one round every 0.12 s,
 * then the result. A tap or a key skips to the end.
 */
export class BoardingOverlay {
  private readonly root = el('div', 'encounter-screen');
  private readonly card = el('div', 'parchment-card encounter-card boarding-card');
  private readonly ours = el('p', 'boarding-count');
  private readonly theirs = el('p', 'boarding-count');
  private readonly verdict = el('p', 'encounter-warning');
  private readonly hint = el('p', 'boarding-hint', STRINGS.combat.skipHint);
  private readonly done = button('parchment-button', STRINGS.combat.continue);
  private result: BoardingResult | null = null;
  private playerAttacks = true;
  private playerWon = false;
  private finished = false;
  private onDone: (() => void) | null = null;

  constructor() {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    const heading = el('h2', 'encounter-heading', STRINGS.combat.boarding);
    heading.id = 'boarding-heading';
    this.root.setAttribute('aria-labelledby', heading.id);
    this.ours.setAttribute('aria-live', 'off');
    this.verdict.setAttribute('role', 'status');
    this.card.tabIndex = -1;
    this.done.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onDone?.();
    });
    this.root.addEventListener('click', () => this.skip());
    const actions = el('div', 'encounter-actions');
    actions.append(this.done);
    this.card.append(heading, this.ours, this.theirs, this.verdict, this.hint, actions);
    this.root.append(this.card);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  get isAnimating(): boolean {
    return this.isOpen && !this.finished;
  }

  show(
    result: BoardingResult,
    playerAttacks: boolean,
    start: { ours: number; theirs: number },
    playerWon: boolean,
    onDone: () => void,
  ): void {
    this.result = result;
    this.playerAttacks = playerAttacks;
    this.playerWon = playerWon;
    this.finished = false;
    this.onDone = onDone;
    this.verdict.textContent = '';
    this.done.hidden = true;
    this.hint.hidden = false;
    this.setCounts(start.ours, start.theirs);
    this.root.hidden = false;
    this.card.focus();
  }

  /** Show the round reached after `elapsedSec` of animation. */
  update(elapsedSec: number): void {
    if (!this.result || this.finished) return;
    const index = Math.floor(elapsedSec / MELEE_ROUND_SEC);
    if (index >= this.result.rounds.length) {
      this.finish();
      return;
    }
    const round = this.result.rounds[index];
    if (round) this.showRound(round);
  }

  skip(): void {
    if (this.isAnimating) this.finish();
  }

  hide(): void {
    this.root.hidden = true;
    this.onDone = null;
  }

  private finish(): void {
    const last = this.result?.rounds.at(-1);
    if (last) this.showRound(last);
    this.finished = true;
    this.verdict.textContent = this.playerWon
      ? STRINGS.combat.carriedDeck
      : STRINGS.combat.drivenBack;
    this.hint.hidden = true;
    this.done.hidden = false;
    this.done.focus();
  }

  private showRound(round: { attackerCrew: number; defenderCrew: number }): void {
    const ours = this.playerAttacks ? round.attackerCrew : round.defenderCrew;
    const theirs = this.playerAttacks ? round.defenderCrew : round.attackerCrew;
    this.setCounts(ours, theirs);
  }

  private setCounts(ours: number, theirs: number): void {
    this.ours.textContent = STRINGS.combat.ourCrew(ours);
    this.theirs.textContent = STRINGS.combat.theirCrew(theirs);
  }
}
