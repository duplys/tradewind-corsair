// SPDX-License-Identifier: GPL-3.0-only
import { ISLANDS, MAINLAND, isletDefs, type LonLat } from '../../data/geography';
import { PPD } from '../../data/world';
import { lonLatToWorld, type WorldPoint } from './projection';

/**
 * Mark the pixels whose centres lie inside the polygon (even-odd rule) as land (1).
 * Pixels already marked stay marked, so overlapping shapes union rather than cancel.
 */
export function fillPolygon(
  mask: Uint8Array,
  width: number,
  height: number,
  points: readonly WorldPoint[],
): void {
  const n = points.length;
  if (n < 3) return;
  const crossings: number[] = [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const rowStart = Math.max(0, Math.floor(minY));
  const rowEnd = Math.min(height - 1, Math.ceil(maxY));

  for (let row = rowStart; row <= rowEnd; row++) {
    const yc = row + 0.5;
    crossings.length = 0;
    for (let i = 0; i < n; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % n]!;
      // Half-open rule: count an edge when the scanline lies in [min(ay,by), max(ay,by)).
      if (a.y <= yc !== b.y <= yc) {
        crossings.push(a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    crossings.sort((p, q) => p - q);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      // Pixel column c has its centre at c + 0.5; fill centres in [xa, xb).
      const first = Math.max(0, Math.ceil(crossings[k]! - 0.5));
      const last = Math.min(width - 1, Math.ceil(crossings[k + 1]! - 0.5) - 1);
      const offset = row * width;
      for (let col = first; col <= last; col++) mask[offset + col] = 1;
    }
  }
}

/** Mark pixels whose centres lie inside the axis-aligned ellipse as land. */
export function fillEllipse(
  mask: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): void {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(height - 1, Math.ceil(cy + ry));
  for (let row = y0; row <= y1; row++) {
    const dy = (row + 0.5 - cy) / ry;
    for (let col = x0; col <= x1; col++) {
      const dx = (col + 0.5 - cx) / rx;
      if (dx * dx + dy * dy <= 1) mask[row * width + col] = 1;
    }
  }
}

function project(points: readonly LonLat[]): WorldPoint[] {
  return points.map(([lon, lat]) => lonLatToWorld(lon, lat));
}

/** Rasterise the mainland, islands and islets into a land mask (1 = land). */
export function rasteriseGeography(width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  fillPolygon(mask, width, height, project(MAINLAND));
  for (const island of ISLANDS) fillPolygon(mask, width, height, project(island.points));
  for (const islet of isletDefs()) {
    const c = lonLatToWorld(islet.lon, islet.lat);
    fillEllipse(mask, width, height, c.x, c.y, islet.rxDeg * PPD, islet.ryDeg * PPD);
  }
  return mask;
}
