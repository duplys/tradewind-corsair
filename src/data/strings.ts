// SPDX-License-Identifier: GPL-3.0-only
// All user-facing text, in one place so it can be translated later.
import type { PointOfSail, SailSetting } from './sailing';

export const STRINGS = {
  loading: 'Charting the West Indies…',
  shoal: 'Breakers ahead! Bring her about.',
  pointOfSail: {
    running: 'Running',
    broadReach: 'Broad reach',
    beamReach: 'Beam reach',
    closeHauled: 'Close-hauled',
    inIrons: 'In irons',
  } satisfies Record<PointOfSail, string>,
  sail: {
    furled: 'Sail furled',
    half: 'Half sail',
    full: 'Full sail',
  } satisfies Record<SailSetting, string>,
} as const;
