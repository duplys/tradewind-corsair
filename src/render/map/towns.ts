// SPDX-License-Identifier: GPL-3.0-only
import { createRng, hashString } from '../../sim/rng';
import type { Port } from '../../sim/world/ports';
import type { World } from '../../sim/world/world';
import { hexToRgb, TOWN_COLORS } from '../palette';

const HOUSE_RADIUS_PX = 3;
const MIN_HOUSES = 4;
const MAX_HOUSES = 6;
const MAX_TRIES = 40;

function put(
  px: Uint8ClampedArray,
  world: World,
  x: number,
  y: number,
  rgb: readonly [number, number, number],
): void {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return;
  const o = (y * world.width + x) * 4;
  px[o] = rgb[0];
  px[o + 1] = rgb[1];
  px[o + 2] = rgb[2];
  px[o + 3] = 255;
}

/**
 * Stamp each town into the map pixels (slice 1 spec §3.5): a 3×3 grey fort with a dark gate,
 * plus 4–6 roofs and walls scattered within 3 px on land. Seeded per port, so towns never
 * change between loads.
 */
export function stampTowns(
  px: Uint8ClampedArray,
  world: World,
  ports: readonly Port[],
  seed: number,
): void {
  const fort = hexToRgb(TOWN_COLORS.fort);
  const gate = hexToRgb(TOWN_COLORS.gate);
  const roof = hexToRgb(TOWN_COLORS.roof);
  const wall = hexToRgb(TOWN_COLORS.wall);

  for (const port of ports) {
    const tx = Math.floor(port.town.x);
    const ty = Math.floor(port.town.y);
    const rng = createRng((seed ^ hashString(port.def.id)) >>> 0);

    const houses = MIN_HOUSES + Math.floor(rng() * (MAX_HOUSES - MIN_HOUSES + 1));
    for (let placed = 0, tries = 0; placed < houses && tries < MAX_TRIES; tries++) {
      const dx = Math.floor(rng() * (2 * HOUSE_RADIUS_PX + 1)) - HOUSE_RADIUS_PX;
      const dy = Math.floor(rng() * (2 * HOUSE_RADIUS_PX + 1)) - HOUSE_RADIUS_PX;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue; // inside the fort
      const x = tx + dx;
      const y = ty + dy;
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) continue;
      if (world.landMask[y * world.width + x] !== 1) continue;
      put(px, world, x, y, rng() < 0.5 ? roof : wall);
      placed++;
    }

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) put(px, world, tx + dx, ty + dy, fort);
    }
    put(px, world, tx, ty + 1, gate);
  }
}
