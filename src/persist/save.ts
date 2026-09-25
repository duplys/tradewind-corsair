// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS, type NationId } from '../data/nations';
import { SAIL_ORDER, type SailSetting } from '../data/sailing';
import { SHIP_CLASSES, type ShipClassId } from '../data/ships';
import { DEFAULT_SHIP_NAME, FIRST_NPC_ID } from '../data/voyage';
import { normaliseAngle } from '../sim/math';
import { hashString, isRngState } from '../sim/rng';
import type { ShipCondition } from '../sim/ships/condition';
import {
  emptyStats,
  neutralReputation,
  STATS_NATIONS,
  type NationStats,
  type StatsNation,
  type Voyage,
  type VoyageStats,
} from '../sim/voyage';
import { isLand, type World } from '../sim/world/world';

/** localStorage key for the one save slot (slice 2 spec §11). */
export const SAVE_KEY = 'tradewind.save.v2';
/** Slice 1's key. Read (and migrated) only when there is no v2 save; never written. */
export const LEGACY_SAVE_KEY_V1 = 'tradewind.save.v1';
export const SAVE_VERSION = 2;

/** The saved JSON, version 1 (slice 1). Read only, through migration. */
export interface SaveV1 {
  readonly version: 1;
  readonly ship: {
    readonly x: number;
    readonly y: number;
    readonly headingRad: number;
    readonly speedKn: number;
    readonly sail: SailSetting;
    readonly classId: ShipClassId;
  };
  readonly elapsedHours: number;
  readonly gold: number;
  readonly crew: number;
  readonly hintsShown: number;
  readonly lastPortId: string;
}

/** The saved JSON, version 2 (slice 2 spec §11). The player's crew moved into the condition. */
export interface SaveV2 {
  readonly version: 2;
  readonly ship: SaveV1['ship'] & {
    readonly name: string;
    readonly condition: ShipCondition;
  };
  readonly elapsedHours: number;
  readonly gold: number;
  readonly hintsShown: number;
  readonly lastPortId: string;
  /** NPC ships at sea. Always empty until NPCs exist (slice 2 M2). */
  readonly npcs: readonly never[];
  readonly nextNpcId: number;
  readonly rngState: number;
  readonly reputation: Readonly<Record<NationId, number>>;
  readonly stats: VoyageStats;
}

