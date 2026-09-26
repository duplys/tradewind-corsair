// SPDX-License-Identifier: GPL-3.0-only
import { DEFEAT_CREW, DEFEAT_DAYS, DEFEAT_GOLD_KEPT_SHARE } from '../../data/combat';
import { SHIP_CLASSES } from '../../data/ships';
import { STRINGS } from '../../data/strings';
import type { Action, HeldActions } from '../../input/actions';
import type { TouchControls } from '../../input/touch';
import { CombatScene } from '../../render/combatScene';
import type { NpcLabel } from '../../render/labels';
import type { SeaScene } from '../../render/scene';
import { decide } from '../../sim/combat/ai';
import {
  applyDefeat,
  applyEnemyEscaped,
  applyEnemySunk,
  applyPlayerEscaped,
  applyPrize,
  concludeFight,
  nearestFriendlyPort,
  rollPrize,
  survivingEnemyCrew,
  survivingPlayerCrew,
  type Conclusion,
  type PrizeChoice,
} from '../../sim/combat/outcome';
import { createCombat, type CombatState } from '../../sim/combat/state';
import { stepCombat, surrender, type CombatEvent, type CombatInput } from '../../sim/combat/step';
import type { NpcShip } from '../../sim/npc/npc';
import { restoreRng } from '../../sim/rng';
import { windAt } from '../../sim/sailing/wind';
import type { CombatHud } from '../../ui/combatHud';
import type { BoardingOverlay } from '../../ui/boardingOverlay';
import type { CombatResultCard } from '../../ui/combatResult';
import { yards } from '../../ui/combatText';
import type { MessageLine } from '../../ui/messageLine';
import { formatGold } from '../../ui/format';
import { compareShips } from '../../ui/outcomeText';
import type { PauseOverlay } from '../../ui/pauseOverlay';
import type { PrizeScreen } from '../../ui/prizeScreen';
import type { Session } from '../session';
import type { Mode, SwitchMode } from './mode';

/** Player hull below this brings the "taking water" warning (spec §10.3). */
const TAKING_WATER_PCT = 30;
/** Within this range of a struck enemy the crew readies grapples (spec §10.3). */
const GRAPPLE_RANGE_PX = 60;

export interface CombatDeps {
  readonly scene: SeaScene;
  readonly session: Session;
  readonly held: Readonly<HeldActions>;
  readonly hud: CombatHud;
  readonly pause: PauseOverlay;
  readonly result: CombatResultCard;
  readonly boarding: BoardingOverlay;
  readonly prize: PrizeScreen;
  readonly messages: MessageLine;
  readonly touch: TouchControls | null;
  readonly switchMode: SwitchMode;
  /** Write the current voyage to the save slot. */
  readonly save: () => void;
}

/**
 * Ship combat (slice 2 spec §6–§10): the player against an enemy sailed by the combat AI, with
 * the combat HUD, effects and a pause overlay, then the boarding melee and the outcome screens.
 */
export class CombatMode implements Mode {
  readonly id = 'combat';
  private combat: CombatState | null = null;
  private npc: NpcShip | null = null;
  /** When the boarding melee began to play, in combat time. */
  private meleeStartSec = 0;
  private timeSec = 0;
  private sail: -1 | 0 | 1 = 0;
  private fire: CombatInput['fire'] = null;
  private paused = false;
  private warnedWater = false;
  private warnedGrapples = false;
  private readonly view: CombatScene;
  /** Reused every frame for the pointer's range label. */
  private readonly pointerLabels: NpcLabel[] = [];

