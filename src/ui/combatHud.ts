// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS, PIRATE_FLAG } from '../data/nations';
import { SHIP_CLASSES } from '../data/ships';
import { STRINGS } from '../data/strings';
import type { BroadsideSide, CombatShip, CombatState } from '../sim/combat/state';
import { sideFacing } from '../sim/combat/step';
import type { NpcShip } from '../sim/npc/npc';
import { gunsMannedPerBroadside, reloadTimeSec } from '../sim/ships/condition';
import { drawCompass } from './compass';
import { crewShown, reloadFraction, yards } from './combatText';
import { button, el } from './dom';
import { displayPct } from './format';
import { PixelBar } from './pixelBar';

const COMPASS_CSS_PX = 48;
const TEXT_UPDATE_INTERVAL_SEC = 0.1;
const FLASH_SEC = 0.4;
const RELOAD_SEGMENTS = 10;

/** A segmented reload bar for one side (spec §10.3). */
class ReloadBar {
  readonly el = el('div', 'reload');
  private readonly segments: HTMLSpanElement[] = [];
  private flashUntilSec = -Infinity;

  constructor(label: string) {
    const bar = el('span', 'reload-bar');
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    for (let i = 0; i < RELOAD_SEGMENTS; i++) {
      const s = el('span', 'reload-segment');
      this.segments.push(s);
      bar.append(s);
    }
    this.el.append(el('span', 'reload-label', label), bar);
  }

  flash(nowSec: number): void {
    this.flashUntilSec = nowSec + FLASH_SEC;
  }

  set(fraction: number, bears: boolean, nowSec: number, label: string): void {
    const filled = Math.round(fraction * RELOAD_SEGMENTS);
    this.segments.forEach((s, i) => s.classList.toggle('is-filled', i < filled));
    this.el.classList.toggle('is-ready', fraction >= 1);
    this.el.classList.toggle('is-bearing', bears);
    this.el.classList.toggle('is-flashing', nowSec < this.flashUntilSec);
    const bar = this.el.lastElementChild!;
    bar.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    bar.setAttribute('aria-label', label);
  }
}

/**
 * The combat HUD (slice 2 spec §10.3): your ship top-left with a small compass, the enemy
 * top-right, the pause button top-centre, and the range and reload bars bottom-centre.
 */
export class CombatHud {
  private readonly root = el('div', 'combat-hud');
  private readonly ownName = el('div', 'combat-name');
  private readonly ownCrew = el('div', 'combat-line');
  private readonly ownGuns = el('div', 'combat-line');
  private readonly ownHull = new PixelBar();
  private readonly ownRigging = new PixelBar();
  private readonly compass = el('canvas', 'compass combat-compass');
  private readonly compassCtx: CanvasRenderingContext2D;
  private readonly enemyFlag = el('span', 'flag-icon');
  private readonly enemyName = el('div', 'combat-name');
  private readonly enemyCrew = el('div', 'combat-line');
  private readonly enemyHull = new PixelBar();
  private readonly enemyRigging = new PixelBar();
  private readonly range = el('div', 'combat-range');
  private readonly port = new ReloadBar(STRINGS.combat.port);
  private readonly starboard = new ReloadBar(STRINGS.combat.starboard);
  private lastTextSec = -Infinity;
  private dpr = 0;

