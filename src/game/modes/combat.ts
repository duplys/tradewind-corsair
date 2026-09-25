// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS } from '../../data/nations';
import { SHIP_CLASSES } from '../../data/ships';
import { STRINGS } from '../../data/strings';
import type { Action, HeldActions } from '../../input/actions';
import type { TouchControls } from '../../input/touch';
import { drawCombatScene, SplashRing } from '../../render/combatScene';
import type { SeaScene } from '../../render/scene';
import { applyCombatResult } from '../../sim/combat/result';
import { createCombat, type CombatState } from '../../sim/combat/state';
import { HOLD, stepCombat, type CombatEvent, type CombatInput } from '../../sim/combat/step';
import type { NpcShip } from '../../sim/npc/npc';
import { restoreRng } from '../../sim/rng';
import { windAt } from '../../sim/sailing/wind';
import type { CombatResultCard } from '../../ui/combatResult';
import type { CombatStatus } from '../../ui/combatStatus';
import type { MessageLine } from '../../ui/messageLine';
import type { Session } from '../session';
import type { Mode, SwitchMode } from './mode';

/** "San Telmo (Spanish fluyt)". */
function describeEnemy(npc: NpcShip): string {
  const cls = SHIP_CLASSES[npc.classId].name.toLowerCase();
  const who = npc.nation === 'pirate' ? STRINGS.npc.pirate : NATIONS[npc.nation].adjective;
  return `${npc.name} (${STRINGS.npc.label(who, cls)})`;
}

/** Player hull below this brings the "taking water" warning (spec §10.3). */
const TAKING_WATER_PCT = 30;
/** Within this range of a struck enemy the crew readies grapples (spec §10.3). */
const GRAPPLE_RANGE_PX = 60;

export interface CombatDeps {
  readonly scene: SeaScene;
  readonly session: Session;
  readonly held: Readonly<HeldActions>;
  readonly status: CombatStatus;
  readonly result: CombatResultCard;
  readonly messages: MessageLine;
  readonly touch: TouchControls | null;
  readonly switchMode: SwitchMode;
  /** Write the current voyage to the save slot. */
  readonly save: () => void;
}

/**
 * Ship combat (slice 2 spec §6). In M4 the enemy lies still with furled sails (the combat AI
 * arrives in M5), and a result card stands in for the outcome screens of M7.
 */
export class CombatMode implements Mode {
  readonly id = 'combat';
  private combat: CombatState | null = null;
  private npc: NpcShip | null = null;
  private enemyName = '';
  private timeSec = 0;
  private sail: -1 | 0 | 1 = 0;
  private fire: CombatInput['fire'] = null;
  private warnedWater = false;
  private warnedGrapples = false;
  private readonly splashes = new SplashRing();

  constructor(private readonly deps: CombatDeps) {}

  enter(): void {
    const { session } = this.deps;
    const encounter = session.encounter;
    const npc = encounter && session.voyage.npcs.find((n) => n.id === encounter.npcId);
    if (!encounter || !npc) {
      session.encounter = null;
      this.deps.switchMode('sailing');
      return;
    }
    const voyage = session.voyage;
    // A child stream for this fight; the world stream moves on (spec §6.1).
    const worldRng = restoreRng(voyage.rngState);
    const rng = worldRng.fork('combat');
    session.voyage = { ...voyage, rngState: worldRng.state() };
    const { ship } = voyage;
    this.npc = npc;
    this.enemyName = describeEnemy(npc);
    this.combat = createCombat({
      player: {
        classId: ship.classId,
        role: 'player',
        condition: voyage.condition,
        headingRad: ship.headingRad,
        speedKn: ship.speedKn,
        sail: ship.sail,
      },
      // M4: a stationary target, sails furled (the combat AI arrives in M5).
      enemy: {
        classId: npc.classId,
        role: npc.role,
        condition: npc.condition,
        headingRad: npc.ship.headingRad,
        speedKn: npc.ship.speedKn,
        sail: 'furled',
      },
      wind: windAt(ship.x, ship.y, voyage.elapsedHours),
      rng,
      bearingToEnemyRad: Math.atan2(npc.ship.y - ship.y, npc.ship.x - ship.x),
      escapeFailed: encounter.escapeFailed,
    });
    this.sail = 0;
    this.fire = null;
    this.warnedWater = false;
    this.warnedGrapples = false;
    this.splashes.clear();
    this.deps.status.show();
    this.deps.touch?.show();
  }

