// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { PORTS, START_PORT_ID } from '../../../src/data/ports';
import { derivePorts, findPort, nearPort, type Port } from '../../../src/sim/world/ports';
import { worldToLonLat } from '../../../src/sim/world/projection';
import { buildWorld, distToLandAt, isLand, type World } from '../../../src/sim/world/world';

let world: World;
let ports: Port[];

beforeAll(() => {
  world = buildWorld();
  ports = derivePorts(world, PORTS);
});

/** Water pixels reachable from a start point by 4-connected flood fill. */
function reachableWater(w: World, x: number, y: number): Uint8Array {
  const seen = new Uint8Array(w.width * w.height);
  const stack = [Math.floor(y) * w.width + Math.floor(x)];
  seen[stack[0]!] = 1;
  while (stack.length > 0) {
    const i = stack.pop()!;
    const px = i % w.width;
    for (const n of [i - 1, i + 1, i - w.width, i + w.width]) {
      if (n < 0 || n >= seen.length || seen[n] || w.landMask[n]) continue;
      if ((n === i - 1 && px === 0) || (n === i + 1 && px === w.width - 1)) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
  return seen;
}

describe('derivePorts', () => {
  it('has 21 ports with unique kebab-case ids', () => {
    expect(PORTS).toHaveLength(21);
    const ids = new Set(PORTS.map((p) => p.id));
    expect(ids.size).toBe(21);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(ids.has(START_PORT_ID)).toBe(true);
  });

  it('resolves every port to a town on land and a harbour in clear water', () => {
    expect(ports).toHaveLength(PORTS.length);
    for (const port of ports) {
      expect(isLand(world, port.town.x, port.town.y), port.def.id).toBe(true);
      expect(isLand(world, port.harbour.x, port.harbour.y), port.def.id).toBe(false);
      expect(
        distToLandAt(world, port.harbour.x, port.harbour.y),
        port.def.id,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every town far enough from the map edges for its flag and label', () => {
    for (const port of ports) {
      expect(port.town.y, port.def.id).toBeGreaterThanOrEqual(16);
      expect(port.town.x, port.def.id).toBeGreaterThanOrEqual(4);
      expect(port.town.x, port.def.id).toBeLessThan(world.width - 4);
    }
  });

  it('can reach every harbour by sea from the start port', () => {
    const start = findPort(ports, START_PORT_ID).harbour;
    const reach = reachableWater(world, start.x, start.y);
    for (const port of ports) {
      const i = Math.floor(port.harbour.y) * world.width + Math.floor(port.harbour.x);
      expect(reach[i], port.def.id).toBe(1);
    }
  });

  it('puts Tortuga on Tortuga, not on Hispaniola', () => {
    const town = findPort(ports, 'tortuga').town;
    expect(worldToLonLat(town.x, town.y).lat).toBeGreaterThan(20.0);
  });

  it('throws with the port id when a port cannot be resolved', () => {
    const bad = { ...PORTS[0]!, id: 'nowhere', lon: -85, lat: 26 }; // open Gulf of Mexico
    expect(() => derivePorts(world, [bad])).toThrow(/nowhere/);
  });
});

describe('nearPort', () => {
  it('finds a port within 18 px of its harbour and none further away', () => {
    const port = findPort(ports, 'port-royal');
    const { x, y } = port.harbour;
    expect(nearPort(ports, x + 17, y)?.def.id).toBe('port-royal');
    expect(nearPort(ports, x + 19, y)).toBeNull();
  });

  it('picks the closest when several are near', () => {
    const a = findPort(ports, 'st-eustatius');
    const b = findPort(ports, 'st-johns');
    expect(nearPort(ports, a.harbour.x, a.harbour.y)?.def.id).toBe('st-eustatius');
    expect(nearPort(ports, b.harbour.x, b.harbour.y)?.def.id).toBe('st-johns');
  });
});
