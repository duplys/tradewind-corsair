// SPDX-License-Identifier: GPL-3.0-only
import {
  LOS_MIN_DIST_TO_LAND_PX,
  LOS_SAMPLE_PX,
  NAV_CELL_PX,
  NAV_MIN_DIST_TO_LAND_PX,
  NAV_MIN_WATER_SHARE,
} from '../../data/npc';
import type { WorldPoint } from '../world/projection';
import { distToLandAt, type World } from '../world/world';

/**
 * A coarse grid over the world for NPC navigation (slice 2 spec §4.2). A cell is navigable when
 * its centre is well clear of land and most of it is water.
 */
export interface NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellPx: number;
  /** 1 = navigable. Row-major, cols × rows. */
  readonly navigable: Uint8Array;
  /**
   * Allowed moves per cell: bit k is set when the move in direction k (see DC/DR) leads to a
   * navigable cell in line of sight, so no leg between neighbouring cells grazes land.
   */
  readonly moves: Uint8Array;
  /** Reusable A* buffers, so path searches allocate no arrays. */
  readonly scratch: AStarScratch;
}

/** Scratch buffers for A*, reused between searches on the same grid. */
interface AStarScratch {
  readonly g: Float64Array;
  readonly came: Int32Array;
  readonly closed: Uint8Array;
  readonly heapCells: Int32Array;
  readonly heapKeys: Float64Array;
}

function createScratch(cells: number): AStarScratch {
  return {
    g: new Float64Array(cells),
    came: new Int32Array(cells),
    closed: new Uint8Array(cells),
    heapCells: new Int32Array(cells * 8 + 1),
    heapKeys: new Float64Array(cells * 8 + 1),
  };
}

// Neighbour offsets: 4 straight, then 4 diagonal.
const DC = [1, -1, 0, 0, 1, 1, -1, -1] as const;
const DR = [0, 0, 1, -1, 1, -1, 1, -1] as const;

export function buildNavGrid(world: World, cellPx: number = NAV_CELL_PX): NavGrid {
  const cols = Math.ceil(world.width / cellPx);
  const rows = Math.ceil(world.height / cellPx);
  const navigable = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = col * cellPx + cellPx / 2;
      const cy = row * cellPx + cellPx / 2;
      if (cx >= world.width || cy >= world.height) continue;
      if (distToLandAt(world, cx, cy) < NAV_MIN_DIST_TO_LAND_PX) continue;
      let water = 0;
      const x1 = Math.min(world.width, (col + 1) * cellPx);
      const y1 = Math.min(world.height, (row + 1) * cellPx);
      for (let y = row * cellPx; y < y1; y++) {
        for (let x = col * cellPx; x < x1; x++)
          if (world.landMask[y * world.width + x] === 0) water++;
      }
      // Pixels beyond the map edge count as land.
      if (water / (cellPx * cellPx) >= NAV_MIN_WATER_SHARE) navigable[row * cols + col] = 1;
    }
  }

  const moves = new Uint8Array(cols * rows);
  const centre = (col: number, row: number): WorldPoint => ({
    x: col * cellPx + cellPx / 2,
    y: row * cellPx + cellPx / 2,
  });
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = row * cols + col;
      if (!navigable[cell]) continue;
      for (let k = 0; k < 8; k++) {
        const nc = col + DC[k]!;
        const nr = row + DR[k]!;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        if (!navigable[nr * cols + nc]) continue;
        // Diagonals also need both cells beside them, so paths never cut a corner.
        if (k >= 4 && (!navigable[row * cols + nc] || !navigable[nr * cols + col])) continue;
        if (lineOfSight(world, centre(col, row), centre(nc, nr))) moves[cell]! |= 1 << k;
      }
    }
  }
  return { cols, rows, cellPx, navigable, moves, scratch: createScratch(cols * rows) };
}

/** The cell containing a world point, or −1 outside the grid. */
export function cellAt(grid: NavGrid, x: number, y: number): number {
  const col = Math.floor(x / grid.cellPx);
  const row = Math.floor(y / grid.cellPx);
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return -1;
  return row * grid.cols + col;
}

