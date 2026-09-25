// SPDX-License-Identifier: GPL-3.0-only
import { PLACEHOLDER_FIGHT_IGNORE_HOURS } from '../../data/encounter';
import { STRINGS } from '../../data/strings';
import type { Action } from '../../input/actions';
import { DEEP_SEA } from '../../render/palette';
import { breakContact, updateNpc } from '../../sim/npc/encounter';
import type { CombatPlaceholder } from '../../ui/combatPlaceholder';
import type { Session } from '../session';
import type { Mode, SwitchMode } from './mode';

export interface CombatDeps {
  readonly session: Session;
  readonly placeholder: CombatPlaceholder;
  readonly switchMode: SwitchMode;
}

/**
 * Placeholder for ship combat until slice 2 M4 (ADR 011): it announces the fight and lets the
 * ships part company. The enemy then leaves the player alone for a day.
 */
export class CombatMode implements Mode {
  readonly id = 'combat';

  constructor(private readonly deps: CombatDeps) {}

  enter(): void {
    const heading = this.deps.session.encounter?.escapeFailed
      ? STRINGS.encounter.caught
      : STRINGS.combat.placeholderHeading;
    this.deps.placeholder.show(heading, () => this.breakOff());
  }

  exit(): void {
    this.deps.placeholder.hide();
  }

  handleAction(action: Action): void {
    if (action === 'close') this.breakOff();
  }

  update(): void {}

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = DEEP_SEA;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  private breakOff(): void {
    const { session } = this.deps;
    const encounter = session.encounter;
    if (encounter) {
      const hours = session.voyage.elapsedHours;
      session.voyage = updateNpc(session.voyage, encounter.npcId, (npc) =>
        breakContact(npc, hours + PLACEHOLDER_FIGHT_IGNORE_HOURS, hours),
      );
    }
    session.encounter = null;
    this.deps.switchMode('sailing');
  }
}
