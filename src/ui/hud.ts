// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import { SHIP_CLASSES } from '../data/ships';
import type { PlayerShip } from '../sim/sailing/ship';
import type { Wind } from '../sim/sailing/wind';
import { formatDate } from '../sim/time';
import { drawCompass } from './compass';
import { helmLines } from './helmText';

const COMPASS_CSS_PX = 72;
const TEXT_UPDATE_INTERVAL_SEC = 0.1;

export interface HudState {
  readonly ship: PlayerShip;
  readonly wind: Wind;
  readonly elapsedHours: number;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

/** Sailing HUD (slice 1 spec §9.1): the ledger panel top-left and the helm panel top-right. */
export class Hud {
  private readonly root = el('div', 'hud');
  private readonly date = el('div', 'ledger-date');
  private readonly shipLine = el('div', 'ledger-ship');
  private readonly compass = el('canvas', 'compass');
  private readonly compassCtx: CanvasRenderingContext2D;
  private readonly lines: HTMLDivElement[] = [];
  private lastTextSec = -Infinity;
  private dpr = 0;

  constructor() {
    this.root.hidden = true;

    const ledger = el('section', 'panel ledger');
    const chart = el('button', 'hud-button');
    chart.type = 'button';
    chart.disabled = true;
    const caption = el('small', 'caption');
    caption.textContent = STRINGS.hud.comingSoon;
    chart.append(STRINGS.hud.chart, caption);
    ledger.append(this.date, this.shipLine, chart);

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

  /** Redraw the compass every frame; refresh text at most 10 times per second. */
  update(state: HudState, nowSec: number): void {
    const dpr = window.devicePixelRatio || 1;
    if (dpr !== this.dpr) {
      this.dpr = dpr;
      this.compass.width = this.compass.height = Math.round(COMPASS_CSS_PX * dpr);
    }
    drawCompass(this.compassCtx, this.compass.width, state.ship.headingRad, state.wind.towardRad);

    if (nowSec - this.lastTextSec < TEXT_UPDATE_INTERVAL_SEC) return;
    this.lastTextSec = nowSec;
    const cls = SHIP_CLASSES[state.ship.classId];
    setText(this.date, formatDate(state.elapsedHours, STRINGS.months));
    setText(this.shipLine, STRINGS.hud.shipLine(cls.name, cls.guns));
    const lines = helmLines(state.ship, state.wind);
    lines.forEach((line, i) => setText(this.lines[i]!, line));
  }
}

function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}
