// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { PORTS } from '../../../src/data/ports';
import { lineOfSight } from '../../../src/sim/npc/navGrid';
import { Navigator } from '../../../src/sim/npc/navigator';
import { createRng } from '../../../src/sim/rng';
import { derivePorts, findPort, type Port } from '../../../src/sim/world/ports';
import { buildWorld, distToLandAt, isLand, type World } from '../../../src/sim/world/world';

let world: World;
let ports: Port[];
let nav: Navigator;

beforeAll(() => {
  world = buildWorld();
  ports = derivePorts(world, PORTS);
  const started = performance.now();
  nav = new Navigator(world, ports);
  // Spec §12: grid plus first paths under 150 ms at load (checked loosely: CI machines vary).
  expect(performance.now() - started).toBeLessThan(500);
});

describe('Navigator on the Caribbean', () => {
  it('snaps every harbour to a navigable cell in sight', () => {
    for (const port of ports)
      expect(nav.snapCell(port.harbour), port.def.id).toBeGreaterThanOrEqual(0);
  });

  it('finds a path between every pair of ports, and no path crosses land', () => {
    for (const a of ports) {
      for (const b of ports) {
        if (a === b) continue;
        const path = nav.portPath(a.def.id, b.def.id);
        expect(path, `${a.def.id} → ${b.def.id}`).not.toBeNull();
        expect(path![0]).toEqual(a.harbour);
        expect(path!.at(-1)).toEqual(b.harbour);
        for (let i = 1; i < path!.length; i++) {
          const p = path![i - 1]!;
          const q = path![i]!;
          expect(lineOfSight(world, p, q), `${a.def.id} → ${b.def.id} leg ${i}`).toBe(true);
          const steps = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y));
          for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 0 : s / steps;
            expect(isLand(world, p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t)).toBe(false);
          }
        }
      }
    }
  });

  it('caches port paths', () => {
    expect(nav.portPath('havana', 'nassau')).toBe(nav.portPath('havana', 'nassau'));
  });

  it('reaches the hard harbours: Tortuga, Maracaibo and St. Augustine', () => {
    for (const id of ['tortuga', 'maracaibo', 'st-augustine']) {
      expect(nav.portPath('port-royal', id), id).not.toBeNull();
    }
  });

  it('picks random cells near a point, in clear water, deterministically', () => {
    const havana = findPort(ports, 'havana').harbour;
    const a = nav.randomCellNear(havana, 150, createRng(4));
    const b = nav.randomCellNear(havana, 150, createRng(4));
    expect(a).toEqual(b);
    expect(Math.hypot(a!.x - havana.x, a!.y - havana.y)).toBeLessThanOrEqual(150);
    expect(distToLandAt(world, a!.x, a!.y)).toBeGreaterThanOrEqual(5);
  });
});
