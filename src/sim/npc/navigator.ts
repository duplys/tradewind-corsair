// SPDX-License-Identifier: GPL-3.0-only
import { SNAP_MAX_CELLS } from '../../data/npc';
import type { Rng } from '../rng';
import type { Port } from '../world/ports';
import type { WorldPoint } from '../world/projection';
import type { World } from '../world/world';
import {
  buildNavGrid,
  cellAt,
  cellCentre,
  findCellPath,
  lineOfSight,
  smoothPath,
  type NavGrid,
} from './navGrid';

/**
 * Finds sea routes for NPCs (slice 2 spec §4.2): paths between any two points or ports, joined
 * to the navigation grid by straight legs, smoothed, and cached between ports. Its results
 * depend only on the world, so the cache never changes what the simulation does.
 */
export class Navigator {
  readonly grid: NavGrid;
  private readonly portPaths = new Map<string, readonly WorldPoint[] | null>();
  private readonly portsById: ReadonlyMap<string, Port>;

  constructor(
    readonly world: World,
    readonly ports: readonly Port[],
    grid?: NavGrid,
  ) {
    this.grid = grid ?? buildNavGrid(world);
    this.portsById = new Map(ports.map((p) => [p.def.id, p]));
  }

  port(id: string): Port | undefined {
    return this.portsById.get(id);
  }

  /**
   * The nearest navigable cell (up to 6 cells away) whose centre is in line of sight of the
   * point, or −1. Ties are broken by cell index, so the result is stable.
   */
  snapCell(point: WorldPoint): number {
    const { grid } = this;
    const home = cellAt(grid, point.x, point.y);
    if (
      home >= 0 &&
      grid.navigable[home] &&
      lineOfSight(this.world, point, cellCentre(grid, home))
    ) {
      return home;
    }
    const col0 = Math.floor(point.x / grid.cellPx);
    const row0 = Math.floor(point.y / grid.cellPx);
    const candidates: { cell: number; d2: number }[] = [];
    for (let row = row0 - SNAP_MAX_CELLS; row <= row0 + SNAP_MAX_CELLS; row++) {
      for (let col = col0 - SNAP_MAX_CELLS; col <= col0 + SNAP_MAX_CELLS; col++) {
        if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue;
        const cell = row * grid.cols + col;
        if (!grid.navigable[cell]) continue;
        const c = cellCentre(grid, cell);
        candidates.push({ cell, d2: (c.x - point.x) ** 2 + (c.y - point.y) ** 2 });
      }
    }
    candidates.sort((a, b) => a.d2 - b.d2 || a.cell - b.cell);
    for (const { cell } of candidates) {
      if (lineOfSight(this.world, point, cellCentre(grid, cell))) return cell;
    }
    return -1;
  }

  /** A smoothed route from `from` to `to`, both included, or null if there is none. */
  pathBetween(from: WorldPoint, to: WorldPoint): WorldPoint[] | null {
    if (lineOfSight(this.world, from, to)) return [from, to];
    const a = this.snapCell(from);
    const b = this.snapCell(to);
    if (a < 0 || b < 0) return null;
    const cells = findCellPath(this.grid, a, b);
    if (!cells) return null;
    const points = [from, ...cells.map((c) => cellCentre(this.grid, c)), to];
    return smoothPath(this.world, points);
  }

  /** The route between two ports' harbours, computed once and cached. */
  portPath(fromId: string, toId: string): readonly WorldPoint[] | null {
    const key = `${fromId}>${toId}`;
    const cached = this.portPaths.get(key);
    if (cached !== undefined) return cached;
    const from = this.portsById.get(fromId);
    const to = this.portsById.get(toId);
    const path = from && to ? this.pathBetween(from.harbour, to.harbour) : null;
    this.portPaths.set(key, path);
    return path;
  }

  /** A random navigable cell centre within `radiusPx` of a point, or null. */
  randomCellNear(point: WorldPoint, radiusPx: number, rng: Rng): WorldPoint | null {
    const cells = this.cellsWithin(point, 0, radiusPx);
    if (cells.length === 0) return null;
    return cellCentre(this.grid, cells[Math.floor(rng() * cells.length)]!);
  }

  /** Navigable cells whose centres lie between two distances of a point, in index order. */
  cellsWithin(point: WorldPoint, minPx: number, maxPx: number): number[] {
    const { grid } = this;
    const out: number[] = [];
    const reach = Math.ceil(maxPx / grid.cellPx) + 1;
    const col0 = Math.floor(point.x / grid.cellPx);
    const row0 = Math.floor(point.y / grid.cellPx);
    for (let row = Math.max(0, row0 - reach); row <= Math.min(grid.rows - 1, row0 + reach); row++) {
      for (
        let col = Math.max(0, col0 - reach);
        col <= Math.min(grid.cols - 1, col0 + reach);
        col++
      ) {
        const cell = row * grid.cols + col;
        if (!grid.navigable[cell]) continue;
        const c = cellCentre(grid, cell);
        const d = Math.hypot(c.x - point.x, c.y - point.y);
        if (d >= minPx && d <= maxPx) out.push(cell);
      }
    }
    return out;
  }
}
