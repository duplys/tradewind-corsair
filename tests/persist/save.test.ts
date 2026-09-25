// SPDX-License-Identifier: GPL-3.0-only
import { beforeAll, describe, expect, it } from 'vitest';
import { PORTS } from '../../src/data/ports';
import {
  LEGACY_SAVE_KEY_V1,
  migrate,
  parseSave,
  SAVE_KEY,
  toSaveData,
  type SaveContext,
} from '../../src/persist/save';
import { SaveStore, type SaveStorage } from '../../src/persist/saveStore';
import { createRng, restoreRng } from '../../src/sim/rng';
import { dockAt, emptyStats, newVoyage, type Voyage } from '../../src/sim/voyage';
import { derivePorts, findPort, type Port } from '../../src/sim/world/ports';
import { lonLatToWorld } from '../../src/sim/world/projection';
import { buildWorld } from '../../src/sim/world/world';
import V1_FIXTURE from './fixtures/save-v1.json?raw';

// V1_FIXTURE: a save written by the slice 1 game (generated with that code, byte for byte).

let ctx: SaveContext;
let ports: Port[];
let voyage: Voyage;

beforeAll(() => {
  const world = buildWorld();
  ports = derivePorts(world, PORTS);
  ctx = { world, portIds: new Set(PORTS.map((p) => p.id)) };
  const v = newVoyage(world, ports, 424242);
  const stats = emptyStats();
  voyage = {
    ...v,
    ship: { ...v.ship, x: v.ship.x - 30.25, headingRad: -2.5, speedKn: 6.2, sail: 'half' },
    shipName: 'Kestrel',
    condition: { hullPct: 71.5, riggingPct: 42, crew: 33, gunsIntact: 6 },
    elapsedHours: 1234.5,
    gold: 950,
    hintsShown: 2,
    lastPortId: 'port-royal',
    rngState: 987654321,
    reputation: { es: -2, en: 3, fr: 0, nl: -1 },
    stats: {
      ...stats,
      captured: 2,
      sunk: 1,
      escapedFrom: 1,
      byNation: {
        ...stats.byNation,
        es: { captured: 2, sunk: 0 },
        pirate: { captured: 0, sunk: 1 },
      },
    },
  };
});

/** A v2 save of `voyage` with fields replaced (shallow; `ship` and `condition` merged). */
function v2With(
  changes: Record<string, unknown>,
  ship: Record<string, unknown> = {},
  condition: Record<string, unknown> = {},
): string {
  const data = toSaveData(voyage);
  return JSON.stringify({
    ...data,
    ...changes,
    ship: { ...data.ship, ...ship, condition: { ...data.ship.condition, ...condition } },
  });
}

