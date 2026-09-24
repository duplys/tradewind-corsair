// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { quantiseAndOutline, type Rgb } from '../../src/render/sprites/pixelArt';
import { spriteIndex } from '../../src/render/sprites/ship';

describe('spriteIndex', () => {
  it('maps headings to 32 sprite slots', () => {
    expect(spriteIndex(0)).toBe(0);
    expect(spriteIndex(Math.PI / 2)).toBe(8);
    expect(spriteIndex(Math.PI)).toBe(16);
    expect(spriteIndex(-Math.PI / 2)).toBe(24);
    expect(spriteIndex(-0.01)).toBe(0);
    expect(spriteIndex(-Math.PI)).toBe(16);
  });
});

describe('quantiseAndOutline', () => {
  it('snaps opaque pixels to the palette, clears faint ones and outlines the shape', () => {
    const w = 3;
    const h = 3;
    const data = new Uint8ClampedArray(w * h * 4);
    // Centre pixel: nearly red, alpha 200. Corner pixel: faint green.
    data.set([250, 10, 5, 200], 4 * 4);
    data.set([0, 255, 0, 100], 0);
    const palette: Rgb[] = [
      [255, 0, 0],
      [0, 0, 255],
    ];
    quantiseAndOutline(data, w, h, palette, [1, 2, 3]);
    expect([...data.subarray(16, 20)]).toEqual([255, 0, 0, 255]);
    expect([...data.subarray(4, 8)]).toEqual([1, 2, 3, 255]); // above the centre
    expect([...data.subarray(0, 4)]).toEqual([0, 0, 0, 0]); // diagonal: not outlined
  });
});
