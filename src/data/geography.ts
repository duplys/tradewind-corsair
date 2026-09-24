// SPDX-License-Identifier: GPL-3.0-only
// Coarse, hand-made coastlines (slice 1 spec Appendix A). Coordinates are [lon, lat] in degrees.
// Clockwise order. The mainland closes through points beyond the map edges.

export type LonLat = readonly [lon: number, lat: number];

export interface IslandDef {
  readonly name: string;
  readonly points: readonly LonLat[];
}

export interface IsletDef {
  readonly name: string;
  readonly lon: number;
  readonly lat: number;
  readonly rxDeg: number;
  readonly ryDeg: number;
}

/** Every islet radius is at least this, so each one stays visible on the map. */
export const MIN_ISLET_RADIUS_DEG = 0.08;

// prettier-ignore
export const MAINLAND: readonly LonLat[] = [
  [-99, 31], [-80.5, 31], [-81.4, 30.2], [-80.6, 28.4], [-80.0, 26.8], [-80.1, 25.8],
  [-80.4, 25.2], [-81.1, 25.1], [-81.7, 25.9], [-82.6, 27.5], [-82.7, 28.6],
  [-83.7, 29.9], [-84.5, 30.0], [-85.4, 29.7], [-86.5, 30.4], [-88.0, 30.6],
  [-89.4, 30.2], [-89.2, 29.2], [-90.2, 29.1], [-91.5, 29.5], [-93.8, 29.7],
  [-95.0, 29.3], [-96.8, 28.2], [-97.4, 27.3], [-97.5, 25.9], [-97.8, 24.0],
  [-97.7, 22.0], [-97.2, 20.9], [-96.4, 19.3], [-95.0, 18.6], [-94.4, 18.2],
  [-92.9, 18.5], [-91.4, 18.6], [-90.7, 19.6], [-90.4, 20.9], [-89.5, 21.3],
  [-87.8, 21.5], [-87.0, 21.5], [-86.8, 20.8], [-87.4, 19.6], [-87.8, 18.4],
  [-88.3, 17.5], [-88.2, 16.0], [-88.9, 15.8], [-87.6, 15.8], [-86.0, 16.0],
  [-84.3, 15.8], [-83.4, 15.2], [-83.4, 14.0], [-83.6, 12.5], [-83.7, 11.0],
  [-83.0, 10.0], [-82.2, 9.2], [-81.4, 8.8], [-80.3, 9.2], [-79.5, 9.6],
  [-78.4, 9.3], [-77.3, 8.6], [-76.8, 8.1], [-76.0, 9.4], [-75.5, 10.6],
  [-74.8, 11.1], [-73.3, 11.3], [-72.2, 11.8], [-71.95, 12.4], [-71.3, 11.8],
  [-71.6, 11.0], [-71.55, 10.6], [-71.4, 10.9], [-70.9, 11.3], [-70.2, 11.55],
  [-70.0, 12.2], [-69.7, 11.5], [-68.4, 10.9], [-66.2, 10.6], [-64.4, 10.6],
  [-63.9, 10.7], [-62.3, 10.6], [-61.8, 10.7], [-61.0, 10.1], [-60.5, 8.5],
  [-59, 8.0], [-58, 6.5], [-99, 6.5],
];

