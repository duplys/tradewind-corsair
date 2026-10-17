// SPDX-License-Identifier: GPL-3.0-only
import { GOOD_IDS, GOODS, type GoodId } from '../../data/goods';
import { hostileToPlayer } from '../../data/relations';
import { SHIP_CLASSES } from '../../data/ships';
import { STRINGS } from '../../data/strings';
import {
  HIRE_GOLD_PER_HAND,
  HIRE_STEPS,
  RUMOUR_GOLD,
  TIP_GOLD,
  TREASURE_MAX_ACTIVE,
} from '../../data/tavern';
import type { Action } from '../../input/actions';
import { drawSeaScene, type SeaScene } from '../../render/scene';
import { claimable, claimBounty, rankOf, standingLabel } from '../../sim/governor/governor';
import { NATIONS, type NationId } from '../../data/nations';
import { CROWN_NATION } from '../../data/governor';
import { restoreRng } from '../../sim/rng';
import { windAt } from '../../sim/sailing/wind';
import {
  affordableRepair,
  fullRepair,
  gunReplacement,
  isEmptyRepair,
  type RepairPlan,
} from '../../sim/ships/repair';
import { freeBerths, hireCrew, maxHires } from '../../sim/tavern/crew';
import { overhearRumour } from '../../sim/tavern/rumours';
import { buyTreasureTip } from '../../sim/tavern/treasure';
import { formatDate } from '../../sim/time';
import { basePriceAt, midPrice, effectiveNet, quoteAt } from '../../sim/trade/market';
import { buyGoods, cargoUsed, holdCapacityOf, maxBuyable, sellGoods } from '../../sim/trade/trade';
import { repairShip, setSailFrom } from '../../sim/voyage';
import { findPort, type Port } from '../../sim/world/ports';
import { formatGold } from '../../ui/format';
import type { GovernorPanel, GovernorView } from '../../ui/governorPanel';
import type { PortScreen } from '../../ui/portScreen';
import type { ShipwrightPanel, ShipwrightView } from '../../ui/shipwrightPanel';
import { rumourText } from '../../ui/tavernText';
import type { TavernPanel, TavernView } from '../../ui/tavernPanel';
import type { TradePanel, TradeView } from '../../ui/tradePanel';
import type { Session } from '../session';
import type { Mode, SwitchMode } from './mode';

export interface PortDeps {
  readonly scene: SeaScene;
  readonly session: Session;
  readonly portScreen: PortScreen;
  readonly shipwright: ShipwrightPanel;
  readonly governor: GovernorPanel;
  readonly merchant: TradePanel;
  readonly tavern: TavernPanel;
  readonly switchMode: SwitchMode;
  /** Write the current voyage to the save slot. */
  readonly save: () => void;
}

type RepairKind = 'all' | 'affordable' | 'guns';
type PortPanel = 'shipwright' | 'merchant' | 'tavern' | 'governor';

/** A price this far below (above) the good's usual price is called cheap (dear). */
const TAG_BAND = 0.12;

/**
 * At anchor (slice 1 spec §4.2). Game time is paused, except for the days a repair takes; the
 * port screen covers the map. Friendly ports offer the Shipwright (slice 2 spec §3.4); every
 * port has a Merchant and a Tavern (slice 4).
 */
export class PortMode implements Mode {
  readonly id = 'port';
  private port: Port | null = null;
  /** Decorative time only (waving flags); the game clock does not advance in port. */
  private timeSec = 0;
  /** What the last merchant or tavern action did, shown in the panel. */
  private panelNote = '';

  constructor(private readonly deps: PortDeps) {}

  enter(): void {
    const { session, scene, portScreen } = this.deps;
    const id = session.voyage.dockedPortId;
    if (id === null) throw new Error('Entered port mode without a docked port');
    const port = findPort(scene.ports, id);
    this.port = port;
    const shipwrightOpen = !hostileToPlayer(port.def.nation);
    this.panelNote = '';
    portScreen.show(port, this.dateText(), {
      onGovernor: shipwrightOpen ? () => this.openGovernor() : null,
      onTavern: () => this.openTavern(),
      onMerchant: () => this.openMerchant(),
      onShipwright: shipwrightOpen ? () => this.openShipwright() : null,
    });
  }

  exit(): void {
    this.closePanels();
    this.deps.shipwright.hide();
    this.deps.portScreen.hide();
    this.port = null;
  }

