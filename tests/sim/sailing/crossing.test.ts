// SPDX-License-Identifier: GPL-3.0-only
// Balance regression: an autopilot sails a new voyage's ship from Bridgetown to Veracruz at
// different times of year. Spec §14 asks for roughly 60–90 s of real time (12–15 game days).
import { beforeAll, describe, expect, it } from 'vitest';
import { SIM_STEP_SECONDS } from '../../../src/data/constants';
import { PORTS } from '../../../src/data/ports';
import { angleDiff } from '../../../src/sim/math';
import { stepShip } from '../../../src/sim/sailing/ship';
import { windAt } from '../../../src/sim/sailing/wind';
import { advanceClock } from '../../../src/sim/time';
import { newVoyage } from '../../../src/sim/voyage';
import { derivePorts, findPort, nearPort, type Port } from '../../../src/sim/world/ports';
import { lonLatToWorld, type WorldPoint } from '../../../src/sim/world/projection';
import { buildWorld, type World } from '../../../src/sim/world/world';

/** South of the Windward Islands and the Greater Antilles, through the Yucatán Channel. */
const ROUTE_LON_LAT = [
  [-60.6, 12.7],
  [-61.6, 12.65],
  [-66, 14.5],
  [-75, 15.5],
  [-82, 18.5],
  [-85.8, 21.0],
  [-86, 22.8],
  [-92, 21.8],
] as const;
const WAYPOINT_RADIUS_PX = 25;
const GIVE_UP_SEC = 300;

let world: World;
let ports: Port[];
let route: WorldPoint[];

beforeAll(() => {
  world = buildWorld();
  ports = derivePorts(world, PORTS);
  route = [
    ...ROUTE_LON_LAT.map(([lon, lat]) => lonLatToWorld(lon, lat)),
    findPort(ports, 'veracruz').harbour,
  ];
});

function crossing(startHours: number): { seconds: number; days: number; shoals: number } {
  let ship = newVoyage(world, ports).ship;
  let hours = startHours;
  let seconds = 0;
  let shoals = 0;
  let wp = 0;
  while (seconds < GIVE_UP_SEC && nearPort(ports, ship.x, ship.y)?.def.id !== 'veracruz') {
    const target = route[wp]!;
    if (
      wp < route.length - 1 &&
      Math.hypot(target.x - ship.x, target.y - ship.y) < WAYPOINT_RADIUS_PX
    )
      wp++;
    const error = angleDiff(Math.atan2(target.y - ship.y, target.x - ship.x), ship.headingRad);
    const input = { turnLeft: error < -0.05, turnRight: error > 0.05 };
    const result = stepShip(ship, input, windAt(ship.x, ship.y, hours), world, SIM_STEP_SECONDS);
    ship = result.ship;
    shoals += result.events.length;
    hours = advanceClock(hours, SIM_STEP_SECONDS);
    seconds += SIM_STEP_SECONDS;
  }
  return { seconds, days: (hours - startHours) / 24, shoals };
}

describe('Bridgetown to Veracruz', () => {
  it('takes roughly 60–90 s of real time over a year of winds', () => {
    const runs = Array.from({ length: 12 }, (_, month) => crossing(8 + month * 30 * 24));
    for (const run of runs) {
      expect(run.seconds).toBeLessThan(GIVE_UP_SEC); // arrived
      expect(run.shoals).toBe(0);
      expect(run.seconds).toBeGreaterThan(60);
      expect(run.seconds).toBeLessThan(120);
    }
    const sorted = runs.map((r) => r.seconds).sort((a, b) => a - b);
    const median = (sorted[5]! + sorted[6]!) / 2;
    expect(median).toBeGreaterThanOrEqual(60);
    expect(median).toBeLessThanOrEqual(90);
    const days = runs.map((r) => r.days).sort((a, b) => a - b);
    expect((days[5]! + days[6]!) / 2).toBeGreaterThanOrEqual(12);
    expect((days[5]! + days[6]!) / 2).toBeLessThanOrEqual(15);
  });
});
