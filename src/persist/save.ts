// SPDX-License-Identifier: GPL-3.0-only
import { SAIL_ORDER, type SailSetting } from '../data/sailing';
import { SHIP_CLASSES, type ShipClassId } from '../data/ships';
import { normaliseAngle } from '../sim/math';
import type { Voyage } from '../sim/voyage';
import { isLand, type World } from '../sim/world/world';

/** localStorage key for the one save slot (slice 1 spec §11). */
export const SAVE_KEY = 'tradewind.save.v1';
export const SAVE_VERSION = 1;

/** The saved JSON, version 1. */
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

export function toSaveData(voyage: Voyage): SaveV1 {
  const { x, y, headingRad, speedKn, sail, classId } = voyage.ship;
  return {
    version: 1,
    ship: { x, y, headingRad, speedKn, sail, classId },
    elapsedHours: voyage.elapsedHours,
    gold: voyage.gold,
    crew: voyage.crew,
    hintsShown: voyage.hintsShown,
    lastPortId: voyage.lastPortId,
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

/**
 * Bring an older save up to the current version. Only version 1 exists, so this passes v1
 * through and rejects everything else; it is the hook for future schema changes.
 */
export function migrate(raw: unknown): Json | null {
  if (!isObject(raw)) return null;
  if (raw.version === SAVE_VERSION) return raw;
  return null;
}

export interface SaveContext {
  readonly world: World;
  readonly portIds: ReadonlySet<string>;
}

/** Check every field of a migrated save (spec §11); returns the typed save or null. */
export function validateSave(raw: Json, ctx: SaveContext): SaveV1 | null {
  const ship = raw.ship;
  if (!isObject(ship)) return null;
  const { x, y, headingRad, speedKn, sail, classId } = ship;
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
  if (!isFiniteNumber(headingRad) || !isFiniteNumber(speedKn) || speedKn < 0) return null;
  if (typeof sail !== 'string' || !(SAIL_ORDER as readonly string[]).includes(sail)) return null;
  if (typeof classId !== 'string' || !Object.hasOwn(SHIP_CLASSES, classId)) return null;
  const { elapsedHours, gold, crew, hintsShown, lastPortId } = raw;
  if (!isFiniteNumber(elapsedHours) || elapsedHours < 0) return null;
  if (!isFiniteNumber(gold) || !isCount(crew) || !isCount(hintsShown)) return null;
  if (typeof lastPortId !== 'string' || !ctx.portIds.has(lastPortId)) return null;
  const { world } = ctx;
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return null;
  if (isLand(world, x, y)) return null;
  return {
    version: 1,
    ship: { x, y, headingRad, speedKn, sail: sail as SailSetting, classId: classId as ShipClassId },
    elapsedHours,
    gold,
    crew,
    hintsShown,
    lastPortId,
  };
}

/** Turn saved JSON text into a voyage at sea, or null if it is missing, corrupt or invalid. */
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
  return {
    ship: { ...save.ship, headingRad: normaliseAngle(save.ship.headingRad) },
    elapsedHours: save.elapsedHours,
    lastPortId: save.lastPortId,
    dockedPortId: null,
    gold: save.gold,
    crew: save.crew,
    hintsShown: save.hintsShown,
  };
}
