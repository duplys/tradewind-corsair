// SPDX-License-Identifier: GPL-3.0-only
import { UPWIND_COMPARE_REL_DEG } from '../data/combat';
import { SHIP_CLASSES, type ShipClassId } from '../data/ships';
import { STRINGS } from '../data/strings';
import { polarFactor } from '../sim/sailing/polar';

/**
 * The one-line comparison shown before taking a prize as your ship (spec §8.1):
 * "Frigate: 28 guns, 8 kn. Slower upwind than your sloop."
 */
export function compareShips(current: ShipClassId, prize: ShipClassId): string {
  const now = SHIP_CLASSES[current];
  const next = SHIP_CLASSES[prize];
  const a = polarFactor(now.polar, UPWIND_COMPARE_REL_DEG);
  const b = polarFactor(next.polar, UPWIND_COMPARE_REL_DEG);
  const name = now.name.toLowerCase();
  const upwind =
    b < a - 1e-9
      ? STRINGS.combat.upwindWorse(name)
      : b > a + 1e-9
        ? STRINGS.combat.upwindBetter(name)
        : STRINGS.combat.upwindSame(name);
  return STRINGS.combat.compare(next.name, next.guns, next.maxSpeedKn, upwind);
}
