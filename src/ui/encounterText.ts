// SPDX-License-Identifier: GPL-3.0-only
// Period phrasing for encounters (slice 2 spec §5.3–5.4), built from strings.ts.
import { NATIONS } from '../data/nations';
import { atWar, PLAYER_NATION } from '../data/relations';
import { SHIP_CLASSES } from '../data/ships';
import { STRINGS } from '../data/strings';
import type { NpcShip } from '../sim/npc/npc';

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Spanish" for a nation, "pirate" for pirates. */
function adjective(npc: NpcShip): string {
  return npc.nation === 'pirate' ? STRINGS.encounter.pirate : NATIONS[npc.nation].adjective;
}

function className(npc: NpcShip): string {
  return SHIP_CLASSES[npc.classId].name.toLowerCase();
}

/** "the Spanish fluyt", "the pirate brigantine". */
export function theShip(npc: NpcShip): string {
  return `the ${adjective(npc)} ${className(npc)}`;
}

/** "A Spanish frigate", "An English sloop". */
export function aShip(npc: NpcShip): string {
  const adj = adjective(npc);
  return `${/^[aeiou]/i.test(adj) ? 'An' : 'A'} ${adj} ${className(npc)}`;
}

/**
 * "The Spanish merchantman *San Telmo*, fluyt, 10 guns": the text before the italic name, the
 * name, and the text after it.
 */
export function describeShip(npc: NpcShip): { before: string; name: string; after: string } {
  const noun = STRINGS.encounter.roleNoun[npc.role];
  const before = npc.nation === 'pirate' ? `The ${noun} ` : `The ${adjective(npc)} ${noun} `;
  const guns = STRINGS.encounter.guns(npc.condition.gunsIntact);
  return { before, name: npc.name, after: `, ${className(npc)}, ${guns}.` };
}

/** A rough strength hint from the crews (slice 2 spec §5.4), or null when evenly matched. */
export function strengthHint(npcCrew: number, playerCrew: number): string | null {
  if (npcCrew > 1.5 * playerCrew) return STRINGS.encounter.heavilyCrewed;
  if (npcCrew < 0.6 * playerCrew) return STRINGS.encounter.undermanned;
  return null;
}

/** "Spain is at war with England.", "The Dutch Republic is at peace with England." */
export function relationLine(npc: NpcShip): string {
  if (npc.nation === 'pirate') return STRINGS.encounter.piratesAtWar;
  const theirs = capitalise(NATIONS[npc.nation].sentenceName);
  const ours = NATIONS[PLAYER_NATION].sentenceName;
  return atWar(npc.nation, PLAYER_NATION)
    ? STRINGS.encounter.atWar(theirs, ours)
    : STRINGS.encounter.atPeace(theirs, ours);
}
