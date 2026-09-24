// SPDX-License-Identifier: GPL-3.0-only
// Ports (slice 1 spec Appendix B). Blurbs are original placeholder text.
import type { NationId } from './nations';

export interface PortDef {
  /** kebab-case and stable: used in saves. */
  readonly id: string;
  readonly name: string;
  readonly nation: NationId;
  readonly lon: number;
  readonly lat: number;
  /** One original sentence, shown in port. */
  readonly blurb: string;
}

export const PORTS: readonly PortDef[] = [
  {
    id: 'havana',
    name: 'Havana',
    nation: 'es',
    lon: -82.36,
    lat: 23.14,
    blurb: 'The treasure fleets gather under its guns before the long run home to Seville.',
  },
  {
    id: 'santiago',
    name: 'Santiago',
    nation: 'es',
    lon: -75.83,
    lat: 19.99,
    blurb: 'A steep harbour mouth and a nervous garrison watching the Windward Passage.',
  },
  {
    id: 'santo-domingo',
    name: 'Santo Domingo',
    nation: 'es',
    lon: -69.9,
    lat: 18.47,
    blurb: 'The oldest Spanish city in the Indies, proud and a little faded.',
  },
  {
    id: 'san-juan',
    name: 'San Juan',
    nation: 'es',
    lon: -66.1,
    lat: 18.47,
    blurb: 'Stone walls on a narrow island guard the gateway to the Spanish Main.',
  },
  {
    id: 'st-augustine',
    name: 'St. Augustine',
    nation: 'es',
    lon: -81.31,
    lat: 29.5, // real 29.9; moved away from the map's north edge, see ADR 005
    blurb: 'A lonely outpost holding the Florida coast against all comers.',
  },
  {
    id: 'veracruz',
    name: 'Veracruz',
    nation: 'es',
    lon: -96.13,
    lat: 19.2,
    blurb: 'Silver from the mines of New Spain comes down the mountain road to this quay.',
  },
  {
    id: 'campeche',
    name: 'Campeche',
    nation: 'es',
    lon: -90.53,
    lat: 19.85,
    blurb: 'Logwood, salt and a town that has learned to fear sails on the horizon.',
  },
  {
    id: 'porto-bello',
    name: 'Porto Bello',
    nation: 'es',
    lon: -79.65,
    lat: 9.55,
    blurb: 'When the fair is on, Peruvian silver is stacked in the streets.',
  },
  {
    id: 'cartagena',
    name: 'Cartagena',
    nation: 'es',
    lon: -75.53,
    lat: 10.42,
    blurb: 'The strongest fortress on the Main, and it knows it.',
  },
  {
    id: 'maracaibo',
    name: 'Maracaibo',
    nation: 'es',
    lon: -71.6,
    lat: 10.7,
    blurb: 'Cacao and hides behind a shallow bar that keeps big ships out.',
  },
  {
    id: 'caracas',
    name: 'Caracas',
    nation: 'es',
    lon: -66.93,
    lat: 10.6,
    blurb: 'The port below the mountain road, busy with cacao for Spain.',
  },
  {
    id: 'trinidad',
    name: 'Trinidad',
    nation: 'es',
    lon: -61.45,
    lat: 10.65,
    blurb: "A thinly held Spanish island at the edge of the Orinoco's reach.",
  },
  {
    id: 'port-royal',
    name: 'Port Royal',
    nation: 'en',
    lon: -76.84,
    lat: 17.94,
    blurb: 'The busiest harbour in English Jamaica, and the least respectable.',
  },
  {
    id: 'bridgetown',
    name: 'Bridgetown',
    nation: 'en',
    lon: -59.62,
    lat: 13.1,
    blurb: "Sugar money, planters' mansions and a harbour full of merchantmen.",
  },
  {
    id: 'st-johns',
    name: "St. John's",
    nation: 'en',
    lon: -61.85,
    lat: 17.12,
    blurb: 'A small English settlement with a large and excellent anchorage.',
  },
  {
    id: 'nassau',
    name: 'Nassau',
    nation: 'en',
    lon: -77.35,
    lat: 25.06,
    blurb: "A scatter of huts and a good harbour, far from any governor's eye.",
  },
  {
    id: 'tortuga',
    name: 'Tortuga',
    nation: 'fr',
    lon: -72.8,
    lat: 20.06,
    blurb: 'A rock off Hispaniola where no questions are asked and every rumour is told.',
  },
  {
    id: 'st-pierre',
    name: 'St. Pierre',
    nation: 'fr',
    lon: -61.17,
    lat: 14.74,
    blurb: 'The jewel of French Martinique, under a smoking mountain.',
  },
  {
    id: 'basse-terre',
    name: 'Basse-Terre',
    nation: 'fr',
    lon: -61.73,
    lat: 16.0,
    blurb: "The French governor's seat on green, mountainous Guadeloupe.",
  },
  {
    id: 'willemstad',
    name: 'Willemstad',
    nation: 'nl',
    lon: -68.93,
    lat: 12.11,
    blurb: 'Dutch warehouses where anything can be bought and everything is for sale.',
  },
  {
    id: 'st-eustatius',
    name: 'St. Eustatius',
    nation: 'nl',
    lon: -62.98,
    lat: 17.48,
    blurb: 'A tiny island whose trade makes it worth more than its size.',
  },
];

export const START_PORT_ID = 'bridgetown';
