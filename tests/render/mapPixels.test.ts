// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { computeMapPixels } from '../../src/render/map/mapPixels';
import { hexToRgb, SAND, WATER_BANDS } from '../../src/render/palette';
import { fillPolygon } from '../../src/sim/world/rasterise';
import { createWorld } from '../../src/sim/world/world';

function smallWorld() {
  const w = 120;
  const h = 120;
  const mask = new Uint8Array(w * h);
  fillPolygon(mask, w, h, [
    { x: 0, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 30 },
    { x: 0, y: 30 },
  ]);
  return createWorld(w, h, mask);
}

const rgbAt = (px: Uint8ClampedArray, w: number, x: number, y: number) => {
  const o = (y * w + x) * 4;
  return [px[o], px[o + 1], px[o + 2]];
};

describe('computeMapPixels', () => {
  const world = smallWorld();
  const px = computeMapPixels(world, 1);

  it('is deterministic for a seed', () => {
    expect(computeMapPixels(world, 1)).toEqual(px);
  });

  it('paints far water as deep ocean', () => {
    expect(rgbAt(px, world.width, 110, 110)).toEqual([...hexToRgb(WATER_BANDS.at(-1)!.color)]);
  });

  it('paints the land edge as sand and the water edge as surf or shallows', () => {
    expect(rgbAt(px, world.width, 29, 15)).toEqual([...hexToRgb(SAND)]);
    const edge = rgbAt(px, world.width, 30, 15);
    const expected = [WATER_BANDS[0]!.color, WATER_BANDS[1]!.color].map((c) => [...hexToRgb(c)]);
    expect(expected).toContainEqual(edge);
  });

  it('is fully opaque', () => {
    for (let i = 3; i < px.length; i += 4) if (px[i] !== 255) throw new Error(`alpha at ${i}`);
  });
});
