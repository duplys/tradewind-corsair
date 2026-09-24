// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { PORTS } from '../../src/data/ports';
import { dockAt, newVoyage, setSailFrom } from '../../src/sim/voyage';
import { derivePorts, findPort, type Port } from '../../src/sim/world/ports';
import { buildWorld, distToLandAt, type World } from '../../src/sim/world/world';

let world: World;
let ports: Port[];

beforeAll(() => {
  world = buildWorld();
  ports = derivePorts(world, PORTS);
});

describe('voyage', () => {
  it('starts at the Bridgetown harbour on 1 March 1660 08:00, facing open water', () => {
    const v = newVoyage(world, ports);
    const harbour = findPort(ports, 'bridgetown').harbour;
    expect(v.ship).toMatchObject({ x: harbour.x, y: harbour.y, sail: 'full', speedKn: 0 });
    expect(v.elapsedHours).toBe(8);
    expect(v.lastPortId).toBe('bridgetown');
    expect(v.dockedPortId).toBeNull();
    const ahead = distToLandAt(
      world,
      v.ship.x + Math.cos(v.ship.headingRad) * 20,
      v.ship.y + Math.sin(v.ship.headingRad) * 20,
    );
    expect(ahead).toBeGreaterThan(distToLandAt(world, v.ship.x, v.ship.y));
  });

  it('docking stops the ship and records the port', () => {
    const v = { ...newVoyage(world, ports), ship: { ...newVoyage(world, ports).ship, speedKn: 6 } };
    const docked = dockAt(v, findPort(ports, 'port-royal'));
    expect(docked.ship.speedKn).toBe(0);
    expect(docked.dockedPortId).toBe('port-royal');
    expect(docked.lastPortId).toBe('port-royal');
    expect(docked.elapsedHours).toBe(v.elapsedHours);
  });

  it('setting sail leaves from the harbour with full sail toward open water', () => {
    const port = findPort(ports, 'havana');
    const docked = dockAt({ ...newVoyage(world, ports) }, port);
    const furled = { ...docked, ship: { ...docked.ship, sail: 'furled' as const } };
    const away = setSailFrom(furled, world, port);
    expect(away.dockedPortId).toBeNull();
    expect(away.lastPortId).toBe('havana');
    expect(away.ship).toMatchObject({
      x: port.harbour.x,
      y: port.harbour.y,
      sail: 'full',
      speedKn: 0,
    });
  });

  it('every port leaves toward more open water', () => {
    for (const port of ports) {
      const s = setSailFrom(dockAt(newVoyage(world, ports), port), world, port).ship;
      const ahead = distToLandAt(
        world,
        s.x + Math.cos(s.headingRad) * 20,
        s.y + Math.sin(s.headingRad) * 20,
      );
      expect(ahead, port.def.id).toBeGreaterThan(distToLandAt(world, s.x, s.y));
    }
  });
});