  exit(): void {
    this.deps.status.hide();
    this.deps.result.hide();
    this.deps.touch?.hide();
    this.deps.messages.hide();
    this.combat = null;
    this.npc = null;
  }

  handleAction(action: Action): void {
    if (this.deps.result.isOpen) {
      if (action === 'close') this.finish();
      return;
    }
    if (action === 'hoist') this.sail = 1;
    else if (action === 'reef') this.sail = -1;
    else if (action === 'firePort') this.fire = 'port';
    else if (action === 'fireStarboard') this.fire = 'starboard';
    else if (action === 'confirm') this.fire = 'bearing';
  }

  update(dtSec: number): void {
    const combat = this.combat;
    if (!combat || combat.outcome) return;
    this.timeSec += dtSec;
    const { held } = this.deps;
    const input: CombatInput = {
      turnLeft: held.turnLeft,
      turnRight: held.turnRight,
      sail: this.sail,
      fire: this.fire,
    };
    this.sail = 0;
    this.fire = null;
    const events = stepCombat(combat, input, HOLD, dtSec);
    for (const event of events) this.react(event);
    this.warnings(combat);
    if (combat.outcome) this.showResult(combat);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const combat = this.combat;
    if (!combat || !this.npc) return;
    drawCombatScene(ctx, combat, this.deps.scene.sprites, this.splashes, this.timeSec);
    this.deps.status.update(
      combat,
      this.deps.session.voyage.shipName,
      this.enemyName,
      this.timeSec,
    );
    this.deps.messages.update(this.timeSec);
  }

  private react(event: CombatEvent): void {
    const { messages } = this.deps;
    if (event.type === 'splash') this.splashes.add(event.x, event.y, this.timeSec);
    else if (event.type === 'hit' && event.ship === 1 && event.location === 'rigging') {
      messages.show(STRINGS.combat.mastDamaged, this.timeSec);
    } else if (event.type === 'struck' && event.ship === 1) {
      messages.show(STRINGS.combat.striking, this.timeSec);
    }
  }

  private warnings(combat: CombatState): void {
    const [player, enemy] = combat.ships;
    const { messages } = this.deps;
    if (!this.warnedWater && player.condition.hullPct < TAKING_WATER_PCT) {
      this.warnedWater = true;
      messages.show(STRINGS.combat.takingWater, this.timeSec);
    }
    const range = Math.hypot(enemy.ship.x - player.ship.x, enemy.ship.y - player.ship.y);
    if (!this.warnedGrapples && enemy.struck && range <= GRAPPLE_RANGE_PX) {
      this.warnedGrapples = true;
      messages.show(STRINGS.combat.grapples, this.timeSec);
    }
  }

  private showResult(combat: CombatState): void {
    const c = STRINGS.combat;
    const outcome = combat.outcome!;
    let heading: string;
    let note = '';
    switch (outcome.type) {
      case 'sunk':
        [heading, note] =
          outcome.shipIndex === 1
            ? [c.enemySunk, c.enemySunkNote]
            : [c.playerSunk, c.playerSunkNote];
        break;
      case 'captured':
        [heading, note] = [c.captured, c.capturedNote];
        break;
      case 'boarding':
        [heading, note] = [c.boarding, c.boardingNote];
        break;
      case 'escaped':
        heading = outcome.shipIndex === 1 ? c.enemyEscaped : c.playerEscaped;
        break;
      case 'surrendered':
        [heading, note] = [c.playerSunk, c.playerSunkNote];
        break;
    }
    this.deps.result.show(heading, note, () => this.finish());
  }

  private finish(): void {
    const { session } = this.deps;
    const combat = this.combat;
    const encounter = session.encounter;
    if (combat && encounter) {
      session.voyage = applyCombatResult(
        session.voyage,
        this.deps.scene.world,
        encounter.npcId,
        combat,
      );
    }
    session.encounter = null;
    this.deps.save();
    this.deps.switchMode('sailing');
  }
}
