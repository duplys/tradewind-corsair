// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS, type NationId } from '../data/nations';
import type { NpcRole } from '../data/npc';
import type { Allegiance } from '../data/relations';
import { SAIL_ORDER, type SailSetting } from '../data/sailing';
import { GOOD_IDS, type GoodId } from '../data/goods';
import { SHIP_CLASSES, type ShipClassId } from '../data/ships';
import { DEFAULT_SHIP_NAME, FIRST_NPC_ID } from '../data/voyage';
import { normaliseAngle } from '../sim/math';
import type { NpcIntent, NpcShip } from '../sim/npc/npc';
import { hashString, isRngState } from '../sim/rng';
import type { FlowEntry, TradeFlow } from '../sim/trade/market';
import { NO_BOUNTY, type Bounty, type Claimed } from '../sim/governor/governor';
import type { TreasureSite } from '../sim/tavern/treasure';
import { cargoUsed, emptyCargo, type Cargo } from '../sim/trade/trade';
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
  /** NPC ships at sea, exactly as the simulation holds them. */
  readonly npcs: readonly NpcShip[];
  readonly nextNpcId: number;
  readonly rngState: number;
  readonly reputation: Readonly<Record<NationId, number>>;
  readonly stats: VoyageStats;
  /**
   * Slice 4 fields. Optional in the file, so every older v2 save still loads (it gets an empty
   * hold, no price pressure and no treasure); always written.
   */
  readonly cargo?: Cargo;
  readonly tradeFlow?: TradeFlow;
  readonly treasures?: readonly TreasureSite[];
  /** Governor fields (optional like the slice 4 ones above). */
  readonly bounty?: Bounty;
  readonly claimed?: Claimed;
}

/** A save after validation: the slice 4 fields are always present. */
export type ValidSave = SaveV2 & {
  readonly cargo: Cargo;
  readonly tradeFlow: TradeFlow;
  readonly treasures: readonly TreasureSite[];
  readonly bounty: Bounty;
  readonly claimed: Claimed;
};

export function toSaveData(voyage: Voyage): ValidSave {
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
    npcs: voyage.npcs,
    nextNpcId: voyage.nextNpcId,
    rngState: voyage.rngState,
    reputation: { ...voyage.reputation },
    stats: voyage.stats,
    cargo: { ...voyage.cargo },
    tradeFlow: voyage.tradeFlow,
    treasures: voyage.treasures,
    bounty: voyage.bounty,
    claimed: { ...voyage.claimed },
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
  const cls = SHIP_CLASSES[classId];
  if (!isPercent(hullPct) || !isPercent(riggingPct)) return null;
  if (!isCount(crew) || crew > cls.crewMax) return null;
  if (!isCount(gunsIntact) || gunsIntact > cls.guns) return null;
  return { hullPct, riggingPct, crew, gunsIntact };
}

const NPC_ROLES: readonly NpcRole[] = ['trader', 'warship', 'pirate'];
const NPC_INTENTS: readonly NpcIntent[] = ['travel', 'chase', 'flee', 'ignore-player'];
const MAX_NPC_PATH_POINTS = 1000;

