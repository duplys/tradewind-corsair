// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import { SHIP_CLASSES } from '../data/ships';
import type { Wind } from '../sim/sailing/wind';
import { formatDate } from '../sim/time';
import type { Voyage } from '../sim/voyage';
import { drawCompass } from './compass';
import { button, el } from './dom';
import { displayPct, formatGold } from './format';
import { helmLines } from './helmText';
import { PixelBar } from './pixelBar';

const COMPASS_CSS_PX = 72;
const TEXT_UPDATE_INTERVAL_SEC = 0.1;

/**
 * Sailing HUD: the ledger panel top-left (date, ship, gold, crew, hull and rigging; slice 2 spec
 * §3.3) and the helm panel top-right (compass and helm text; slice 1 spec §9.1).
 */
export class Hud {
  private readonly root = el('div', 'hud');
  private readonly date = el('div', 'ledger-date');
  private readonly shipLine = el('div', 'ledger-ship');
  private readonly gold = el('div', 'ledger-gold');
  private readonly crew = el('div', 'ledger-crew');
  private readonly hullBar = new PixelBar();
  private readonly riggingBar = new PixelBar();
  private readonly compass = el('canvas', 'compass');
  private readonly compassCtx: CanvasRenderingContext2D;
  private readonly lines: HTMLDivElement[] = [];
  private lastTextSec = -Infinity;
  private dpr = 0;

  constructor(onChart: () => void) {
    this.root.hidden = true;

    const ledger = el('section', 'panel ledger');
    const condition = el('div', 'ledger-condition');
    condition.append(
      el('span', 'ledger-bar-label', STRINGS.hud.hull),
      this.hullBar.el,
      el('span', 'ledger-bar-label', STRINGS.hud.rigging),
      this.riggingBar.el,
    );
    const chart = button('hud-button', STRINGS.hud.chart);
    chart.addEventListener('click', onChart);
    ledger.append(this.date, this.shipLine, this.gold, this.crew, condition, chart);

    const helm = el('section', 'panel helm');
    this.compass.setAttribute('role', 'img');
    this.compass.setAttribute('aria-label', STRINGS.hud.compassLabel);
    this.compass.style.width = `${COMPASS_CSS_PX}px`;
    this.compass.style.height = `${COMPASS_CSS_PX}px`;
    const ctx = this.compass.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');
    this.compassCtx = ctx;
    const text = el('div', 'helm-lines');
    for (let i = 0; i < 4; i++) {
      const line = el('div', 'helm-line');
      this.lines.push(line);
      text.append(line);
    }
    helm.append(this.compass, text);
    this.root.append(ledger, helm);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  show(): void {
    this.root.hidden = false;
    this.lastTextSec = -Infinity;
  }

  hide(): void {
    this.root.hidden = true;
  }

  /** Redraw the compass every frame; refresh text and bars at most 10 times per second. */
  update(voyage: Voyage, wind: Wind, nowSec: number): void {
    const dpr = window.devicePixelRatio || 1;
    if (dpr !== this.dpr) {
      this.dpr = dpr;
      this.compass.width = this.compass.height = Math.round(COMPASS_CSS_PX * dpr);
    }
    drawCompass(this.compassCtx, this.compass.width, voyage.ship.headingRad, wind.towardRad);

    if (nowSec - this.lastTextSec < TEXT_UPDATE_INTERVAL_SEC) return;
    this.lastTextSec = nowSec;
    const { condition } = voyage;
    const cls = SHIP_CLASSES[voyage.ship.classId];
    setText(this.date, formatDate(voyage.elapsedHours, STRINGS.months));
    setText(this.shipLine, STRINGS.hud.shipLine(voyage.shipName, cls.name, condition.gunsIntact));
    setText(this.gold, STRINGS.hud.gold(formatGold(voyage.gold)));
    setText(this.crew, STRINGS.hud.crew(condition.crew, cls.crewMax));
    const hull = displayPct(condition.hullPct);
    const rigging = displayPct(condition.riggingPct);
    this.hullBar.set(hull, STRINGS.hud.barLabel(STRINGS.hud.hull, hull));
    this.riggingBar.set(rigging, STRINGS.hud.barLabel(STRINGS.hud.rigging, rigging));
    const lines = helmLines(voyage.ship, wind);
    lines.forEach((line, i) => setText(this.lines[i]!, line));
  }
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}