  constructor(onPause: () => void) {
    this.root.hidden = true;
    const bars = (hull: PixelBar, rigging: PixelBar) => {
      const box = el('div', 'ledger-condition');
      box.append(
        el('span', 'ledger-bar-label', STRINGS.hud.hull),
        hull.el,
        el('span', 'ledger-bar-label', STRINGS.hud.rigging),
        rigging.el,
      );
      return box;
    };
    const own = el('section', 'panel combat-own');
    const ownText = el('div', 'combat-text');
    ownText.append(this.ownName, this.ownCrew, this.ownGuns, bars(this.ownHull, this.ownRigging));
    this.compass.setAttribute('role', 'img');
    this.compass.setAttribute('aria-label', STRINGS.combat.windLabel);
    this.compass.style.width = this.compass.style.height = `${COMPASS_CSS_PX}px`;
    const ctx = this.compass.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');
    this.compassCtx = ctx;
    own.append(this.compass, ownText);

    const enemy = el('section', 'panel combat-enemy');
    this.enemyFlag.setAttribute('role', 'img');
    for (let i = 0; i < 6; i++) this.enemyFlag.append(el('span', 'flag-pixel'));
    const head = el('div', 'combat-enemy-head');
    head.append(this.enemyFlag, this.enemyName);
    enemy.append(head, this.enemyCrew, bars(this.enemyHull, this.enemyRigging));

    const pause = button('hud-button combat-pause', '‖');
    pause.setAttribute('aria-label', STRINGS.combat.pause);
    pause.addEventListener('click', onPause);

    const guns = el('div', 'panel combat-guns');
    guns.append(this.range, this.port.el, this.starboard.el);
    this.root.append(own, enemy, pause, guns);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  /** Show the HUD for a new fight; the names and the enemy's flag do not change. */
  show(playerName: string, playerClass: string, enemy: NpcShip): void {
    this.ownName.textContent = `${playerName} · ${playerClass}`;
    const cls = SHIP_CLASSES[enemy.classId];
    this.enemyName.textContent = `${enemy.name} · ${cls.name}`;
    const flag = enemy.nation === 'pirate' ? PIRATE_FLAG : NATIONS[enemy.nation].flag;
    this.enemyFlag.setAttribute(
      'aria-label',
      enemy.nation === 'pirate'
        ? STRINGS.port.pirateFlag
        : STRINGS.port.flagOf(NATIONS[enemy.nation].sentenceName),
    );
    this.enemyFlag.querySelectorAll<HTMLElement>('.flag-pixel').forEach((p, i) => {
      p.style.background = flag[i] ?? 'transparent';
    });
    this.lastTextSec = -Infinity;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Flash a side's reload bar when fire was ordered before it was ready. */
  flash(side: BroadsideSide, nowSec: number): void {
    (side === 'port' ? this.port : this.starboard).flash(nowSec);
  }

  update(state: CombatState, nowSec: number): void {
    const [player, enemy] = state.ships;
    const dpr = window.devicePixelRatio || 1;
    if (dpr !== this.dpr) {
      this.dpr = dpr;
      this.compass.width = this.compass.height = Math.round(COMPASS_CSS_PX * dpr);
    }
    drawCompass(this.compassCtx, this.compass.width, player.ship.headingRad, state.wind.towardRad);

    const bearing = sideFacing(player, enemy);
    const total = reloadTimeSec(player.condition);
    const reload = (bar: ReloadBar, side: BroadsideSide, name: string) => {
      const f = player.volley[side] ? 0 : reloadFraction(player.reloadSec[side], total);
      const label =
        f >= 1
          ? STRINGS.combat.readyLabel(name)
          : STRINGS.combat.reloadLabel(name, Math.round(f * 100));
      bar.set(f, bearing === side, nowSec, label);
    };
    reload(this.port, 'port', STRINGS.combat.port);
    reload(this.starboard, 'starboard', STRINGS.combat.starboard);

    if (nowSec - this.lastTextSec < TEXT_UPDATE_INTERVAL_SEC) return;
    this.lastTextSec = nowSec;
    const rangePx = Math.hypot(enemy.ship.x - player.ship.x, enemy.ship.y - player.ship.y);
    const own = player.condition;
    setText(
      this.ownCrew,
      STRINGS.combat.crewNeeds(own.crew, SHIP_CLASSES[player.classId].crewTypical),
    );
    setText(this.ownGuns, STRINGS.combat.gunsPerSide(gunsMannedPerBroadside(own)));
    setBars(this.ownHull, this.ownRigging, player);
    const shown = crewShown(enemy.condition.crew, rangePx);
    setText(
      this.enemyCrew,
      shown.estimate ? STRINGS.combat.crewAbout(shown.crew) : STRINGS.combat.crewExact(shown.crew),
    );
    setBars(this.enemyHull, this.enemyRigging, enemy);
    setText(this.range, STRINGS.combat.range(yards(rangePx)));
  }
}

function setBars(hull: PixelBar, rigging: PixelBar, ship: CombatShip): void {
  const h = displayPct(ship.condition.hullPct);
  const r = displayPct(ship.condition.riggingPct);
  hull.set(h, STRINGS.hud.barLabel(STRINGS.hud.hull, h));
  rigging.set(r, STRINGS.hud.barLabel(STRINGS.hud.rigging, r));
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}
