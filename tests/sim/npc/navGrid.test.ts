// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import {
  buildNavGrid,
  cellAt,
  cellCentre,
  findCellPath,
  lineOfSight,
  smoothPath,
} from '../../../src/sim/npc/navGrid';
import { fillPolygon } from '../../../src/sim/world/rasterise';
import { createWorld, isLand, type World } from '../../../src/sim/world/world';

/** 240 × 120 px of sea with a wall down the middle, open only at the bottom. */
function wallWorld(): World {
  const w = 240;
  const h = 120;
  const mask = new Uint8Array(w * h);
  fillPolygon(mask, w, h, [
    { x: 110, y: 0 },
    { x: 130, y: 0 },
    { x: 130, y: 84 },
    { x: 110, y: 84 },
  ]);
  return createWorld(w, h, mask);
}

function assertNoLand(world: World, points: readonly { x: number; y: number }[]): void {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      expect(isLand(world, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)).toBe(false);
    }
  }
}

describe('buildNavGrid', () => {
  it('marks cells navigable only when clear of land and mostly water', () => {
    const world = wallWorld();
    const grid = buildNavGrid(world);
    expect(grid.cols).toBe(20);
    expect(grid.rows).toBe(10);
    expect(grid.navigable[cellAt(grid, 30, 30)]).toBe(1);
    expect(grid.navigable[cellAt(grid, 120, 30)]).toBe(0); // inside the wall
    expect(grid.navigable[cellAt(grid, 102, 30)]).toBe(1); // centre 8 px from the wall
  });

  it('needs the centre at least 5 px from land even when the cell is mostly water', () => {
    // Land from x = 106: the cell spanning 96–107 is 10/12 water but its centre is 4 px off.
    const w = 120;
    const mask = new Uint8Array(w * 24);
    fillPolygon(mask, w, 24, [
      { x: 106, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 24 },
      { x: 106, y: 24 },
    ]);
    const grid = buildNavGrid(createWorld(w, 24, mask));
    expect(grid.navigable[cellAt(grid, 102, 6)]).toBe(0);
    expect(grid.navigable[cellAt(grid, 90, 6)]).toBe(1);
  });

  it('counts pixels beyond the map edge as land', () => {
    const w = 30;
    const world = createWorld(w, 18, new Uint8Array(w * 18));
    const grid = buildNavGrid(world);
    // The second row of cells is half off the map (18 px tall): only 50 % water.
    expect(grid.navigable[cellAt(grid, 6, 6)]).toBe(1);
    expect(grid.navigable[cellAt(grid, 6, 14)]).toBe(0);
  });
});

describe('findCellPath', () => {
  it('goes around an obstacle and never through land', () => {
    const world = wallWorld();
    const grid = buildNavGrid(world);
    const start = cellAt(grid, 30, 30);
    const goal = cellAt(grid, 210, 30);
    const cells = findCellPath(grid, start, goal)!;
    expect(cells[0]).toBe(start);
    expect(cells.at(-1)).toBe(goal);
    for (const c of cells) expect(grid.navigable[c]).toBe(1);
    // It must pass below the wall.
    expect(Math.max(...cells.map((c) => cellCentre(grid, c).y))).toBeGreaterThan(84);
    assertNoLand(
      world,
      cells.map((c) => cellCentre(grid, c)),
    );
  });

  it('never cuts a corner diagonally', () => {
    const world = wallWorld();
    const grid = buildNavGrid(world);
    const cells = findCellPath(grid, cellAt(grid, 30, 30), cellAt(grid, 210, 30))!;
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1]!;
      const b = cells[i]!;
      const dc = (b % grid.cols) - (a % grid.cols);
      const dr = Math.floor(b / grid.cols) - Math.floor(a / grid.cols);
      if (dc !== 0 && dr !== 0) {
        expect(grid.navigable[a + dc]).toBe(1);
        expect(grid.navigable[a + dr * grid.cols]).toBe(1);
      }
    }
  });

  it('finds the shortest route in open water (octile distance)', () => {
    const world = createWorld(240, 240, new Uint8Array(240 * 240));
    const grid = buildNavGrid(world);
    const cells = findCellPath(grid, cellAt(grid, 30, 30), cellAt(grid, 150, 90))!;
    // 10 columns and 5 rows apart: 5 diagonal + 5 straight moves = 11 cells.
    expect(cells).toHaveLength(11);
  });

  it('returns null when the goal is walled off or not navigable', () => {
    const w = 240;
    const h = 120;
    const mask = new Uint8Array(w * h);
    fillPolygon(mask, w, h, [
      { x: 110, y: 0 },
      { x: 130, y: 0 },
      { x: 130, y: 120 },
      { x: 110, y: 120 },
    ]);
    const world = createWorld(w, h, mask);
    const grid = buildNavGrid(world);
    expect(findCellPath(grid, cellAt(grid, 30, 30), cellAt(grid, 210, 30))).toBeNull();
    expect(findCellPath(grid, cellAt(grid, 30, 30), cellAt(grid, 120, 30))).toBeNull();
  });
});

describe('lineOfSight and smoothPath', () => {
  it('sees across open water but not across land', () => {
    const world = wallWorld();
    expect(lineOfSight(world, { x: 30, y: 30 }, { x: 90, y: 60 })).toBe(true);
    expect(lineOfSight(world, { x: 30, y: 30 }, { x: 210, y: 30 })).toBe(false);
    expect(lineOfSight(world, { x: 30, y: 30 }, { x: 30, y: 200 })).toBe(false); // off the map
  });

  it('drops needless waypoints but never cuts across land', () => {
    const world = wallWorld();
    const grid = buildNavGrid(world);
    const cells = findCellPath(grid, cellAt(grid, 30, 30), cellAt(grid, 210, 30))!;
    const raw = cells.map((c) => cellCentre(grid, c));
    const smooth = smoothPath(world, raw);
    expect(smooth.length).toBeLessThan(raw.length);
    expect(smooth[0]).toEqual(raw[0]);
    expect(smooth.at(-1)).toEqual(raw.at(-1));
    for (let i = 1; i < smooth.length; i++) {
      expect(lineOfSight(world, smooth[i - 1]!, smooth[i]!)).toBe(true);
    }
    assertNoLand(world, smooth);
  });
});