export function toSaveData(voyage: Voyage): SaveV2 {
  const { x, y, headingRad, speedKn, sail, classId } = voyage.ship;
  return {
    version: 2,
    ship: {
      x,
      y,
      headingRad,
      speedKn,
      sail,
      classId,
      name: voyage.shipName,
      condition: { ...voyage.condition },
    },
    elapsedHours: voyage.elapsedHours,
    gold: voyage.gold,
    hintsShown: voyage.hintsShown,
    lastPortId: voyage.lastPortId,
    npcs: [],
    nextNpcId: FIRST_NPC_ID,
    rngState: voyage.rngState,
    reputation: { ...voyage.reputation },
    stats: voyage.stats,
  };
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCount(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isPercent(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

function isShipClassId(value: unknown): value is ShipClassId {
  return typeof value === 'string' && Object.hasOwn(SHIP_CLASSES, value);
}

/**
 * v1 → v2 (slice 2 spec §11): the player's sloop gets a name and a full condition with its v1
 * crew and all its guns; there are no NPCs yet; reputation and stats start at zero; and the
 * world RNG is seeded from a hash of the v1 save, so the same save always migrates the same way.
 * Only restructures: the result is validated afterwards like any v2 save.
 */
function migrateV1toV2(v1: Json): Json {
  const ship = isObject(v1.ship) ? v1.ship : {};
  return {
    version: 2,
    ship: {
      ...ship,
      name: DEFAULT_SHIP_NAME,
      condition: {
        hullPct: 100,
        riggingPct: 100,
        crew: v1.crew,
        gunsIntact: isShipClassId(ship.classId) ? SHIP_CLASSES[ship.classId].guns : undefined,
      },
    },
    elapsedHours: v1.elapsedHours,
    gold: v1.gold,
    hintsShown: v1.hintsShown,
    lastPortId: v1.lastPortId,
    npcs: [],
    nextNpcId: FIRST_NPC_ID,
    rngState: hashString(JSON.stringify(v1)),
    reputation: neutralReputation(),
    stats: emptyStats(),
  };
}

/**
 * Bring a save of any known version up to the current one, one step at a time. Returns null
 * for data that is not an object or has an unknown version.
 */
export function migrate(raw: unknown): Json | null {
  if (!isObject(raw)) return null;
  let save = raw;
  if (save.version === 1) save = migrateV1toV2(save);
  return save.version === SAVE_VERSION ? save : null;
}

export interface SaveContext {
  readonly world: World;
  readonly portIds: ReadonlySet<string>;
  /** Told about recoverable problems, such as a dropped NPC. Dev builds log them. */
  readonly warn?: (message: string) => void;
}

function validateCondition(raw: unknown, classId: ShipClassId): ShipCondition | null {
  if (!isObject(raw)) return null;
  const { hullPct, riggingPct, crew, gunsIntact } = raw;
  if (!isPercent(hullPct) || !isPercent(riggingPct) || !isCount(crew)) return null;
  if (!isCount(gunsIntact) || gunsIntact > SHIP_CLASSES[classId].guns) return null;
  return { hullPct, riggingPct, crew, gunsIntact };
}

function validateReputation(raw: unknown): Record<NationId, number> | null {
  if (!isObject(raw)) return null;
  const reputation = neutralReputation() as Record<NationId, number>;
  for (const id of Object.keys(NATIONS) as NationId[]) {
    const value = raw[id];
    if (!isFiniteNumber(value)) return null;
    reputation[id] = value;
  }
  return reputation;
}

function validateStats(raw: unknown): VoyageStats | null {
  if (!isObject(raw) || !isObject(raw.byNation)) return null;
  const { captured, sunk, defeats, escapedFrom } = raw;
  if (!isCount(captured) || !isCount(sunk) || !isCount(defeats) || !isCount(escapedFrom)) {
    return null;
  }
  const byNation = {} as Record<StatsNation, NationStats>;
  for (const id of STATS_NATIONS) {
    const entry = raw.byNation[id];
    if (!isObject(entry) || !isCount(entry.captured) || !isCount(entry.sunk)) return null;
    byNation[id] = { captured: entry.captured, sunk: entry.sunk };
  }
  return { captured, sunk, defeats, escapedFrom, byNation };
}

/**
 * Check every field of a migrated save (slice 1 spec §11, slice 2 spec §11); returns the typed
 * save or null. NPC entries are dropped individually without invalidating the save; until NPC
 * ships exist (slice 2 M2) every entry is dropped.
 */
export function validateSave(raw: Json, ctx: SaveContext): SaveV2 | null {
  const ship = raw.ship;
  if (!isObject(ship)) return null;
  const { x, y, headingRad, speedKn, sail, classId, name } = ship;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  if (!isFiniteNumber(headingRad) || !isFiniteNumber(speedKn) || speedKn < 0) return null;
  if (typeof sail !== 'string' || !(SAIL_ORDER as readonly string[]).includes(sail)) return null;
  if (!isShipClassId(classId)) return null;
  if (typeof name !== 'string' || name.trim() === '') return null;
  const condition = validateCondition(ship.condition, classId);
  if (!condition) return null;

  const { elapsedHours, gold, hintsShown, lastPortId, rngState, nextNpcId, npcs } = raw;
  if (!isFiniteNumber(elapsedHours) || elapsedHours < 0) return null;
  if (!isFiniteNumber(gold) || !isCount(hintsShown)) return null;
  if (typeof lastPortId !== 'string' || !ctx.portIds.has(lastPortId)) return null;
  if (!isRngState(rngState)) return null;
  if (!isCount(nextNpcId) || nextNpcId < FIRST_NPC_ID) return null;
  if (!Array.isArray(npcs)) return null;
  const reputation = validateReputation(raw.reputation);
  const stats = validateStats(raw.stats);
  if (!reputation || !stats) return null;

  const { world } = ctx;
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return null;
  if (isLand(world, x, y)) return null;

  if (npcs.length > 0) {
    ctx.warn?.(`Save: dropped ${npcs.length} NPC ship(s); NPCs are not supported yet.`);
  }

  return {
    version: 2,
    ship: {
      x,
      y,
      headingRad,
      speedKn,
      sail: sail as SailSetting,
      classId,
      name,
      condition,
    },
    elapsedHours,
    gold,
    hintsShown,
    lastPortId,
    npcs: [],
    nextNpcId,
    rngState,
    reputation,
    stats,
  };
}

/**
 * Turn saved JSON text (any known version) into a voyage at sea, or null if it is missing,
 * corrupt or invalid.
 */
export function parseSave(text: string | null, ctx: SaveContext): Voyage | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const migrated = migrate(raw);
  const save = migrated && validateSave(migrated, ctx);
  if (!save) return null;
  const { name, condition, ...ship } = save.ship;
  return {
    ship: { ...ship, headingRad: normaliseAngle(ship.headingRad) },
    shipName: name,
    condition,
    elapsedHours: save.elapsedHours,
    lastPortId: save.lastPortId,
    dockedPortId: null,
    gold: save.gold,
    hintsShown: save.hintsShown,
    rngState: save.rngState,
    reputation: save.reputation,
    stats: save.stats,
  };
}
