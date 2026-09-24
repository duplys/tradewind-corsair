// SPDX-License-Identifier: GPL-3.0-only
// All user-facing text, in one place so it can be translated later.
import type { PointOfSail, SailSetting } from './sailing';

export const STRINGS = {
  loading: 'Charting the West Indies…',
  shoal: 'Breakers ahead! Bring her about.',
  months: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
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
  hud: {
    shipLine: (shipName: string, guns: number) => `${shipName} · ${guns} guns`,
    chart: 'Chart (M)',
    comingSoon: 'Coming soon',
    course: (bearing: string, point: string) => `Course ${bearing}° ${point}`,
    speed: (knots: string, pointOfSail: string) => `${knots} kn · ${pointOfSail}`,
    wind: (point: string, knots: number) => `Wind ${point} ${knots} kn`,
    compassLabel: 'Compass: heading and wind',
  },
  port: {
    dropAnchor: (portName: string) => `Drop anchor at ${portName}`,
    governor: 'Governor',
    tavern: 'Tavern',
    merchant: 'Merchant',
    shipwright: 'Shipwright',
    comingSoon: 'Coming soon',
    setSail: 'Set sail',
    flagOf: (nationName: string) => `Flag of ${nationName}`,
  },
  touch: {
    port: '◀',
    portLabel: 'Turn to port',
    starboard: '▶',
    starboardLabel: 'Turn to starboard',
    reef: 'Reef',
    reefLabel: 'Reef: take in sail',
    hoist: 'Hoist',
    hoistLabel: 'Hoist: make more sail',
  },
} as const;