function isPoint(value: unknown): value is Json & { x: number; y: number } {
  return isObject(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isAllegiance(value: unknown): value is Allegiance {
  return value === 'pirate' || (typeof value === 'string' && Object.hasOwn(NATIONS, value));
}

/**
 * One saved NPC (slice 2 spec §11): on water inside the world, a known class, nation, role and
 * destination, a valid condition and well-formed navigation state. Null if anything is off.
 */
function validateNpc(raw: unknown, ctx: SaveContext): NpcShip | null {
  if (!isObject(raw)) return null;
  const { id, classId, nation, role, name, ship, destPortId, path, tack, intent } = raw;
  if (!isCount(id) || id < FIRST_NPC_ID || !isShipClassId(classId) || !isAllegiance(nation)) {
    return null;
  }
  if (typeof role !== 'string' || !(NPC_ROLES as readonly string[]).includes(role)) return null;
  if ((nation === 'pirate') !== (role === 'pirate')) return null;
  if (typeof name !== 'string' || name.trim() === '') return null;
  if (typeof destPortId !== 'string' || !ctx.portIds.has(destPortId)) return null;
  if (typeof intent !== 'string' || !(NPC_INTENTS as readonly string[]).includes(intent))
    return null;
  if (!isFiniteNumber(raw.ignorePlayerUntilHours) || !isFiniteNumber(raw.targetHeadingRad)) {
    return null;
  }
  if (!isFiniteNumber(raw.loiterUntilHours) || !isFiniteNumber(raw.intentSinceHours)) return null;
  if (!isObject(ship) || !isPoint(ship) || !isFiniteNumber(ship.headingRad)) return null;
  if (!isFiniteNumber(ship.speedKn) || ship.speedKn < 0) return null;
  if (typeof ship.sail !== 'string' || !(SAIL_ORDER as readonly string[]).includes(ship.sail)) {
    return null;
  }
  const { world } = ctx;
  if (ship.x < 0 || ship.y < 0 || ship.x >= world.width || ship.y >= world.height) return null;
  if (isLand(world, ship.x, ship.y)) return null;
  const condition = validateCondition(raw.condition, classId);
  if (!condition) return null;
  if (!Array.isArray(path) || path.length > MAX_NPC_PATH_POINTS || !path.every(isPoint)) {
    return null;
  }
  let validTack: NpcShip['tack'] = null;
  if (tack !== null) {
    if (!isObject(tack) || (tack.side !== 1 && tack.side !== -1)) return null;
    if (!isFiniteNumber(tack.untilHours)) return null;
    validTack = { side: tack.side, untilHours: tack.untilHours };
  }
  const { home, progress } = raw;
  if (!isPoint(home) || !isPoint(progress) || !isFiniteNumber(progress.atHours)) return null;
  return {
    id,
    classId,
    nation,
    role: role as NpcRole,
    name,
    ship: {
      x: ship.x,
      y: ship.y,
      headingRad: normaliseAngle(ship.headingRad),
      speedKn: ship.speedKn,
      sail: ship.sail as SailSetting,
    },
    condition,
    destPortId,
    path: path.map((p) => ({ x: p.x, y: p.y })),
    tack: validTack,
    intent: intent as NpcIntent,
    intentSinceHours: raw.intentSinceHours,
    ignorePlayerUntilHours: raw.ignorePlayerUntilHours,
    home: { x: home.x, y: home.y },
    loiterUntilHours: raw.loiterUntilHours,
    targetHeadingRad: raw.targetHeadingRad,
    progress: { x: progress.x, y: progress.y, atHours: progress.atHours },
  };
}

/** Keep the valid NPCs (first of any duplicate id), dropping the rest with one warning. */
function validateNpcs(raw: readonly unknown[], ctx: SaveContext): NpcShip[] {
  const kept: NpcShip[] = [];
  const ids = new Set<number>();
  for (const entry of raw) {
    const npc = validateNpc(entry, ctx);
    if (npc && !ids.has(npc.id)) {
      kept.push(npc);
      ids.add(npc.id);
    }
  }
  const dropped = raw.length - kept.length;
  if (dropped > 0) ctx.warn?.(`Save: dropped ${dropped} invalid NPC ship(s).`);
  return kept;
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

/** The hold: a count for each good, no more than the ship can carry. Missing means empty. */
function validateCargo(raw: unknown, classId: ShipClassId): Cargo | null {
  if (raw === undefined) return emptyCargo();
  if (!isObject(raw)) return null;
  const cargo = {} as Record<GoodId, number>;
  for (const id of GOOD_IDS) {
    const n = raw[id];
    if (!isCount(n)) return null;
    cargo[id] = n;
  }
  return cargoUsed(cargo) <= SHIP_CLASSES[classId].holdCapacity ? cargo : null;
}

/** Price pressure: known goods and ports, finite numbers. Bad entries are dropped. */
function validateTradeFlow(raw: unknown, ctx: SaveContext): TradeFlow | null {
  if (raw === undefined) return {};
  if (!isObject(raw)) return null;
  const flow: Record<string, FlowEntry> = {};
  for (const [key, entry] of Object.entries(raw)) {
    const [portId, good] = key.split('/');
    if (!portId || !ctx.portIds.has(portId) || !(GOOD_IDS as readonly string[]).includes(good!)) {
      continue;
    }
    if (!isObject(entry) || !isFiniteNumber(entry.net) || !isFiniteNumber(entry.atHours)) continue;
    flow[key] = { net: entry.net, atHours: entry.atHours };
  }
  return flow;
}

/** Treasure sites on land inside the world. Bad entries are dropped. */
function validateTreasures(raw: unknown, ctx: SaveContext): TreasureSite[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const { world } = ctx;
  const sites: TreasureSite[] = [];
  for (const entry of raw) {
    if (!isPoint(entry)) continue;
    if (entry.x < 0 || entry.y < 0 || entry.x >= world.width || entry.y >= world.height) continue;
    sites.push({ x: entry.x, y: entry.y });
  }
  return sites;
}

/** Unclaimed bounty: two non-negative amounts. Missing means none. */
function validateBounty(raw: unknown): Bounty | null {
  if (raw === undefined) return NO_BOUNTY;
  if (!isObject(raw)) return null;
  const { pirate, crown } = raw;
  const ok = (n: unknown): n is number => isFiniteNumber(n) && n >= 0;
  return ok(pirate) && ok(crown) ? { pirate, crown } : null;
}

/** Gold claimed per nation: non-negative numbers. Missing means none. */
function validateClaimed(raw: unknown): Claimed | null {
  if (raw === undefined) return neutralReputation();
  if (!isObject(raw)) return null;
  const claimed = neutralReputation() as Record<NationId, number>;
  for (const id of Object.keys(NATIONS) as NationId[]) {
    const value = raw[id];
    if (!isFiniteNumber(value) || value < 0) return null;
    claimed[id] = value;
  }
  return claimed;
}

/**
 * Check every field of a migrated save (slice 1 spec §11, slice 2 spec §11); returns the typed
 * save or null. Invalid NPC entries are dropped individually without invalidating the save.
 */
export function validateSave(raw: Json, ctx: SaveContext): ValidSave | null {
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
  const cargo = validateCargo(raw.cargo, classId);
  const tradeFlow = validateTradeFlow(raw.tradeFlow, ctx);
  const treasures = validateTreasures(raw.treasures, ctx);
  const bounty = validateBounty(raw.bounty);
  const claimed = validateClaimed(raw.claimed);
  if (!cargo || !tradeFlow || !treasures || !bounty || !claimed) return null;

  const { world } = ctx;
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return null;
  if (isLand(world, x, y)) return null;

  const validNpcs = validateNpcs(npcs, ctx);
  // Never hand out an id that a saved NPC already has.
  const safeNextId = Math.max(nextNpcId, ...validNpcs.map((n) => n.id + 1));

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
    npcs: validNpcs,
    nextNpcId: safeNextId,
    rngState,
    reputation,
    stats,
    cargo,
    tradeFlow,
    treasures,
    bounty,
    claimed,
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
    npcs: save.npcs,
    nextNpcId: save.nextNpcId,
    cargo: save.cargo,
    tradeFlow: save.tradeFlow,
    treasures: save.treasures,
    bounty: save.bounty,
    claimed: save.claimed,
  };
}
