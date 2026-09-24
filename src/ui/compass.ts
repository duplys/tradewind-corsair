// SPDX-License-Identifier: GPL-3.0-only
import { NO_GO_HALF_ANGLE_DEG } from '../data/sailing';
import { COMPASS_COLORS } from '../render/palette';

const NO_GO_HALF_RAD = (NO_GO_HALF_ANGLE_DEG * Math.PI) / 180;
const NORTH = -Math.PI / 2;

/**
 * Draw the helm compass (slice 1 spec §9.1). Angles are in screen convention, which maps
 * directly onto canvas angles with north up. `size` is the canvas size in device pixels.
 */
export function drawCompass(
  ctx: CanvasRenderingContext2D,
  size: number,
  headingRad: number,
  windTowardRad: number,
): void {
  const c = size / 2;
  const r = size / 2 - size * 0.04;
  const px = size / 72; // one CSS px at the design size
  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = COMPASS_COLORS.face;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();

  // No-go wedge around the direction the wind comes from.
  const upwind = windTowardRad + Math.PI;
  ctx.fillStyle = COMPASS_COLORS.noGo;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.arc(c, c, r - 2 * px, upwind - NO_GO_HALF_RAD, upwind + NO_GO_HALF_RAD);
  ctx.closePath();
  ctx.fill();

  // Ring and 16 ticks (longer at the cardinal points).
  ctx.strokeStyle = COMPASS_COLORS.ring;
  ctx.lineWidth = 2 * px;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = COMPASS_COLORS.tick;
  for (let i = 0; i < 16; i++) {
    const a = NORTH + (i * Math.PI) / 8;
    const inner = r - (i % 4 === 0 ? 7 : i % 2 === 0 ? 5 : 3) * px;
    ctx.lineWidth = (i % 4 === 0 ? 1.5 : 1) * px;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner);
    ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.fillStyle = COMPASS_COLORS.north;
  ctx.font = `${11 * px}px 'IM Fell English SC', Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', c, c - r + 13 * px);

  // Wind arrow across the dial, pointing where the wind blows.
  const wx = Math.cos(windTowardRad);
  const wy = Math.sin(windTowardRad);
  const len = r * 0.72;
  ctx.strokeStyle = COMPASS_COLORS.wind;
  ctx.fillStyle = COMPASS_COLORS.wind;
  ctx.lineWidth = 1.5 * px;
  ctx.beginPath();
  ctx.moveTo(c - wx * len, c - wy * len);
  ctx.lineTo(c + wx * (len - 5 * px), c + wy * (len - 5 * px));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c + wx * len, c + wy * len);
  ctx.lineTo(c + wx * (len - 7 * px) - wy * 4 * px, c + wy * (len - 7 * px) + wx * 4 * px);
  ctx.lineTo(c + wx * (len - 7 * px) + wy * 4 * px, c + wy * (len - 7 * px) - wx * 4 * px);
  ctx.closePath();
  ctx.fill();

  // Heading needle with a short tail.
  const hx = Math.cos(headingRad);
  const hy = Math.sin(headingRad);
  ctx.strokeStyle = COMPASS_COLORS.needle;
  ctx.lineWidth = 2.5 * px;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c - hx * r * 0.25, c - hy * r * 0.25);
  ctx.lineTo(c + hx * r * 0.8, c + hy * r * 0.8);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = COMPASS_COLORS.hub;
  ctx.strokeStyle = COMPASS_COLORS.needle;
  ctx.lineWidth = 1 * px;
  ctx.beginPath();
  ctx.arc(c, c, 3 * px, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
