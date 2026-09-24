// SPDX-License-Identifier: GPL-3.0-only
import type { PlayerShip } from '../sim/sailing/ship';
import type { Port } from '../sim/world/ports';
import type { World } from '../sim/world/world';
import { computeCamera, type CameraOffset } from './camera';
import { drawPennant, type Wake } from './effects/wake';
import type { LabelLayer } from './labels';
import { drawFlags } from './map/flags';
import { drawMapSlice } from './map/drawMap';
import { DEEP_SEA } from './palette';
import { SHIP_SPRITE_SIZE, spriteIndex, type ShipSprites } from './sprites/ship';
import type { View } from './view';

/** Everything needed to draw the sea around the ship. Shared by the sailing and port modes. */
export interface SeaScene {
  readonly world: World;
  readonly map: HTMLCanvasElement;
  readonly sprites: ShipSprites;
  readonly ports: readonly Port[];
  readonly view: View;
  readonly labels: LabelLayer;
}

/** Draw map, wake, flags, ship and labels, centred on the ship (spec §8.3). */
export function drawSeaScene(
  scene: SeaScene,
  ship: PlayerShip,
  timeSec: number,
  wake: Wake | null,
): CameraOffset {
  const { ctx } = scene.view;
  const { world } = scene;
  ctx.fillStyle = DEEP_SEA;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const cam = computeCamera(
    ship.x,
    ship.y,
    ctx.canvas.width,
    ctx.canvas.height,
    world.width,
    world.height,
  );
  drawMapSlice(ctx, scene.map, cam);
  wake?.draw(ctx, cam, timeSec);
  drawFlags(ctx, cam, scene.ports, timeSec);

  const frames = ship.sail === 'furled' ? scene.sprites.furled : scene.sprites.set;
  const sprite = frames[spriteIndex(ship.headingRad)]!;
  const half = SHIP_SPRITE_SIZE / 2;
  ctx.drawImage(sprite, Math.round(ship.x) - cam.x - half, Math.round(ship.y) - cam.y - half);
  drawPennant(ctx, cam, ship, timeSec);

  scene.labels.draw(cam, scene.view.scale, scene.ports);
  return cam;
}
