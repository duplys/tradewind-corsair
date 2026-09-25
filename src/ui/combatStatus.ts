// SPDX-License-Identifier: GPL-3.0-only
import { YARDS_PER_COMBAT_PX } from '../data/combat';
import { STRINGS } from '../data/strings';
import type { CombatShip, CombatState } from '../sim/combat/state';
import { el } from './dom';
import { displayPct } from './format';

const UPDATE_INTERVAL_SEC = 0.1;

/**
 * A plain text status panel for the fight (interim until the combat HUD in M6): both ships'
 * condition, your guns' readiness and the range.
 */
export class CombatStatus {
  private readonly root = el('section', 'panel combat-status');
  private readonly lines = [
    el('div', ''),
    el('div', ''),
    el('div', ''),
    el('div', ''),
    el('div', 'combat-keys', STRINGS.combat.keys),
  ];
  private lastSec = -Infinity;

  constructor() {
    this.root.hidden = true;
    this.root.append(...this.lines);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  show(): void {
    this.root.hidden = false;
    this.lastSec = -Infinity;
  }

  hide(): void {
    this.root.hidden = true;
  }

  update(state: CombatState, playerName: string, enemyName: string, nowSec: number): void {
    if (nowSec - this.lastSec < UPDATE_INTERVAL_SEC) return;
    this.lastSec = nowSec;
    const [player, enemy] = state.ships;
    const c = STRINGS.combat;
    const describe = (ship: CombatShip, name: string) =>
      c.statusLine(
        name,
        displayPct(ship.condition.hullPct),
        displayPct(ship.condition.riggingPct),
        ship.condition.crew,
      ) + (ship.struck ? ` · ${c.struckFlag}` : '');
    const ready = (sec: number) => (sec <= 0 ? c.ready : c.reloading(sec.toFixed(1)));
    const range = Math.hypot(enemy.ship.x - player.ship.x, enemy.ship.y - player.ship.y);
    this.lines[0]!.textContent = describe(player, playerName);
    this.lines[1]!.textContent = c.gunsLine(
      ready(player.reloadSec.port),
      ready(player.reloadSec.starboard),
    );
    this.lines[2]!.textContent = describe(enemy, enemyName);
    this.lines[3]!.textContent = c.range(Math.round(range * YARDS_PER_COMBAT_PX));
  }
}