// prettier-ignore
export const ISLANDS: readonly IslandDef[] = [
  { name: 'Cuba', points: [
    [-84.95, 21.85], [-84.0, 22.7], [-82.0, 23.15], [-80.5, 23.1], [-79.0, 22.4],
    [-77.2, 21.6], [-75.7, 21.1], [-74.15, 20.25], [-74.5, 20.0], [-75.8, 19.95],
    [-77.7, 19.85], [-77.1, 20.6], [-78.5, 21.5], [-80.5, 21.9], [-81.8, 22.2],
    [-83.0, 22.0], [-84.3, 21.9] ] },
  { name: 'Hispaniola', points: [
    [-74.45, 18.4], [-73.4, 19.8], [-72.8, 19.95], [-71.7, 19.9], [-70.0, 19.65],
    [-69.2, 19.1], [-68.35, 18.6], [-68.7, 18.2], [-69.9, 18.45], [-71.1, 18.2],
    [-71.7, 17.8], [-72.9, 18.15], [-73.9, 18.0] ] },
  { name: 'Jamaica', points: [
    [-78.35, 18.45], [-77.4, 18.5], [-76.3, 18.2], [-76.2, 17.9], [-77.2, 17.75],
    [-78.2, 18.15] ] },
  { name: 'Puerto Rico', points: [
    [-67.25, 18.5], [-65.6, 18.4], [-65.6, 18.0], [-67.2, 17.95] ] },
  { name: 'Trinidad', points: [
    [-61.9, 10.8], [-60.95, 10.85], [-61.0, 10.1], [-61.9, 10.05] ] },
  { name: 'Andros', points: [
    [-78.2, 25.1], [-77.7, 24.8], [-77.8, 24.0], [-78.3, 24.4] ] },
  { name: 'Grand Bahama', points: [
    [-79.0, 26.7], [-78.0, 26.7], [-78.0, 26.5], [-79.0, 26.55] ] },
  { name: 'Abaco', points: [
    [-77.3, 26.9], [-77.0, 26.5], [-77.1, 26.0], [-77.4, 26.4] ] },
  { name: 'Eleuthera', points: [
    [-76.7, 25.5], [-76.1, 25.1], [-76.2, 24.7], [-76.4, 25.0] ] },
];

/** [name, lon, lat, rxDeg, ryDeg] */
export type IsletTuple = readonly [string, number, number, number, number];

// prettier-ignore
export const ISLETS: readonly IsletTuple[] = [
  ['Isla de Pinos', -82.85, 21.7, 0.35, 0.22],
  ['Tortuga', -72.8, 20.14, 0.18, 0.05], // nudged north, see ADR 002
  ['New Providence', -77.35, 25.03, 0.2, 0.08],
  ['Exuma', -76.0, 23.6, 0.2, 0.1],
  ['Cat Island', -75.5, 24.3, 0.1, 0.3],
  ['Long Island', -75.1, 23.2, 0.1, 0.35],
  ['Great Inagua', -73.4, 21.05, 0.3, 0.15],
  ['Grand Cayman', -81.25, 19.32, 0.18, 0.08],
  ['Cozumel', -86.9, 20.4, 0.1, 0.18],
  ['Roatán', -86.5, 16.35, 0.3, 0.08],
  ['Virgin Islands', -64.8, 18.35, 0.15, 0.08],
  ['Anguilla', -63.05, 18.2, 0.08, 0.08],
  ['St. Eustatius', -62.98, 17.49, 0.08, 0.08],
  ['St. Kitts', -62.75, 17.3, 0.09, 0.08],
  ['Antigua', -61.8, 17.08, 0.12, 0.1],
  ['Guadeloupe', -61.55, 16.2, 0.25, 0.2],
  ['Dominica', -61.35, 15.42, 0.09, 0.2],
  ['Martinique', -61.0, 14.65, 0.13, 0.22],
  ['St. Lucia', -60.97, 13.9, 0.08, 0.17],
  ['St. Vincent', -61.2, 13.25, 0.08, 0.12],
  ['Barbados', -59.55, 13.15, 0.1, 0.13],
  ['Grenada', -61.68, 12.12, 0.08, 0.1],
  ['Tobago', -60.7, 11.23, 0.18, 0.08],
  ['Margarita', -64.0, 11.0, 0.3, 0.1],
  ['Aruba', -70.0, 12.5, 0.1, 0.08],
  ['Curaçao', -68.95, 12.2, 0.2, 0.08],
  ['Bonaire', -68.25, 12.2, 0.1, 0.08],
];

/** The islet tuples as typed records, with radii raised to the visible minimum. */
export function isletDefs(): IsletDef[] {
  return ISLETS.map(([name, lon, lat, rxDeg, ryDeg]) => ({
    name,
    lon,
    lat,
    rxDeg: Math.max(rxDeg, MIN_ISLET_RADIUS_DEG),
    ryDeg: Math.max(ryDeg, MIN_ISLET_RADIUS_DEG),
  }));
}
