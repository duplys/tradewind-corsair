// SPDX-License-Identifier: GPL-3.0-only
// Tunable engine constants. Gameplay balance tables join this module in later milestones.

/** Fixed simulation step in seconds (spec §2, CLAUDE.md architecture rule 2). */
export const SIM_STEP_SECONDS = 1 / 60;

/** Longest frame delta the loop accepts, so a background tab does not fast-forward the world. */
export const MAX_FRAME_SECONDS = 0.25;

/** How long boot waits for web fonts before drawing anyway (spec §2). */
export const FONT_WAIT_TIMEOUT_MS = 1500;

/** Seed for the map's terrain noise. Changing it changes the look of every coast. */
export const MAP_SEED = 1660;
