// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS } from '../data/nations';
import { STRINGS } from '../data/strings';
import { LAT_MAX, LAT_MIN, LON_MAX, LON_MIN, PPD } from '../data/world';
import { bearingToCompass16 } from '../sim/math';
import type { PlayerShip } from '../sim/sailing/ship';
import { fromBearingDeg, type Wind } from '../sim/sailing/wind';
import type { Port } from '../sim/world/ports';
import { CHART_COLORS } from './palette';

const GRATICULE_STEP_DEG = 5;
const BLINK_PER_SEC = 2;

export interface ChartLayout {
  /** Device px per world px. */
  readonly scale: number;
  /** Device-px position of the map's top-left corner. */
  readonly ox: number;
  readonly oy: number;
  readonly mapW: number;
  readonly mapH: number;
}

/** Fit the world into a canvas, leaving `margin` on every side for edge labels. */
export function chartLayout(
  canvasW: number,
  canvasH: number,
  margin: number,
  worldW: number,
  worldH: number,
): ChartLayout {
  const scale = Math.max(
    0,
    Math.min((canvasW - 2 * margin) / worldW, (canvasH - 2 * margin) / worldH),
  );
  const mapW = worldW * scale;
  const mapH = worldH * scale;
  return { scale, ox: (canvasW - mapW) / 2, oy: (canvasH - mapH) / 2, mapW, mapH };
}

/** A ship shown on the chart as a small dot (slice 2 spec §4.5). World px. */
export interface ChartDot {
  readonly x: number;
  readonly y: number;
  readonly color: string;
}

export interface ChartStatic {
  readonly map: HTMLCanvasElement;
  readonly ports: readonly Port[];
  readonly wind: Wind;
  readonly npcDots: readonly ChartDot[];
}

function periodFont(sizePx: number, smallCaps = false): string {
  return smallCaps
    ? `${sizePx}px 'IM Fell English SC', Georgia, serif`
    : `${sizePx}px 'IM Fell English', Georgia, serif`;
}

/** Everything that does not move while the chart is open: map, frame, graticule, ports, wind. */
export function drawChartStatic(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  dpr: number,
  data: ChartStatic,
): void {
  const { scale, ox, oy, mapW, mapH } = layout;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(data.map, ox, oy, mapW, mapH);

  // Graticule every 5°, labelled on the bottom and left edges.
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.lineWidth = dpr;
  ctx.fillStyle = CHART_COLORS.ink;
  ctx.font = periodFont(11 * dpr);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (
    let lon = Math.ceil(LON_MIN / GRATICULE_STEP_DEG) * GRATICULE_STEP_DEG;
    lon < LON_MAX;
    lon += GRATICULE_STEP_DEG
  ) {
    const x = Math.round(ox + (lon - LON_MIN) * PPD * scale) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, oy);
    ctx.lineTo(x, oy + mapH);
    ctx.stroke();
    ctx.fillText(STRINGS.chart.lon(-lon), x, oy + mapH + 4 * dpr);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (
    let lat = Math.ceil(LAT_MIN / GRATICULE_STEP_DEG) * GRATICULE_STEP_DEG;
    lat < LAT_MAX;
    lat += GRATICULE_STEP_DEG
  ) {
    if (lat <= LAT_MIN) continue;
    const y = Math.round(oy + (LAT_MAX - lat) * PPD * scale) + 0.5;
    ctx.beginPath();
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + mapW, y);
    ctx.stroke();
    ctx.fillText(STRINGS.chart.lat(lat), ox - 4 * dpr, y);
  }

  ctx.strokeStyle = CHART_COLORS.frame;
  ctx.lineWidth = 2 * dpr;
  ctx.strokeRect(ox - dpr, oy - dpr, mapW + 2 * dpr, mapH + 2 * dpr);

  // Ports: a dot in the nation's colour and the name beside it.
  ctx.font = periodFont(12 * dpr);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const port of data.ports) {
    const x = ox + port.town.x * scale;
    const y = oy + port.town.y * scale;
    ctx.fillStyle = NATIONS[port.def.nation].color;
    ctx.strokeStyle = CHART_COLORS.ink;
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = CHART_COLORS.halo;
    ctx.lineWidth = 3 * dpr;
    ctx.strokeText(port.def.name, x + 6 * dpr, y);
    ctx.fillStyle = CHART_COLORS.ink;
    ctx.fillText(port.def.name, x + 6 * dpr, y);
  }

  // Other ships nearby: small dots in their colours, without names.
  ctx.strokeStyle = CHART_COLORS.ink;
  ctx.lineWidth = dpr;
  for (const dot of data.npcDots) {
    ctx.fillStyle = dot.color;
    ctx.beginPath();
    ctx.arc(ox + dot.x * scale, oy + dot.y * scale, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  drawWindRose(ctx, ox + mapW - 34 * dpr, oy + 34 * dpr, 24 * dpr, dpr, data.wind);
}

function drawWindRose(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  dpr: number,
  wind: Wind,
): void {
  ctx.fillStyle = CHART_COLORS.roseFill;
  ctx.strokeStyle = CHART_COLORS.frame;
  ctx.lineWidth = 1.5 * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = CHART_COLORS.ink;
  ctx.lineWidth = dpr;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const inner = r * (i % 2 === 0 ? 0.72 : 0.84);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.fillStyle = CHART_COLORS.ink;
  ctx.font = periodFont(11 * dpr, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(STRINGS.chart.north, cx, cy - r - 2 * dpr);

  // Arrow in the direction the wind blows.
  const dx = Math.cos(wind.towardRad);
  const dy = Math.sin(wind.towardRad);
  const len = r * 0.62;
  ctx.strokeStyle = CHART_COLORS.wind;
  ctx.fillStyle = CHART_COLORS.wind;
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.moveTo(cx - dx * len, cy - dy * len);
  ctx.lineTo(cx + dx * (len - 4 * dpr), cy + dy * (len - 4 * dpr));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + dx * len, cy + dy * len);
  ctx.lineTo(cx + dx * (len - 7 * dpr) - dy * 4 * dpr, cy + dy * (len - 7 * dpr) + dx * 4 * dpr);
  ctx.lineTo(cx + dx * (len - 7 * dpr) + dy * 4 * dpr, cy + dy * (len - 7 * dpr) - dx * 4 * dpr);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = CHART_COLORS.ink;
  ctx.font = periodFont(11 * dpr);
  ctx.textBaseline = 'top';
  ctx.fillText(
    STRINGS.hud.wind(bearingToCompass16(fromBearingDeg(wind)), Math.round(wind.speedKn)),
    cx,
    cy + r + 3 * dpr,
  );
}

/** The ship as a blinking brass marker. */
export function drawChartShip(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  dpr: number,
  ship: PlayerShip,
  timeSec: number,
): void {
  if (Math.floor(timeSec * BLINK_PER_SEC) % 2 === 1) return;
  const x = layout.ox + ship.x * layout.scale;
  const y = layout.oy + ship.y * layout.scale;
  ctx.strokeStyle = CHART_COLORS.ink;
  ctx.lineWidth = 3.5 * dpr;
  ctx.beginPath();
  ctx.arc(x, y, 6 * dpr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = CHART_COLORS.ship;
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();
  ctx.fillStyle = CHART_COLORS.ship;
  ctx.beginPath();
  ctx.arc(x, y, 2 * dpr, 0, Math.PI * 2);
  ctx.fill();
}
