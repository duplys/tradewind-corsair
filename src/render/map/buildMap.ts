// SPDX-License-Identifier: GPL-3.0-only
import type { Port } from '../../sim/world/ports';
import type { World } from '../../sim/world/world';
import { computeMapPixels } from './mapPixels';
import { stampTowns } from './towns';

/** Render the whole world, towns included, once into an offscreen canvas of world size. */
export function createMapCanvas(
  world: World,
  ports: readonly Port[],
  seed: number,
): HTMLCanvasElement {
  const started = performance.now();
  const canvas = document.createElement('canvas');
  canvas.width = world.width;
  canvas.height = world.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');
  const image = ctx.createImageData(world.width, world.height);
  const pixels = computeMapPixels(world, seed);
  stampTowns(pixels, world, ports, seed);
  image.data.set(pixels);
  ctx.putImageData(image, 0, 0);
  if (import.meta.env.DEV) {
    console.info(`Map rendered in ${Math.round(performance.now() - started)} ms`);
  }
  return canvas;
}
