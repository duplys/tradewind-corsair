// SPDX-License-Identifier: GPL-3.0-only
import type { Voyage } from '../sim/voyage';

/** The current voyage, shared by the modes. Modes replace `voyage` with each new state. */
export interface Session {
  voyage: Voyage;
}
