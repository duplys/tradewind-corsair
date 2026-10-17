// SPDX-License-Identifier: GPL-3.0-only
import { GOODS } from '../data/goods';
import { NATIONS } from '../data/nations';
import { PORTS } from '../data/ports';
import { STRINGS } from '../data/strings';
import type { Rumour } from '../sim/tavern/rumours';

function portName(id: string): string {
  return PORTS.find((p) => p.id === id)?.name ?? id;
}

/** A rumour as a sentence of tavern talk. */
export function rumourText(rumour: Rumour): string {
  const r = STRINGS.rumour;
  switch (rumour.kind) {
    case 'prices':
      return r.prices(
        GOODS[rumour.good].name,
        portName(rumour.dearPort),
        portName(rumour.cheapPort),
      );
    case 'war': {
      const a = NATIONS[rumour.a].sentenceName;
      const b = NATIONS[rumour.b].sentenceName;
      const sentence = rumour.atWar ? r.war(a, b) : r.peace(a, b);
      // "the Dutch Republic and Spain" starts a sentence: capitalise the first letter.
      return sentence.replace(/^"the /, '"The ');
    }
    case 'pirates':
      return r.pirates(portName(rumour.nearPort));
    case 'place': {
      const port = PORTS.find((p) => p.id === rumour.portId);
      return r.place(portName(rumour.portId), port?.blurb ?? '');
    }
  }
}
