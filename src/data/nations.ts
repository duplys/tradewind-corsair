// SPDX-License-Identifier: GPL-3.0-only
// Nations (slice 1 spec §4). Flags are original, simplified pixel emblems.

export type NationId = 'es' | 'en' | 'fr' | 'nl';

/** A 3×2 pixel flag, row-major: [top-left, top-mid, top-right, bottom-left, ...]. */
export type FlagPixels = readonly [string, string, string, string, string, string];

export interface Nation {
  readonly id: NationId;
  readonly name: string;
  readonly flag: FlagPixels;
  /** Main colour, for map dots and small markers. */
  readonly color: string;
}

export const NATIONS: Readonly<Record<NationId, Nation>> = {
  es: {
    id: 'es',
    name: 'Spain',
    flag: ['#b3261e', '#e7c12e', '#b3261e', '#b3261e', '#e7c12e', '#b3261e'],
    color: '#b3261e',
  },
  en: {
    id: 'en',
    name: 'England',
    flag: ['#f2f2f2', '#c8102e', '#f2f2f2', '#c8102e', '#c8102e', '#c8102e'],
    color: '#c8102e',
  },
  fr: {
    id: 'fr',
    name: 'France',
    flag: ['#2a4fa8', '#f2f2f2', '#2a4fa8', '#2a4fa8', '#f2f2f2', '#2a4fa8'],
    color: '#2a4fa8',
  },
  nl: {
    id: 'nl',
    name: 'Dutch',
    flag: ['#e07a1f', '#f2f2f2', '#2a4fa8', '#e07a1f', '#f2f2f2', '#2a4fa8'],
    color: '#e07a1f',
  },
};
