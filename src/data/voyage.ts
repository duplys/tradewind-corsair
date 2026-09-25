// SPDX-License-Identifier: GPL-3.0-only
// Voyage-level tuning (slice 1 spec §9.6, §10, §11).

/** Stored for later slices; not shown in this slice except in the save. */
export const START_GOLD = 1000;
export const START_CREW = 40;

/** Auto-save every this many real seconds of sailing. */
export const AUTOSAVE_INTERVAL_SEC = 30;

/** The first hint appears this long after a voyage starts; later ones this far apart. */
export const HINT_FIRST_DELAY_SEC = 1;
export const HINT_INTERVAL_SEC = 5;

/** The player's ship name until renaming arrives (slice 2 spec §3.3). */
export const DEFAULT_SHIP_NAME = 'Swallow';

/**
 * World RNG seed for a voyage created without one (the title screen preview and tests). Real
 * new voyages get a fresh seed from the game layer.
 */
export const DEFAULT_VOYAGE_SEED = 1660;

/** NPC ids start here and count up within a save (slice 2 spec §4.1). */
export const FIRST_NPC_ID = 1;
