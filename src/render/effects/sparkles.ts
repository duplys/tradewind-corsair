// SPDX-License-Identifier: GPL-3.0-only
import { hash2 } from '../../sim/rng';
import { distToLandAt, type World } from '../../sim/world/world';
import type { CameraOffset } from '../camera';
import { SPARKLE_COLOR } from '../palette';

/** Sea sparkles (slice 1 spec §8.3 step 2). */
const CELL_PX = 12;
const CYCLES_PER_SEC = 0.5;
const VISIBLE_FRACTION = 0.3;
const DRIFT_PX = 3;
const MIN_DIST_TO_LAND_PX = 5;
const SEED = 0x5ea;

/**
 * Where a sparkle is in its life: progress in [0, 1) while visible, or −1 while hidden.
 * Visible when (t·0.5 + phase) mod 1 < 0.3.
 */
export function sparkleProgress(phase: number, timeSec: number): number {
  const cycle = (timeSec * CYCLES_PER_SEC + phase) % 1;
  return cycle < VISIBLE_FRACTION ? cycle / VISIBLE_FRACTION : -1;
}

/**
 * Each 12-px world cell hashes to a fixed spot and phase; a 3×1 highlight appears there away
 * from land and drifts up to 3 px downwind over its life. Anchored to the world, not the screen.
 */
export function drawSparkles(
  ctx: CanvasRenderingContext2D,
  cam: CameraOffset,
  world: World,
  timeSec: number,
  windTowardRad: number,
): void {
  const wx = Math.cos(windTowardRad) * DRIFT_PX;
  const wy = Math.sin(windTowardRad) * DRIFT_PX;
  const firstCol = Math.max(0, Math.floor(cam.x / CELL_PX));
  const firstRow = Math.max(0, Math.floor(cam.y / CELL_PX));
  const lastCol = Math.min(
    Math.ceil(world.width / CELL_PX),
    Math.ceil((cam.x + ctx.canvas.width) / CELL_PX),
  );
  const lastRow = Math.min(
    Math.ceil(world.height / CELL_PX),
    Math.ceil((cam.y + ctx.canvas.height) / CELL_PX),
  );
  ctx.fillStyle = SPARKLE_COLOR;
  for (let row = firstRow; row < lastRow; row++) {
    for (let col = firstCol; col < lastCol; col++) {
      const progress = sparkleProgress(hash2(col, row, SEED + 2), timeSec);
      if (progress < 0) continue;
      const x = col * CELL_PX + Math.floor(hash2(col, row, SEED) * CELL_PX);
      const y = row * CELL_PX + Math.floor(hash2(col, row, SEED + 1) * CELL_PX);
      if (distToLandAt(world, x, y) <= MIN_DIST_TO_LAND_PX) continue;
      ctx.fillRect(
        Math.round(x + wx * progress) - cam.x - 1,
        Math.round(y + wy * progress) - cam.y,
        3,
        1,
      );
    }
  }
}