export function cellCentre(grid: NavGrid, cell: number): WorldPoint {
  const col = cell % grid.cols;
  const row = Math.floor(cell / grid.cols);
  return { x: col * grid.cellPx + grid.cellPx / 2, y: row * grid.cellPx + grid.cellPx / 2 };
}

/** True when the straight segment keeps clear of land (sampled every few px, ends included). */
export function lineOfSight(world: World, a: WorldPoint, b: WorldPoint): boolean {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(length / LOS_SAMPLE_PX));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (
      distToLandAt(world, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) < LOS_MIN_DIST_TO_LAND_PX
    ) {
      return false;
    }
  }
  return true;
}

/**
 * A* over navigable cells with 8-way moves (cost 1 and √2) and an octile heuristic, using only
 * the moves the grid allows (in line of sight, no corner cutting). Returns the cells from start
 * to goal, or null when the goal cannot be reached.
 */
export function findCellPath(grid: NavGrid, start: number, goal: number): number[] | null {
  const { cols, navigable, moves } = grid;
  if (!navigable[start] || !navigable[goal]) return null;
  if (start === goal) return [start];
  const { g, came, closed, heapCells, heapKeys } = grid.scratch;
  g.fill(Infinity);
  closed.fill(0);
  const goalCol = goal % cols;
  const goalRow = Math.floor(goal / cols);
  const h = (cell: number): number => {
    const dx = Math.abs((cell % cols) - goalCol);
    const dy = Math.abs(Math.floor(cell / cols) - goalRow);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };

  // Binary min-heap of (cell, f) entries. A cell may be pushed again with a lower f; the stale
  // entry is skipped when popped because the cell is closed by then.
  let size = 0;
  const push = (cell: number, key: number): void => {
    let i = size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heapKeys[parent]! <= key) break;
      heapCells[i] = heapCells[parent]!;
      heapKeys[i] = heapKeys[parent]!;
      i = parent;
    }
    heapCells[i] = cell;
    heapKeys[i] = key;
  };
  const pop = (): number => {
    const top = heapCells[0]!;
    const lastCell = heapCells[--size]!;
    const lastKey = heapKeys[size]!;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= size) break;
      const r = l + 1;
      const child = r < size && heapKeys[r]! < heapKeys[l]! ? r : l;
      if (heapKeys[child]! >= lastKey) break;
      heapCells[i] = heapCells[child]!;
      heapKeys[i] = heapKeys[child]!;
      i = child;
    }
    heapCells[i] = lastCell;
    heapKeys[i] = lastKey;
    return top;
  };

  g[start] = 0;
  came[start] = -1;
  push(start, h(start));
  while (size > 0) {
    const cell = pop();
    if (closed[cell]) continue;
    if (cell === goal) break;
    closed[cell] = 1;
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    const allowed = moves[cell]!;
    for (let k = 0; k < 8; k++) {
      if (!(allowed & (1 << k))) continue;
      const next = (row + DR[k]!) * cols + col + DC[k]!;
      if (closed[next]) continue;
      const cost = g[cell]! + (k >= 4 ? Math.SQRT2 : 1);
      if (cost < g[next]!) {
        g[next] = cost;
        came[next] = cell;
        push(next, cost + h(next));
      }
    }
  }
  if (g[goal] === Infinity) return null;
  const path: number[] = [];
  for (let cell = goal; cell !== -1; cell = came[cell]!) path.push(cell);
  return path.reverse();
}

/**
 * Remove waypoints that can be skipped: from each kept point, jump to the farthest later point
 * still in line of sight. The first and last points are always kept.
 */
export function smoothPath(world: World, points: readonly WorldPoint[]): WorldPoint[] {
  if (points.length <= 2) return [...points];
  const out: WorldPoint[] = [points[0]!];
  let i = 0;
  while (i < points.length - 1) {
    let j = points.length - 1;
    while (j > i + 1 && !lineOfSight(world, points[i]!, points[j]!)) j--;
    out.push(points[j]!);
    i = j;
  }
  return out;
}
