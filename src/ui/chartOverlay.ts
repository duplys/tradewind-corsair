// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import { NATIONS } from '../data/nations';
import { NPC_CHART_RANGE_PX } from '../data/npc';
import {
  chartLayout,
  drawChartShip,
  drawChartStatic,
  type ChartDot,
  type ChartLayout,
} from '../render/chart';
import { PIRATE_CHART_COLOR } from '../render/palette';
import type { NpcShip } from '../sim/npc/npc';
import type { ReducedMotion } from '../render/motion';
import type { PlayerShip } from '../sim/sailing/ship';
import type { Wind } from '../sim/sailing/wind';
import type { Port } from '../sim/world/ports';
import type { World } from '../sim/world/world';
import { button, el } from './dom';

/** Space kept around the map for the degree labels, in CSS px. */
const LABEL_MARGIN_CSS = 30;

/**
 * Full-screen chart (slice 1 spec §9.3): parchment, the whole map, graticule, ports, wind rose,
 * title and date, and a blinking marker for the ship. The static part is drawn once per open
 * or resize; each frame only composites it and the marker.
 */
export class ChartOverlay {
  private readonly root = el('div', 'chart-overlay');
  private readonly date = el('p', 'chart-date');
  private readonly wrap = el('div', 'chart-canvas-wrap');
  private readonly canvas = el('canvas', 'chart-canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly staticLayer = document.createElement('canvas');
  private layout: ChartLayout | null = null;
  private dpr = 1;
  private ship: PlayerShip | null = null;
  private wind: Wind | null = null;
  private npcDots: readonly ChartDot[] = [];

  constructor(
    private readonly world: World,
    private readonly map: HTMLCanvasElement,
    private readonly ports: readonly Port[],
    private readonly reducedMotion: ReducedMotion,
    onClose: () => void,
  ) {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    const heading = el('h2', 'chart-heading', STRINGS.chart.heading);
    heading.id = 'chart-heading';
    this.root.setAttribute('aria-labelledby', heading.id);
    const close = button('parchment-button chart-close', STRINGS.chart.close);
    close.addEventListener('click', onClose);
    const header = el('header', 'chart-header');
    const titles = el('div', 'chart-titles');
    titles.append(heading, this.date);
    header.append(titles, close);
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', STRINGS.chart.heading);
    this.wrap.append(this.canvas);
    this.root.append(header, this.wrap);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');
    this.ctx = ctx;
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  show(ship: PlayerShip, wind: Wind, dateText: string, npcs: readonly NpcShip[]): void {
    this.ship = ship;
    this.wind = wind;
    this.npcDots = npcs
      .filter((n) => Math.hypot(n.ship.x - ship.x, n.ship.y - ship.y) <= NPC_CHART_RANGE_PX)
      .map((n) => ({
        x: n.ship.x,
        y: n.ship.y,
        color: n.nation === 'pirate' ? PIRATE_CHART_COLOR : NATIONS[n.nation].color,
      }));
    this.date.textContent = dateText;
    this.root.hidden = false;
    this.relayout();
  }

  hide(): void {
    this.root.hidden = true;
    this.ship = null;
  }

  /** Size the canvas to its container and redraw the static layer. Call on open and resize. */
  relayout(): void {
    if (this.root.hidden || !this.wind) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.wrap.clientWidth;
    const cssH = this.wrap.clientHeight;
    this.dpr = dpr;
    this.canvas.width = this.staticLayer.width = Math.round(cssW * dpr);
    this.canvas.height = this.staticLayer.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.layout = chartLayout(
      this.canvas.width,
      this.canvas.height,
      LABEL_MARGIN_CSS * dpr,
      this.world.width,
      this.world.height,
    );
    const staticCtx = this.staticLayer.getContext('2d');
    if (!staticCtx) return;
    drawChartStatic(staticCtx, this.layout, dpr, {
      map: this.map,
      ports: this.ports,
      wind: this.wind,
      npcDots: this.npcDots,
    });
  }

  render(timeSec: number): void {
    if (!this.layout || !this.ship) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.staticLayer, 0, 0);
    // The marker blinks to draw the eye; under reduced motion it stays lit.
    const blinkTime = this.reducedMotion() ? 0 : timeSec;
    drawChartShip(this.ctx, this.layout, this.dpr, this.ship, blinkTime);
  }
}