/** The v1 fixture with fields replaced (shallow; `ship` merged). */
function v1With(changes: Record<string, unknown>, ship: Record<string, unknown> = {}): string {
  const data = JSON.parse(V1_FIXTURE) as Record<string, unknown>;
  return JSON.stringify({
    ...data,
    ...changes,
    ship: { ...(data.ship as Record<string, unknown>), ...ship },
  });
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

describe('save v2', () => {
  it('round-trips a voyage, including condition, RNG, reputation and stats', () => {
    const loaded = parseSave(JSON.stringify(toSaveData(voyage)), ctx);
    expect(loaded).toEqual({ ...voyage, dockedPortId: null });
  });

  it('writes the documented shape (slice 2 spec §11)', () => {
    const data = toSaveData(voyage);
    expect(Object.keys(data).sort()).toEqual(
      [
        'elapsedHours',
        'gold',
        'hintsShown',
        'lastPortId',
        'nextNpcId',
        'npcs',
        'reputation',
        'rngState',
        'ship',
        'stats',
        'version',
      ].sort(),
    );
    expect(data.version).toBe(2);
    expect(data.ship.name).toBe('Kestrel');
    expect(data.ship.condition).toEqual(voyage.condition);
    expect(data.npcs).toEqual([]);
  });

  it('restores the world RNG to continue the same sequence', () => {
    const rng = createRng(77);
    rng();
    rng();
    const withRng = { ...voyage, rngState: rng.state() };
    const loaded = parseSave(JSON.stringify(toSaveData(withRng)), ctx)!;
    const draw = (r: () => number) => Array.from({ length: 10 }, () => r());
    expect(draw(restoreRng(loaded.rngState))).toEqual(draw(rng));
  });

  it('loads a voyage saved in port as a voyage at sea near that port', () => {
    const docked = dockAt(voyage, findPort(ports, 'havana'));
    const loaded = parseSave(JSON.stringify(toSaveData(docked)), ctx);
    expect(loaded?.dockedPortId).toBeNull();
    expect(loaded?.lastPortId).toBe('havana');
    expect(loaded?.ship.speedKn).toBe(0);
  });

  it('normalises the heading on load', () => {
    const loaded = parseSave(v2With({}, { headingRad: 3 * Math.PI }), ctx);
    expect(loaded?.ship.headingRad).toBeCloseTo(Math.PI);
  });
});

describe('migration from v1', () => {
  it('loads a save written by the slice 1 game', () => {
    const v1 = JSON.parse(V1_FIXTURE) as { ship: Record<string, unknown>; crew: number };
    const loaded = parseSave(V1_FIXTURE, ctx);
    expect(loaded).not.toBeNull();
    expect(loaded!.ship).toEqual({ ...v1.ship });
    expect(loaded!.shipName).toBe('Swallow');
    expect(loaded!.condition).toEqual({ hullPct: 100, riggingPct: 100, crew: 40, gunsIntact: 8 });
    expect(loaded!.gold).toBe(1000);
    expect(loaded!.hintsShown).toBe(3);
    expect(loaded!.lastPortId).toBe('bridgetown');
    expect(loaded!.reputation).toEqual({ es: 0, en: 0, fr: 0, nl: 0 });
    expect(loaded!.stats).toEqual(emptyStats());
  });

  it('keeps the v1 crew, which slice 1 always wrote as 40', () => {
    expect(parseSave(v1With({ crew: 37 }), ctx)?.condition.crew).toBe(37);
  });

  it('seeds the world RNG deterministically from the v1 contents', () => {
    const a = parseSave(V1_FIXTURE, ctx)!.rngState;
    expect(parseSave(V1_FIXTURE, ctx)!.rngState).toBe(a);
    expect(parseSave(v1With({ gold: 999 }), ctx)!.rngState).not.toBe(a);
  });

  it('migrates to the current version and rejects unknown versions', () => {
    expect(migrate(JSON.parse(V1_FIXTURE))?.version).toBe(2);
    expect(migrate({ version: 0 })).toBeNull();
    expect(migrate({ version: 3 })).toBeNull();
    expect(parseSave(v1With({ version: '1' }), ctx)).toBeNull();
    expect(parseSave(v1With({ version: undefined }), ctx)).toBeNull();
    expect(parseSave(v2With({ version: 3 }), ctx)).toBeNull();
  });

  it('still rejects invalid v1 saves', () => {
    expect(parseSave(v1With({}, { x: null }), ctx)).toBeNull();
    expect(parseSave(v1With({}, { y: 'NaN' }), ctx)).toBeNull();
    expect(parseSave(v1With({ elapsedHours: null }), ctx)).toBeNull();
    expect(parseSave(v1With({}, { x: -1 }), ctx)).toBeNull();
    const jamaica = lonLatToWorld(-77.3, 18.1);
    expect(parseSave(v1With({}, { x: jamaica.x, y: jamaica.y }), ctx)).toBeNull();
    expect(parseSave(v1With({}, { sail: 'reefed' }), ctx)).toBeNull();
    expect(parseSave(v1With({}, { classId: 'galleon' }), ctx)).toBeNull();
    expect(parseSave(v1With({ lastPortId: 'atlantis' }), ctx)).toBeNull();
    expect(parseSave(v1With({ crew: 1.5 }), ctx)).toBeNull();
    expect(parseSave(v1With({ crew: undefined }), ctx)).toBeNull();
    expect(parseSave(v1With({ hintsShown: -1 }), ctx)).toBeNull();
    expect(parseSave(JSON.stringify({ ...JSON.parse(V1_FIXTURE), ship: 'sloop' }), ctx)).toBeNull();
  });
});

describe('save validation', () => {
  it('rejects missing, corrupt and non-object data', () => {
    expect(parseSave(null, ctx)).toBeNull();
    expect(parseSave('', ctx)).toBeNull();
    expect(parseSave('{not json', ctx)).toBeNull();
    expect(parseSave('42', ctx)).toBeNull();
    expect(parseSave('[]', ctx)).toBeNull();
    expect(parseSave('null', ctx)).toBeNull();
  });

  it('rejects non-finite numbers and bad positions', () => {
    expect(parseSave(v2With({}, { x: null }), ctx)).toBeNull();
    expect(parseSave(v2With({}, { headingRad: '1' }), ctx)).toBeNull();
    expect(parseSave(v2With({ gold: 'lots' }), ctx)).toBeNull();
    expect(parseSave(v2With({}, { y: 920 }), ctx)).toBeNull();
    const jamaica = lonLatToWorld(-77.3, 18.1);
    expect(parseSave(v2With({}, { x: jamaica.x, y: jamaica.y }), ctx)).toBeNull();
  });

  it('rejects a condition out of range', () => {
    expect(parseSave(v2With({}, {}, { hullPct: 101 }), ctx)).toBeNull();
    expect(parseSave(v2With({}, {}, { riggingPct: -1 }), ctx)).toBeNull();
    expect(parseSave(v2With({}, {}, { crew: 2.5 }), ctx)).toBeNull();
    expect(parseSave(v2With({}, {}, { gunsIntact: 9 }), ctx)).toBeNull();
    const data = toSaveData(voyage);
    const noCondition = { ...data, ship: { ...data.ship, condition: null } };
    expect(parseSave(JSON.stringify(noCondition), ctx)).toBeNull();
  });

  it('rejects a bad name, RNG state or NPC counter', () => {
    expect(parseSave(v2With({}, { name: '' }), ctx)).toBeNull();
    expect(parseSave(v2With({}, { name: 7 }), ctx)).toBeNull();
    expect(parseSave(v2With({ rngState: -1 }), ctx)).toBeNull();
    expect(parseSave(v2With({ rngState: 2 ** 32 }), ctx)).toBeNull();
    expect(parseSave(v2With({ rngState: 'seed' }), ctx)).toBeNull();
    expect(parseSave(v2With({ nextNpcId: 0 }), ctx)).toBeNull();
  });

  it('rejects malformed reputation and stats', () => {
    expect(parseSave(v2With({ reputation: { es: 0, en: 0, fr: 0 } }), ctx)).toBeNull();
    expect(parseSave(v2With({ reputation: { es: 'bad', en: 0, fr: 0, nl: 0 } }), ctx)).toBeNull();
    expect(parseSave(v2With({ stats: { ...emptyStats(), sunk: -1 } }), ctx)).toBeNull();
    const stats = emptyStats();
    const noPirate = Object.fromEntries(
      Object.entries(stats.byNation).filter(([id]) => id !== 'pirate'),
    );
    expect(parseSave(v2With({ stats: { ...stats, byNation: noPirate } }), ctx)).toBeNull();
  });

  it('rejects npcs that are not an array', () => {
    expect(parseSave(v2With({ npcs: {} }), ctx)).toBeNull();
    expect(parseSave(v2With({ npcs: undefined }), ctx)).toBeNull();
  });

  it('drops NPC entries with a warning but keeps the save', () => {
    const warnings: string[] = [];
    const warnCtx: SaveContext = { ...ctx, warn: (m) => warnings.push(m) };
    const loaded = parseSave(v2With({ npcs: [{ id: 1 }, 'junk'] }), warnCtx);
    expect(loaded).not.toBeNull();
    expect(warnings).toHaveLength(1);
    expect(toSaveData(loaded!).npcs).toEqual([]);
  });
});

describe('SaveStore', () => {
  it('saves v2 and loads it back', () => {
    const storage = new FakeStorage();
    const store = new SaveStore(storage, ctx);
    expect(store.load()).toBeNull();
    expect(store.save(voyage)).toBe(true);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!)).toMatchObject({ version: 2 });
    expect(store.load()?.elapsedHours).toBe(voyage.elapsedHours);
  });

  it('falls back to a slice 1 save and leaves it in place', () => {
    const storage = new FakeStorage();
    storage.setItem(LEGACY_SAVE_KEY_V1, V1_FIXTURE);
    const store = new SaveStore(storage, ctx);
    expect(store.load()?.shipName).toBe('Swallow');
    store.save(store.load()!);
    expect(storage.getItem(LEGACY_SAVE_KEY_V1)).toBe(V1_FIXTURE);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!)).toMatchObject({ version: 2 });
  });

  it('prefers the v2 save over the v1 save', () => {
    const storage = new FakeStorage();
    storage.setItem(LEGACY_SAVE_KEY_V1, V1_FIXTURE);
    storage.setItem(SAVE_KEY, JSON.stringify(toSaveData(voyage)));
    expect(new SaveStore(storage, ctx).load()?.shipName).toBe('Kestrel');
  });

  it('ignores an invalid save without deleting it', () => {
    const storage = new FakeStorage();
    storage.setItem(SAVE_KEY, '{"version":2,"broken":true}');
    expect(new SaveStore(storage, ctx).load()).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBe('{"version":2,"broken":true}');
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
