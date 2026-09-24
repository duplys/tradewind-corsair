// SPDX-License-Identifier: GPL-3.0-only
import type { World } from '../../sim/world/world';

/** Draw the land mask as a black (water) and white (land) canvas. Debug view for M1. */
export function createMaskCanvas(world: World): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = world.width;
  canvas.height = world.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');
  const image = ctx.createImageData(world.width, world.height);
  const px = new Uint32Array(image.data.buffer);
  for (let i = 0; i < world.landMask.length; i++) {
    px[i] = world.landMask[i] === 1 ? 0xffffffff : 0xff000000;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
