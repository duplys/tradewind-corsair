// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { SIM_STEP_SECONDS } from '../../../src/data/constants';
import { PORTS } from '../../../src/data/ports';
import { Navigator } from '../../../src/sim/npc/navigator';
import { stepNpcWorld, type NpcWorldState } from '../../../src/sim/npc/world';
import { windAt } from '../../../src/sim/sailing/wind';
import { advanceClock } from '../../../src/sim/time';
import { derivePorts, findPort } from '../../../src/sim/world/ports';
import type { WorldPoint } from '../../../src/sim/world/projection';
import { buildWorld, isLand } from '../../../src/sim/world/world';
import { makeNpc } from './helpers';

let nav: Navigator;
let bridgetown: WorldPoint;

beforeAll(() => {
  const world = buildWorld();
  const ports = derivePorts(world, PORTS);
  nav = new Navigator(world, ports);
  bridgetown = findPort(ports, 'bridgetown').harbour;
});

/** Run the NPC world with the player sitting still. */
function run(
  state: NpcWorldState,
  player: WorldPoint,
  seconds: number,
  check?: (s: NpcWorldState) => void,
) {
  let hours = 8;
  let spawned = 0;
  let departed = 0;
  for (let t = 0; t < seconds * 60; t++) {
    const next = advanceClock(hours, SIM_STEP_SECONDS);
    const r = stepNpcWorld(
      state,
      { nav, wind: windAt(0, 0, hours), player, hoursBefore: hours, hoursAfter: next },
      SIM_STEP_SECONDS,
    );
    state = r.state;
    spawned += r.spawned.length;
    departed += r.departed.length;
    hours = next;
    check?.(state);
  }
  return { state, spawned, departed };
}

const EMPTY: NpcWorldState = { npcs: [], nextNpcId: 1, rngState: 1234 };

describe('stepNpcWorld', () => {
  it('fills the waters around the player to six ships at the first spawn check', () => {
    const { state } = run(EMPTY, bridgetown, 1);
    const near = state.npcs.filter(
      (n) => Math.hypot(n.ship.x - bridgetown.x, n.ship.y - bridgetown.y) <= 250,
    );
    expect(near.length).toBe(6);
    expect(state.nextNpcId).toBe(7);
    expect(new Set(state.npcs.map((n) => n.id)).size).toBe(state.npcs.length);
  });

  it('is deterministic', () => {
    const a = run(EMPTY, bridgetown, 20).state;
    const b = run(EMPTY, bridgetown, 20).state;
    expect(b).toEqual(a);
  });

  it('never lets an NPC sail onto land, and ships come and go', () => {
    const result = run(EMPTY, findPort(nav.ports, 'st-pierre').harbour, 90, (s) => {
      for (const n of s.npcs) expect(isLand(nav.world, n.ship.x, n.ship.y), n.name).toBe(false);
    });
    expect(result.spawned).toBeGreaterThan(6);
    expect(result.departed).toBeGreaterThan(0);
    expect(result.state.npcs.length).toBeLessThanOrEqual(10);
  });

  it('removes ships more than 320 px from the player', () => {
    const far = makeNpc({
      ship: { x: bridgetown.x - 400, y: bridgetown.y, headingRad: 0, speedKn: 0, sail: 'full' },
    });
    const r = stepNpcWorld(
      { npcs: [far], nextNpcId: 2, rngState: 1 },
      { nav, wind: windAt(0, 0, 8), player: bridgetown, hoursBefore: 8, hoursAfter: 8.01 },
      SIM_STEP_SECONDS,
    );
    expect(r.state.npcs).toHaveLength(0);
    expect(r.departed.map((n) => n.id)).toEqual([far.id]);
  });

  it('leaves the RNG untouched when nothing random happens', () => {
    const r = stepNpcWorld(
      EMPTY,
      { nav, wind: windAt(0, 0, 8), player: bridgetown, hoursBefore: 8.01, hoursAfter: 8.02 },
      SIM_STEP_SECONDS,
    );
    expect(r.state.rngState).toBe(EMPTY.rngState);
  });
});
