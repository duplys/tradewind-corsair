// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { PORTS } from '../../src/data/ports';
import { stampTowns } from '../../src/render/map/towns';
import { hexToRgb, TOWN_COLORS } from '../../src/render/palette';
import type { Port } from '../../src/sim/world/ports';
import { fillPolygon } from '../../src/sim/world/rasterise';
import { createWorld } from '../../src/sim/world/world';

function setup() {
  const w = 40;
  const h = 40;
  const mask = new Uint8Array(w * h);
  fillPolygon(mask, w, h, [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 40 },
    { x: 0, y: 40 },
  ]);
  const world = createWorld(w, h, mask);
  const port: Port = { def: PORTS[0]!, town: { x: 18.5, y: 20.5 }, harbour: { x: 24.5, y: 20.5 } };
  return { world, port };
}

const rgbAt = (px: Uint8ClampedArray, w: number, x: number, y: number) => {
  const o = (y * w + x) * 4;
  return [px[o], px[o + 1], px[o + 2]];
};

describe('stampTowns', () => {
  it('draws a fort with a gate and 4–6 houses on land only, deterministically', () => {
    const { world, port } = setup();
    const px = new Uint8ClampedArray(world.width * world.height * 4);
    stampTowns(px, world, [port], 7);

    expect(rgbAt(px, world.width, 18, 20)).toEqual([...hexToRgb(TOWN_COLORS.fort)]);
    expect(rgbAt(px, world.width, 18, 21)).toEqual([...hexToRgb(TOWN_COLORS.gate)]);

    const house = [hexToRgb(TOWN_COLORS.roof), hexToRgb(TOWN_COLORS.wall)].map((c) => [...c]);
    let houses = 0;
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        if (!house.some((c) => c.join() === rgbAt(px, world.width, x, y).join())) continue;
        houses++;
        expect(world.landMask[y * world.width + x]).toBe(1);
        expect(Math.abs(x - 18)).toBeLessThanOrEqual(3);
        expect(Math.abs(y - 20)).toBeLessThanOrEqual(3);
      }
    }
    expect(houses).toBeGreaterThanOrEqual(4);
    expect(houses).toBeLessThanOrEqual(6);

    const again = new Uint8ClampedArray(px.length);
    stampTowns(again, world, [port], 7);
    expect(again).toEqual(px);
  });
});