  handleAction(action: Action): void {
    const open = this.openPanel();
    if (open) {
      if (action === 'close') this.closePanel();
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
      onBack: () => this.closePanel(),
    });
  }

  private openPanel(): PortPanel | null {
    const { shipwright, merchant, tavern, governor } = this.deps;
    if (governor.isOpen) return 'governor';
    if (shipwright.isOpen) return 'shipwright';
    if (merchant.isOpen) return 'merchant';
    if (tavern.isOpen) return 'tavern';
    return null;
  }

  private closePanels(): void {
    this.deps.shipwright.hide();
    this.deps.merchant.hide();
    this.deps.tavern.hide();
    this.deps.governor.hide();
  }

  private closePanel(): void {
    this.closePanels();
    this.deps.portScreen.focus();
  }

  // ---- Governor (slice 4 spec §4) ----

  private governorView(): GovernorView {
    const { voyage } = this.deps.session;
    const nation = this.port!.def.nation;
    const rank = rankOf(nation, voyage.claimed[nation]);
    return {
      portName: this.port!.def.name,
      crown: nation === CROWN_NATION,
      gold: voyage.gold,
      rankTitle: rank.title,
      next: rank.next,
      standing: (Object.keys(NATIONS) as NationId[]).map((id) => ({
        nation: NATIONS[id].name,
        label: standingLabel(voyage.reputation[id]),
      })),
      owed: claimable(voyage, nation),
      note: this.panelNote,
    };
  }

  private openGovernor(): void {
    this.panelNote = '';
    this.deps.governor.show(this.governorView(), {
      onClaim: () => this.claim(),
      onBack: () => this.closePanel(),
    });
  }

  private claim(): void {
    const { session } = this.deps;
    const result = claimBounty(session.voyage, this.port!.def.nation);
    if (result.gold <= 0) return;
    session.voyage = result.voyage;
    const g = STRINGS.governor;
    this.panelNote = result.promotedTo
      ? `${g.paid(formatGold(result.gold))} ${g.promoted(result.promotedTo, formatGold(result.promotionGold))}`
      : g.paid(formatGold(result.gold));
    this.deps.save();
    this.deps.governor.update(this.governorView());
  }

  // ---- Merchant (slice 4 spec §2) ----

  private merchantView(): TradeView {
    const { voyage } = this.deps.session;
    const def = this.port!.def;
    const rows = GOOD_IDS.map((good) => {
      const quote = quoteAt(def, good, voyage.tradeFlow, voyage.elapsedHours);
      const mid = midPrice(
        basePriceAt(def, good, voyage.elapsedHours),
        effectiveNet(voyage.tradeFlow, def.id, good, voyage.elapsedHours),
      );
      const usual = GOODS[good].basePrice;
      return {
        good,
        held: voyage.cargo[good],
        buy: quote.buy,
        sell: quote.sell,
        tag:
          mid <= usual * (1 - TAG_BAND)
            ? ('cheap' as const)
            : mid >= usual * (1 + TAG_BAND)
              ? ('dear' as const)
              : null,
        canBuy: maxBuyable(voyage, def, good, 1),
      };
    });
    return {
      gold: voyage.gold,
      used: cargoUsed(voyage.cargo),
      capacity: holdCapacityOf(voyage),
      hostile: hostileToPlayer(def.nation),
      rows,
      note: this.panelNote,
    };
  }

  private openMerchant(): void {
    this.panelNote = '';
    this.deps.merchant.show(this.merchantView(), {
      onBuy: (good, count) => this.trade('buy', good, count),
      onSell: (good, count) => this.trade('sell', good, count),
      onBack: () => this.closePanel(),
    });
  }

  private trade(side: 'buy' | 'sell', good: GoodId, count: number): void {
    const { session } = this.deps;
    const def = this.port!.def;
    const before = session.voyage;
    const after =
      side === 'buy' ? buyGoods(before, def, good, count) : sellGoods(before, def, good, count);
    if (after === before) return;
    const moved = Math.abs(after.cargo[good] - before.cargo[good]);
    const gold = formatGold(Math.abs(after.gold - before.gold));
    const say = side === 'buy' ? STRINGS.merchant.bought : STRINGS.merchant.sold;
    this.panelNote = say(moved, GOODS[good].name.toLowerCase(), gold);
    session.voyage = after;
    this.deps.save();
    this.deps.merchant.update(this.merchantView());
  }

  // ---- Tavern (slice 4 spec §3) ----

  private tavernView(): TavernView {
    const { voyage } = this.deps.session;
    const { crewMax } = SHIP_CLASSES[voyage.ship.classId];
    const active = voyage.treasures.length;
    return {
      gold: voyage.gold,
      crew: voyage.condition.crew,
      crewMax,
      maxHires: maxHires(voyage),
      berths: freeBerths(voyage),
      hireSteps: HIRE_STEPS,
      hireCostPerHand: HIRE_GOLD_PER_HAND,
      rumourCost: RUMOUR_GOLD,
      tipCost: TIP_GOLD,
      canRumour: voyage.gold >= RUMOUR_GOLD,
      tipBlock: active >= TREASURE_MAX_ACTIVE ? 'full' : voyage.gold < TIP_GOLD ? 'gold' : null,
      note: this.panelNote,
    };
  }

  private openTavern(): void {
    this.panelNote = '';
    this.deps.tavern.show(this.tavernView(), {
      onHire: (count) => this.hire(count),
      onRumour: () => this.listen(),
      onTip: () => this.buyTip(),
      onBack: () => this.closePanel(),
    });
  }

  private tavernDone(note: string): void {
    this.panelNote = note;
    this.deps.save();
    this.deps.tavern.update(this.tavernView());
  }

  private hire(count: number): void {
    const { session } = this.deps;
    const after = hireCrew(session.voyage, count);
    const hired = after.condition.crew - session.voyage.condition.crew;
    if (hired <= 0) return;
    session.voyage = after;
    this.tavernDone(STRINGS.tavern.hired(hired));
  }

  private listen(): void {
    const { session, scene } = this.deps;
    const voyage = session.voyage;
    if (voyage.gold < RUMOUR_GOLD) return;
    const rng = restoreRng(voyage.rngState);
    const rumour = overhearRumour(voyage, scene.ports, this.port!, rng);
    session.voyage = { ...voyage, gold: voyage.gold - RUMOUR_GOLD, rngState: rng.state() };
    this.tavernDone(rumourText(rumour));
  }

  private buyTip(): void {
    const { session, scene } = this.deps;
    const result = buyTreasureTip(session.voyage, scene.world, scene.ports, this.port!);
    if (!result.ok) {
      if (result.reason === 'nothing') this.tavernDone(STRINGS.tavern.tipNothing);
      return;
    }
    session.voyage = result.voyage;
    this.tavernDone(STRINGS.tavern.tipBought);
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
