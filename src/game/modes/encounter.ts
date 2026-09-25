// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS, PIRATE_FLAG } from '../../data/nations';
import { hostileToPlayer, PLAYER_NATION } from '../../data/relations';
import { SHIP_CLASSES } from '../../data/ships';
import { STRINGS } from '../../data/strings';
import type { Action } from '../../input/actions';
import { drawSeaScene, type SeaScene } from '../../render/scene';
import { escaped, leaveHerBe } from '../../sim/npc/encounter';
import { escapeChance } from '../../sim/npc/escape';
import type { NpcShip } from '../../sim/npc/npc';
import { restoreRng } from '../../sim/rng';
import { windAt } from '../../sim/sailing/wind';
import { adjustReputation } from '../../sim/voyage';
import type { EncounterChoice, EncounterDialog, EncounterView } from '../../ui/encounterDialog';
import { aShip, describeShip, relationLine, strengthHint, theShip } from '../../ui/encounterText';
import type { Session } from '../session';
import type { Mode, SwitchMode } from './mode';

export interface EncounterDeps {
  readonly scene: SeaScene;
  readonly session: Session;
  readonly dialog: EncounterDialog;
  readonly switchMode: SwitchMode;
  /** Write the current voyage to the save slot. */
  readonly save: () => void;
}

/**
 * The encounter dialog (slice 2 spec §5.3–5.4). The game clock is paused. The player attacks
 * or leaves a ship they closed with, or stands and fights or tries to run from a chaser.
 */
export class EncounterMode implements Mode {
  readonly id = 'encounter';
  private npc: NpcShip | null = null;
  private timeSec = 0;

  constructor(private readonly deps: EncounterDeps) {}

  enter(): void {
    const { session } = this.deps;
    const encounter = session.encounter;
    const npc = encounter && session.voyage.npcs.find((n) => n.id === encounter.npcId);
    if (!encounter || !npc) {
      session.encounter = null;
      this.deps.switchMode('sailing');
      return;
    }
    this.npc = npc;
    this.showDialog(false);
  }

  exit(): void {
    this.deps.dialog.hide();
    this.npc = null;
  }

  handleAction(action: Action): void {
    // Esc means "Leave her be" only when leaving is on offer.
    if (action === 'close' && this.deps.session.encounter?.initiator === 'player') {
      this.choose('leave');
    }
  }

  update(dtSec: number): void {
    this.timeSec += dtSec;
  }

  render(): void {
    const { ship, elapsedHours, npcs } = this.deps.session.voyage;
    drawSeaScene(
      this.deps.scene,
      ship,
      this.timeSec,
      windAt(ship.x, ship.y, elapsedHours).towardRad,
      null,
      { npcs, fade: null },
    );
  }

  private showDialog(warn: boolean): void {
    const npc = this.npc!;
    const { voyage, encounter } = this.deps.session;
    const byPlayer = encounter?.initiator === 'player';
    const view: EncounterView = {
      heading: byPlayer
        ? STRINGS.encounter.closeWith(theShip(npc))
        : STRINGS.encounter.bearsDown(aShip(npc)),
      flag: npc.nation === 'pirate' ? PIRATE_FLAG : NATIONS[npc.nation].flag,
      flagLabel:
        npc.nation === 'pirate'
          ? STRINGS.port.pirateFlag
          : STRINGS.port.flagOf(NATIONS[npc.nation].sentenceName),
      description: describeShip(npc),
      strength: strengthHint(npc.condition.crew, voyage.condition.crew),
      relation: relationLine(npc),
      warning: warn ? STRINGS.encounter.friendlyWarning : null,
      choices: warn ? ['attackAnyway', 'leave'] : byPlayer ? ['attack', 'leave'] : ['fight', 'run'],
    };
    this.deps.dialog.show(view, (choice) => this.choose(choice));
  }

  private choose(choice: EncounterChoice): void {
    const npc = this.npc;
    const { session } = this.deps;
    if (!npc || !session.encounter) return;
    switch (choice) {
      case 'attack':
        // A friendly flag: warn first (slice 2 spec §5.1).
        if (!hostileToPlayer(npc.nation)) {
          this.showDialog(true);
          return;
        }
        this.startCombat(false);
        return;
      case 'attackAnyway':
        if (npc.nation !== 'pirate' && npc.nation !== PLAYER_NATION) {
          session.voyage = adjustReputation(session.voyage, npc.nation, -1);
        }
        this.startCombat(false);
        return;
      case 'leave':
        session.voyage = leaveHerBe(session.voyage, npc.id);
        this.finish();
        return;
      case 'fight':
        this.startCombat(false);
        return;
      case 'run':
        this.tryToRun(npc);
        return;
    }
  }

  private tryToRun(npc: NpcShip): void {
    const { session, scene } = this.deps;
    const voyage = session.voyage;
    const wind = windAt(voyage.ship.x, voyage.ship.y, voyage.elapsedHours);
    const chance = escapeChance(
      { at: voyage.ship, cls: SHIP_CLASSES[voyage.ship.classId], condition: voyage.condition },
      { at: npc.ship, cls: SHIP_CLASSES[npc.classId], condition: npc.condition },
      wind,
    );
    const rng = restoreRng(voyage.rngState);
    const success = rng() < chance;
    session.voyage = { ...voyage, rngState: rng.state() };
    if (success) {
      session.voyage = escaped(session.voyage, scene.world, npc.id);
      session.notice = STRINGS.encounter.escaped;
      this.finish();
    } else {
      this.startCombat(true);
    }
  }

  private startCombat(escapeFailed: boolean): void {
    const { session } = this.deps;
    session.encounter = { ...session.encounter!, escapeFailed };
    // Save just before combat, so closing the page mid-fight restores this moment (spec §11).
    this.deps.save();
    this.deps.switchMode('combat');
  }

  private finish(): void {
    this.deps.session.encounter = null;
    this.deps.save();
    this.deps.switchMode('sailing');
  }
}
