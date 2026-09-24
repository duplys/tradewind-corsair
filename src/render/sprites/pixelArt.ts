// SPDX-License-Identifier: GPL-3.0-only

export type Rgb = readonly [number, number, number];

/**
 * Turn anti-aliased drawing into crisp pixel art in place: pixels with alpha ≥ threshold snap to
 * the nearest palette colour and become opaque, the rest become transparent, and transparent
 * pixels that touch an opaque one (4-neighbourhood) become the outline colour.
 */
export function quantiseAndOutline(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  palette: readonly Rgb[],
  outline: Rgb,
  alphaThreshold = 128,
): void {
  const opaque = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    if (data[o + 3]! < alphaThreshold) {
      data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
      continue;
    }
    let best = palette[0]!;
    let bestD = Infinity;
    for (const c of palette) {
      const d = (data[o]! - c[0]) ** 2 + (data[o + 1]! - c[1]) ** 2 + (data[o + 2]! - c[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    data[o] = best[0];
    data[o + 1] = best[1];
    data[o + 2] = best[2];
    data[o + 3] = 255;
    opaque[i] = 1;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (opaque[i]) continue;
      const touches =
        (x > 0 && opaque[i - 1] === 1) ||
        (x < width - 1 && opaque[i + 1] === 1) ||
        (y > 0 && opaque[i - width] === 1) ||
        (y < height - 1 && opaque[i + width] === 1);
      if (!touches) continue;
      const o = i * 4;
      data[o] = outline[0];
      data[o + 1] = outline[1];
      data[o + 2] = outline[2];
      data[o + 3] = 255;
    }
  }
}
