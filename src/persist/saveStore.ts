// SPDX-License-Identifier: GPL-3.0-only
import type { Voyage } from '../sim/voyage';
import { LEGACY_SAVE_KEY_V1, parseSave, SAVE_KEY, toSaveData, type SaveContext } from './save';

/** The part of Web Storage the save needs; lets tests pass a fake. */
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Look up localStorage without throwing (it can throw in private windows or when blocked). */
export function browserStorage(): SaveStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The single save slot. Every storage access is wrapped so the game runs without storage.
 * An invalid save is ignored, never deleted. Saves are written as v2; a slice 1 (v1) save is
 * read and migrated only while no v2 save exists, and is left in place.
 */
export class SaveStore {
  constructor(
    private readonly storage: SaveStorage | null,
    private readonly ctx: SaveContext,
  ) {}

  load(): Voyage | null {
    if (!this.storage) return null;
    let text: string | null;
    try {
      text = this.storage.getItem(SAVE_KEY) ?? this.storage.getItem(LEGACY_SAVE_KEY_V1);
    } catch {
      return null;
    }
    return parseSave(text, this.ctx);
  }

  /** Returns false when the save could not be written (no storage, quota, blocked). */
  save(voyage: Voyage): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(toSaveData(voyage)));
      return true;
    } catch {
      return false;
    }
  }
}