  constructor(private readonly deps: CombatDeps) {
    this.view = new CombatScene(deps.scene.sprites);
  }

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
    this.combat = createCombat({
      player: {
        classId: ship.classId,
        role: 'player',
        condition: voyage.condition,
        headingRad: ship.headingRad,
        speedKn: ship.speedKn,
        sail: ship.sail,
      },
      enemy: {
        classId: npc.classId,
        role: npc.role,
        condition: npc.condition,
        headingRad: npc.ship.headingRad,
        speedKn: npc.ship.speedKn,
        sail: npc.ship.sail,
      },
      wind: windAt(ship.x, ship.y, voyage.elapsedHours),
      rng,
      bearingToEnemyRad: Math.atan2(npc.ship.y - ship.y, npc.ship.x - ship.x),
      escapeFailed: encounter.escapeFailed,
    });
    this.timeSec = 0;
    this.sail = 0;
    this.fire = null;
    this.paused = false;
    this.warnedWater = false;
    this.warnedGrapples = false;
    this.view.reset(this.combat, npc.nation, npc.id * 7919 + 17);
    this.deps.scene.labels.clear();
    this.deps.hud.show(voyage.shipName, SHIP_CLASSES[ship.classId].name, npc);
    this.deps.touch?.setCombat(true);
    this.deps.touch?.show();
  }

  exit(): void {
    this.deps.hud.hide();
    this.deps.pause.hide();
    this.deps.result.hide();
    this.deps.boarding.hide();
    this.deps.prize.hide();
    this.deps.touch?.hide();
    this.deps.touch?.setCombat(false);
    this.deps.messages.hide();
    this.deps.scene.labels.clear();
    this.combat = null;
    this.npc = null;
  }

  /** The tab was hidden: pause the fight, so the player comes back to the pause overlay. */
  onHidden(): void {
    if (this.combat && !this.combat.outcome) this.setPaused(true);
  }

  handleAction(action: Action): void {
    // Any key skips the boarding melee; the result screens are answered with their buttons.
    if (this.deps.boarding.isAnimating) {
      this.deps.boarding.skip();
      return;
    }
    if (this.deps.result.isOpen || this.deps.boarding.isOpen || this.deps.prize.isOpen) return;
    if (action === 'pause' || action === 'close') {
      this.setPaused(!this.paused);
      return;
    }
    if (this.paused) return;
    if (action === 'hoist') this.sail = 1;
    else if (action === 'reef') this.sail = -1;
    else if (action === 'firePort') this.fire = 'port';
    else if (action === 'fireStarboard') this.fire = 'starboard';
    else if (action === 'confirm') this.fire = 'bearing';
  }

  update(dtSec: number): void {
    const combat = this.combat;
    if (this.deps.boarding.isAnimating) {
      this.timeSec += dtSec;
      this.deps.boarding.update(this.timeSec - this.meleeStartSec);
      return;
    }
    if (!combat || combat.outcome || this.paused) return;
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
    const enemy = combat.ships[1];
    const events = stepCombat(
      combat,
      input,
      decide(combat, 1, enemy.role === 'player' ? 'warship' : enemy.role),
      dtSec,
    );
    for (const event of events) this.react(event, combat);
    this.view.update(combat, dtSec, this.timeSec);
    this.warnings(combat);
    if (combat.outcome) this.conclude(combat);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const combat = this.combat;
    if (!combat) return;
    const { scene } = this.deps;
    const drawn = this.view.draw(ctx, combat, this.timeSec, scene.reducedMotion());
    this.pointerLabels.length = 0;
    if (drawn.pointer) {
      this.pointerLabels.push({
        x: drawn.pointer.x,
        y: drawn.pointer.y,
        text: STRINGS.combat.yards(yards(drawn.pointer.rangePx)),
        hostile: false,
        alpha: 1,
      });
    }
    scene.labels.draw(drawn.cam, scene.view.scale, [], this.pointerLabels);
    this.deps.hud.update(combat, this.timeSec);
    this.deps.messages.update(this.timeSec);
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) {
      this.deps.pause.hide();
      return;
    }
    const enemy = this.combat?.ships[1];
    this.deps.pause.show(enemy?.role !== 'trader', {
      onResume: () => this.setPaused(false),
      onSurrender: () => {
        if (this.combat) surrender(this.combat);
        this.deps.pause.hide();
        this.paused = false;
        if (this.combat) this.conclude(this.combat);
      },
    });
  }

  private react(event: CombatEvent, combat: CombatState): void {
    const { messages } = this.deps;
    this.view.react(event, combat, this.timeSec);
    if (event.type === 'hit' && event.ship === 1 && event.location === 'rigging') {
      messages.show(STRINGS.combat.mastDamaged, this.timeSec);
    } else if (event.type === 'struck' && event.ship === 1) {
      messages.show(STRINGS.combat.striking, this.timeSec);
    } else if (event.type === 'notReady' && event.ship === 0) {
      this.deps.hud.flash(event.side, this.timeSec);
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

  /** The fight is over: fight out any boarding, then show the outcome (spec §8, §9). */
  private conclude(combat: CombatState): void {
    const conclusion = concludeFight(combat);
    const boarding = 'boarding' in conclusion ? conclusion.boarding : null;
    if (!boarding) {
      this.showOutcome(combat, conclusion);
      return;
    }
    const outcome = combat.outcome;
    const playerAttacks = outcome?.type === 'boarding' && outcome.attacker === 0;
    const [player, enemy] = combat.ships;
    this.meleeStartSec = this.timeSec;
    this.deps.boarding.show(
      boarding,
      playerAttacks,
      { ours: player.condition.crew, theirs: enemy.condition.crew },
      conclusion.kind === 'prize',
      () => {
        this.deps.boarding.hide();
        this.showOutcome(combat, conclusion);
      },
    );
  }

  private showOutcome(combat: CombatState, conclusion: Conclusion): void {
    const c = STRINGS.combat;
    const { session, scene } = this.deps;
    const npc = this.npc!;
    const world = scene.world;
    switch (conclusion.kind) {
      case 'prize': {
        const playerCrew = survivingPlayerCrew(combat, conclusion.boarding);
        const enemyCrew = survivingEnemyCrew(combat, conclusion.boarding);
        const classId = session.voyage.ship.classId;
        const prize = rollPrize(npc, enemyCrew, classId, playerCrew, combat.rng);
        const enemyCondition = { ...combat.ships[1].condition, crew: enemyCrew };
        this.deps.prize.show(
          {
            shipName: npc.name,
            plunderLine: c.plunder(formatGold(prize.plunder)),
            recruitsLine: c.recruits(prize.recruits),
            comparison: compareShips(classId, npc.classId),
          },
          (choice: PrizeChoice) =>
            this.finish((v) =>
              applyPrize(v, combat, npc, prize, playerCrew, enemyCondition, choice),
            ),
        );
        return;
      }
      case 'enemySunk':
        this.deps.result.show(c.enemySunk, [c.noPlunder], () =>
          this.finish((v) => applyEnemySunk(v, combat, npc)),
        );
        return;
      case 'enemyEscaped':
        this.deps.result.show(c.enemyEscaped, [], () =>
          this.finish((v) => applyEnemyEscaped(v, combat, npc.id)),
        );
        return;
      case 'playerEscaped':
        this.deps.result.show(c.playerEscaped, [], () =>
          this.finish((v) => applyPlayerEscaped(v, world, combat, npc.id)),
        );
        return;
      case 'defeat': {
        const v = session.voyage;
        const port = nearestFriendlyPort(scene.ports, v.ship.x, v.ship.y);
        const lost = v.gold - Math.floor(v.gold * DEFEAT_GOLD_KEPT_SHARE);
        this.deps.result.show(
          c.playerSunk,
          [
            c.goldLost(formatGold(lost)),
            c.putAshore(port.def.name, DEFEAT_CREW),
            c.daysPass(DEFEAT_DAYS),
          ],
          () => this.finish((next) => applyDefeat(next, world, scene.ports, npc.id)),
        );
        return;
      }
    }
  }

  /** Apply the outcome to the voyage, save, and return to sea (spec §8: after every outcome). */
  private finish(apply: (voyage: Session['voyage']) => Session['voyage']): void {
    const { session } = this.deps;
    session.voyage = apply(session.voyage);
    session.encounter = null;
    this.deps.save();
    this.deps.switchMode('sailing');
  }
}
