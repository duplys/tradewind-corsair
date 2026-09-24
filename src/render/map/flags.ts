// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS } from '../../data/nations';
import type { Port } from '../../sim/world/ports';
import type { CameraOffset } from '../camera';
import { FLAG_POLE } from '../palette';

const POLE_HEIGHT_PX = 4;
const WAVE_PERIOD_SEC = 0.4;

/**
 * Town flags (slice 1 spec §8.3 step 4): a 4-px pole above the fort and a 3×2 flag in the
 * nation's colours. The fly end dips by one pixel every other 0.4 s so the flag waves.
 */
export function drawFlags(
  ctx: CanvasRenderingContext2D,
  cam: CameraOffset,
  ports: readonly Port[],
  timeSec: number,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const dip = Math.floor(timeSec / WAVE_PERIOD_SEC) % 2;
  for (const port of ports) {
    const x = Math.floor(port.town.x) - cam.x;
    const top = Math.floor(port.town.y) - cam.y - 1 - POLE_HEIGHT_PX; // above the 3×3 fort
    if (x < -4 || x > w + 4 || top < -4 || top > h + 8) continue;
    ctx.fillStyle = FLAG_POLE;
    ctx.fillRect(x, top, 1, POLE_HEIGHT_PX);
    const flag = NATIONS[port.def.nation].flag;
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.fillStyle = flag[row * 3 + col]!;
        ctx.fillRect(x + 1 + col, top + row + (col === 2 ? dip : 0), 1, 1);
      }
    }
  }
}
