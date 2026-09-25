// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { PORTS } from '../../src/data/ports';
import { migrate, parseSave, SAVE_KEY, toSaveData, type SaveContext } from '../../src/persist/save';
import { SaveStore, type SaveStorage } from '../../src/persist/saveStore';
import { dockAt, newVoyage, type Voyage } from '../../src/sim/voyage';
import { derivePorts, findPort, type Port } from '../../src/sim/world/ports';
import { lonLatToWorld } from '../../src/sim/world/projection';
import { buildWorld } from '../../src/sim/world/world';

let ctx: SaveContext;
let ports: Port[];
let voyage: Voyage;

beforeAll(() => {
  const world = buildWorld();
  ports = derivePorts(world, PORTS);
  ctx = { world, portIds: new Set(PORTS.map((p) => p.id)) };
  const v = newVoyage(world, ports);
  voyage = {
    ...v,
    ship: { ...v.ship, x: v.ship.x - 30.25, headingRad: -2.5, speedKn: 6.2, sail: 'half' },
    elapsedHours: 1234.5,
    gold: 950,
    crew: 38,
    hintsShown: 2,
    lastPortId: 'port-royal',
  };
});

/** Save JSON with some fields replaced (deep for ship). */
function withChanges(changes: Record<string, unknown>, ship: Record<string, unknown> = {}): string {
  const data = toSaveData(voyage);
  return JSON.stringify({ ...data, ...changes, ship: { ...data.ship, ...ship } });
}

class FakeStorage implements SaveStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

describe('parseSave', () => {
  it('round-trips a voyage', () => {
    const loaded = parseSave(JSON.stringify(toSaveData(voyage)), ctx);
    expect(loaded).toEqual({ ...voyage, dockedPortId: null });
  });

  it('loads a voyage saved in port as a voyage at sea near that port', () => {
    const docked = dockAt(voyage, findPort(ports, 'havana'));
    const loaded = parseSave(JSON.stringify(toSaveData(docked)), ctx);
    expect(loaded?.dockedPortId).toBeNull();
    expect(loaded?.lastPortId).toBe('havana');
    expect(loaded?.ship.speedKn).toBe(0);
  });

  it('writes the documented shape', () => {
    expect(Object.keys(toSaveData(voyage)).sort()).toEqual(
      ['crew', 'elapsedHours', 'gold', 'hintsShown', 'lastPortId', 'ship', 'version'].sort(),
    );
    expect(toSaveData(voyage).version).toBe(1);
  });

  it('rejects missing, corrupt and non-object data', () => {
    expect(parseSave(null, ctx)).toBeNull();
    expect(parseSave('', ctx)).toBeNull();
    expect(parseSave('{not json', ctx)).toBeNull();
    expect(parseSave('42', ctx)).toBeNull();
    expect(parseSave('[]', ctx)).toBeNull();
    expect(parseSave('null', ctx)).toBeNull();
  });

  it('rejects unknown versions', () => {
    expect(parseSave(withChanges({ version: 2 }), ctx)).toBeNull();
    expect(parseSave(withChanges({ version: '1' }), ctx)).toBeNull();
    expect(parseSave(withChanges({ version: undefined }), ctx)).toBeNull();
    expect(migrate({ version: 0 })).toBeNull();
  });

  it('rejects non-finite numbers', () => {
    // JSON cannot hold NaN or Infinity; they arrive as null or as strings.
    expect(parseSave(withChanges({}, { x: null }), ctx)).toBeNull();
    expect(parseSave(withChanges({}, { y: 'NaN' }), ctx)).toBeNull();
    expect(parseSave(withChanges({ elapsedHours: null }), ctx)).toBeNull();
    expect(parseSave(withChanges({}, { headingRad: '1' }), ctx)).toBeNull();
    expect(parseSave(withChanges({ gold: 'lots' }), ctx)).toBeNull();
  });

  it('rejects positions outside the world or on land', () => {
    expect(parseSave(withChanges({}, { x: -1 }), ctx)).toBeNull();
    expect(parseSave(withChanges({}, { y: 920 }), ctx)).toBeNull();
    expect(parseSave(withChanges({}, { x: 1e9 }), ctx)).toBeNull();
    const jamaica = lonLatToWorld(-77.3, 18.1);
    expect(parseSave(withChanges({}, { x: jamaica.x, y: jamaica.y }), ctx)).toBeNull();
  });

  it('rejects wrong types and unknown ids', () => {
    expect(parseSave(withChanges({}, { sail: 'reefed' }), ctx)).toBeNull();
    expect(parseSave(withChanges({}, { classId: 'galleon' }), ctx)).toBeNull();
    expect(parseSave(withChanges({}, { speedKn: -1 }), ctx)).toBeNull();
    expect(parseSave(withChanges({ lastPortId: 'atlantis' }), ctx)).toBeNull();
    expect(parseSave(withChanges({ crew: 1.5 }), ctx)).toBeNull();
    expect(parseSave(withChanges({ hintsShown: -1 }), ctx)).toBeNull();
    expect(parseSave(JSON.stringify({ ...toSaveData(voyage), ship: 'sloop' }), ctx)).toBeNull();
  });

  it('normalises the heading on load', () => {
    const loaded = parseSave(withChanges({}, { headingRad: 3 * Math.PI }), ctx);
    expect(loaded?.ship.headingRad).toBeCloseTo(Math.PI);
  });
});

describe('SaveStore', () => {
  it('saves and loads through storage', () => {
    const storage = new FakeStorage();
    const store = new SaveStore(storage, ctx);
    expect(store.load()).toBeNull();
    expect(store.save(voyage)).toBe(true);
    expect(storage.items.has(SAVE_KEY)).toBe(true);
    expect(store.load()?.elapsedHours).toBe(voyage.elapsedHours);
  });

  it('ignores an invalid save without deleting it', () => {
    const storage = new FakeStorage();
    storage.setItem(SAVE_KEY, '{"version":1,"broken":true}');
    expect(new SaveStore(storage, ctx).load()).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBe('{"version":1,"broken":true}');
  });

  it('runs without storage, or when storage throws', () => {
    expect(new SaveStore(null, ctx).load()).toBeNull();
    expect(new SaveStore(null, ctx).save(voyage)).toBe(false);
    const throwing: SaveStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = new SaveStore(throwing, ctx);
    expect(store.load()).toBeNull();
    expect(store.save(voyage)).toBe(false);
  });
});
