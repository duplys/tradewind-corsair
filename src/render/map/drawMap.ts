// SPDX-License-Identifier: GPL-3.0-only
import type { CameraOffset } from '../camera';

/** Draw the visible slice of the pre-rendered map at the camera offset. */
export function drawMapSlice(
  ctx: CanvasRenderingContext2D,
  map: HTMLCanvasElement,
  cam: CameraOffset,
): void {
  const sx = Math.max(cam.x, 0);
  const sy = Math.max(cam.y, 0);
  const sw = Math.min(ctx.canvas.width + Math.min(cam.x, 0), map.width - sx);
  const sh = Math.min(ctx.canvas.height + Math.min(cam.y, 0), map.height - sy);
  if (sw <= 0 || sh <= 0) return;
  ctx.drawImage(map, sx, sy, sw, sh, sx - cam.x, sy - cam.y, sw, sh);
}
