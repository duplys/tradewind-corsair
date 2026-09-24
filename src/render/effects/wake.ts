// SPDX-License-Identifier: GPL-3.0-only
import { PENNANT_COLOR, WAKE_COLOR } from '../palette';
import type { CameraOffset } from '../camera';

const EMIT_INTERVAL_SEC = 0.08;
const LIFETIME_SEC = 2.5;
const MIN_SPEED_KN = 1;
/** Distance from the ship's centre to its stern, in world px. */
export const STERN_OFFSET_PX = 8;
const PENNANT_FLICKS_PER_SEC = 6;
const CAPACITY = Math.ceil(LIFETIME_SEC / EMIT_INTERVAL_SEC) + 2;

interface WakeSource {
  readonly x: number;
  readonly y: number;
  readonly headingRad: number;
  readonly speedKn: number;
}

/**
 * A V-shaped wake (spec §8.3 step 3): points recorded at the stern that spread sideways as they
 * age. Fixed-size ring buffer, so no per-frame allocation.
 */
export class Wake {
  private readonly x = new Float32Array(CAPACITY);
  private readonly y = new Float32Array(CAPACITY);
  private readonly nx = new Float32Array(CAPACITY);
  private readonly ny = new Float32Array(CAPACITY);
  private readonly born = new Float64Array(CAPACITY).fill(-Infinity);
  private next = 0;
  private sinceEmitSec = 0;

  update(nowSec: number, dtSec: number, ship: WakeSource): void {
    this.sinceEmitSec += dtSec;
    if (ship.speedKn <= MIN_SPEED_KN || this.sinceEmitSec < EMIT_INTERVAL_SEC) return;
    this.sinceEmitSec = 0;
    const cos = Math.cos(ship.headingRad);
    const sin = Math.sin(ship.headingRad);
    const i = this.next;
    this.x[i] = ship.x - cos * STERN_OFFSET_PX;
    this.y[i] = ship.y - sin * STERN_OFFSET_PX;
    this.nx[i] = -sin;
    this.ny[i] = cos;
    this.born[i] = nowSec;
    this.next = (i + 1) % CAPACITY;
  }

  clear(): void {
    this.born.fill(-Infinity);
  }

  draw(ctx: CanvasRenderingContext2D, cam: CameraOffset, nowSec: number): void {
    ctx.fillStyle = WAKE_COLOR;
    for (let i = 0; i < CAPACITY; i++) {
      const age = nowSec - this.born[i]!;
      if (age < 0 || age >= LIFETIME_SEC) continue;
      ctx.globalAlpha = 1 - age / LIFETIME_SEC;
      const spread = 1 + age * 2;
      const x = this.x[i]! - cam.x;
      const y = this.y[i]! - cam.y;
      const ox = this.nx[i]! * spread;
      const oy = this.ny[i]! * spread;
      ctx.fillRect(Math.round(x + ox), Math.round(y + oy), 1, 1);
      ctx.fillRect(Math.round(x - ox), Math.round(y - oy), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

/** A 2×1 px red pennant at the stern that flickers (spec §8.3 step 5). */
export function drawPennant(
  ctx: CanvasRenderingContext2D,
  cam: CameraOffset,
  ship: WakeSource,
  nowSec: number,
): void {
  const cos = Math.cos(ship.headingRad);
  const sin = Math.sin(ship.headingRad);
  const sx = Math.round(ship.x - cos * (STERN_OFFSET_PX - 1)) - cam.x;
  const sy = Math.round(ship.y - sin * (STERN_OFFSET_PX - 1)) - cam.y;
  // The fly streams aft, flicking one pixel to the side every other tick.
  const side = Math.floor(nowSec * PENNANT_FLICKS_PER_SEC) % 2;
  ctx.fillStyle = PENNANT_COLOR;
  ctx.fillRect(sx, sy, 1, 1);
  ctx.fillRect(sx - Math.round(cos + side * sin), sy - Math.round(sin - side * cos), 1, 1);
}
