// SPDX-License-Identifier: GPL-3.0-only
import type { HeldActions } from '../../input/actions';
import { computeCamera } from '../../render/camera';
import { drawMapSlice } from '../../render/map/drawMap';
import { DEEP_SEA } from '../../render/palette';
import { lonLatToWorld } from '../../sim/world/projection';
import type { World } from '../../sim/world/world';
import type { Mode } from './mode';

/** Temporary (M2): the arrow keys pan the camera at this speed, in world px per second. */
const PAN_SPEED_PX_PER_SEC = 240;
const START_LON_LAT = [-59.62, 13.1] as const;

export interface SailingDeps {
  readonly world: World;
  readonly map: HTMLCanvasElement;
  readonly held: Readonly<HeldActions>;
}

export class SailingMode implements Mode {
  readonly id = 'sailing';
  private focusX: number;
  private focusY: number;

  constructor(private readonly deps: SailingDeps) {
    const start = lonLatToWorld(START_LON_LAT[0], START_LON_LAT[1]);
    this.focusX = start.x;
    this.focusY = start.y;
  }

  enter(): void {}

  exit(): void {}

  handleAction(): void {}

  update(dtSec: number): void {
    const { held, world } = this.deps;
    const step = PAN_SPEED_PX_PER_SEC * dtSec;
    if (held.turnLeft) this.focusX -= step;
    if (held.turnRight) this.focusX += step;
    if (held.hoist) this.focusY -= step;
    if (held.reef) this.focusY += step;
    this.focusX = Math.min(Math.max(this.focusX, 0), world.width);
    this.focusY = Math.min(Math.max(this.focusY, 0), world.height);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { world, map } = this.deps;
    ctx.fillStyle = DEEP_SEA;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const cam = computeCamera(
      this.focusX,
      this.focusY,
      ctx.canvas.width,
      ctx.canvas.height,
      world.width,
      world.height,
    );
    drawMapSlice(ctx, map, cam);
  }
}
