// SPDX-License-Identifier: GPL-3.0-only

const DIAGONAL = Math.SQRT2;
/** Distance assigned when no feature pixel exists at all. */
export const NO_FEATURE_DISTANCE = 1e9;

/**
 * Two-pass chamfer distance transform (weights 1 and √2). Returns, for every pixel, the
 * distance to the nearest pixel whose mask value equals `featureValue` (0 on those pixels).
 */
export function chamferDistance(
  mask: Uint8Array,
  width: number,
  height: number,
  featureValue: 0 | 1,
): Float32Array {
  const dist = new Float32Array(width * height);
  for (let i = 0; i < dist.length; i++) {
    dist[i] = mask[i] === featureValue ? 0 : NO_FEATURE_DISTANCE;
  }

  // Forward pass: left, up-left, up, up-right.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let d = dist[i]!;
      if (d === 0) continue;
      if (x > 0) d = Math.min(d, dist[i - 1]! + 1);
      if (y > 0) {
        const up = i - width;
        d = Math.min(d, dist[up]! + 1);
        if (x > 0) d = Math.min(d, dist[up - 1]! + DIAGONAL);
        if (x < width - 1) d = Math.min(d, dist[up + 1]! + DIAGONAL);
      }
      dist[i] = d;
    }
  }

  // Backward pass: right, down-right, down, down-left.
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let d = dist[i]!;
      if (d === 0) continue;
      if (x < width - 1) d = Math.min(d, dist[i + 1]! + 1);
      if (y < height - 1) {
        const down = i + width;
        d = Math.min(d, dist[down]! + 1);
        if (x < width - 1) d = Math.min(d, dist[down + 1]! + DIAGONAL);
        if (x > 0) d = Math.min(d, dist[down - 1]! + DIAGONAL);
      }
      dist[i] = d;
    }
  }
  return dist;
}
