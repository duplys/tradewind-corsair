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
