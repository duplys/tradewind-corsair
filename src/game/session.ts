// SPDX-License-Identifier: GPL-3.0-only
import type { Voyage } from '../sim/voyage';

/** An encounter in progress (slice 2 spec §5.3): with whom, and who started it. */
export interface Encounter {
  readonly npcId: number;
  readonly initiator: 'player' | 'npc';
  /** The player tried to run and was caught: the enemy starts closer (spec §6.2). */
  readonly escapeFailed: boolean;
}

/** State shared by the modes. Modes replace `voyage` with each new state. */
export interface Session {
  voyage: Voyage;
  encounter: Encounter | null;
  /** A message for the sailing mode to show when it resumes (e.g. after an escape). */
  notice: string | null;
}
