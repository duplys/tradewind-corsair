// SPDX-License-Identifier: GPL-3.0-only
import { hostileToPlayer } from '../../data/relations';
import { SHIP_CLASSES } from '../../data/ships';
import { STRINGS } from '../../data/strings';
import type { Action } from '../../input/actions';
import { drawSeaScene, type SeaScene } from '../../render/scene';
import { windAt } from '../../sim/sailing/wind';
import {
  affordableRepair,
  fullRepair,
  gunReplacement,
  isEmptyRepair,
  type RepairPlan,
} from '../../sim/ships/repair';
import { formatDate } from '../../sim/time';
import { repairShip, setSailFrom } from '../../sim/voyage';
import { findPort, type Port } from '../../sim/world/ports';
import type { PortScreen } from '../../ui/portScreen';
import type { ShipwrightPanel, ShipwrightView } from '../../ui/shipwrightPanel';
import type { Session } from '../session';
import type { Mode, SwitchMode } from './mode';

export interface PortDeps {
  readonly scene: SeaScene;
  readonly session: Session;
  readonly portScreen: PortScreen;
  readonly shipwright: ShipwrightPanel;
  readonly switchMode: SwitchMode;
  /** Write the current voyage to the save slot. */
  readonly save: () => void;
}

type RepairKind = 'all' | 'affordable' | 'guns';

/**
 * At anchor (slice 1 spec §4.2). Game time is paused, except for the days a repair takes; the
 * port screen covers the map. Friendly ports offer the Shipwright (slice 2 spec §3.4).
 */
export class PortMode implements Mode {
  readonly id = 'port';
  private port: Port | null = null;
  /** Decorative time only (waving flags); the game clock does not advance in port. */
  private timeSec = 0;

  constructor(private readonly deps: PortDeps) {}

  enter(): void {
    const { session, scene, portScreen } = this.deps;
    const id = session.voyage.dockedPortId;
    if (id === null) throw new Error('Entered port mode without a docked port');
    const port = findPort(scene.ports, id);
    this.port = port;
    const shipwrightOpen = !hostileToPlayer(port.def.nation);
    portScreen.show(port, this.dateText(), shipwrightOpen ? () => this.openShipwright() : null);
  }

  exit(): void {
    this.deps.shipwright.hide();
    this.deps.portScreen.hide();
    this.port = null;
  }

  handleAction(action: Action): void {
    if (this.deps.shipwright.isOpen) {
      if (action === 'close') this.closeShipwright();
      return;
    }
    if (action === 'confirm') this.setSail();
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

  private dateText(): string {
    return formatDate(this.deps.session.voyage.elapsedHours, STRINGS.months);
  }

  private plan(kind: RepairKind): RepairPlan {
    const { condition, gold, ship } = this.deps.session.voyage;
    const cls = SHIP_CLASSES[ship.classId];
    if (kind === 'all') return fullRepair(cls, condition);
    if (kind === 'affordable') return affordableRepair(cls, condition, gold);
    return gunReplacement(cls, condition, gold);
  }

  private shipwrightView(): ShipwrightView {
    const { condition, gold, ship } = this.deps.session.voyage;
    const offer = (plan: RepairPlan) => ({
      costGold: plan.costGold,
      hours: plan.hours,
      empty: isEmptyRepair(plan, condition),
      affordable: plan.costGold <= gold,
    });
    const guns = this.plan('guns');
    return {
      hullPct: condition.hullPct,
      riggingPct: condition.riggingPct,
      gunsIntact: condition.gunsIntact,
      gunsMax: SHIP_CLASSES[ship.classId].guns,
      gold,
      full: offer(this.plan('all')),
      affordable: offer(this.plan('affordable')),
      guns: { count: guns.condition.gunsIntact - condition.gunsIntact, costGold: guns.costGold },
    };
  }

  private openShipwright(): void {
    this.deps.shipwright.show(this.shipwrightView(), {
      onRepairAll: () => this.repair('all'),
      onRepairAffordable: () => this.repair('affordable'),
      onReplaceGuns: () => this.repair('guns'),
      onBack: () => this.closeShipwright(),
    });
  }

  private closeShipwright(): void {
    this.deps.shipwright.hide();
    this.deps.portScreen.focus();
  }

  private repair(kind: RepairKind): void {
    const { session } = this.deps;
    const plan = this.plan(kind);
    if (isEmptyRepair(plan, session.voyage.condition) || plan.costGold > session.voyage.gold) {
      return;
    }
    session.voyage = repairShip(session.voyage, plan);
    this.deps.save();
    this.deps.portScreen.setDate(this.dateText());
    this.deps.shipwright.update(this.shipwrightView());
  }

  private setSail(): void {
    if (!this.port) return;
    const { session, scene } = this.deps;
    session.voyage = setSailFrom(session.voyage, scene.world, this.port);
    this.deps.save();
    this.deps.switchMode('sailing');
  }
}
