// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../../data/strings';
import type { Action, HeldActions } from '../../input/actions';
import { computeCamera } from '../../render/camera';
import { drawPennant, Wake } from '../../render/effects/wake';
import { drawMapSlice } from '../../render/map/drawMap';
import { DEEP_SEA } from '../../render/palette';
import { SHIP_SPRITE_SIZE, spriteIndex, type ShipSprites } from '../../render/sprites/ship';
import { changeSail, stepShip, type PlayerShip } from '../../sim/sailing/ship';
import { createStartShip } from '../../sim/sailing/start';
import { windAt, type Wind } from '../../sim/sailing/wind';
import { advanceClock, START_ELAPSED_HOURS } from '../../sim/time';
import type { World } from '../../sim/world/world';
import type { TouchControls } from '../../input/touch';
import type { Hud } from '../../ui/hud';
import type { MessageLine } from '../../ui/messageLine';
import type { Mode } from './mode';

export interface SailingDeps {
  readonly world: World;
  readonly map: HTMLCanvasElement;
  readonly sprites: ShipSprites;
  readonly held: Readonly<HeldActions>;
  readonly hud: Hud;
  readonly messages: MessageLine;
  readonly touch: TouchControls | null;
}

export class SailingMode implements Mode {
  readonly id = 'sailing';
  /** Mutable voyage state; the HUD sees it through the read-only HudState type. */
  private readonly state: { ship: PlayerShip; wind: Wind; elapsedHours: number };
  /** Real seconds spent sailing; drives effects only. */
  private timeSec = 0;
  private readonly wake = new Wake();

  constructor(private readonly deps: SailingDeps) {
    const ship = createStartShip(deps.world);
    this.state = {
      ship,
      elapsedHours: START_ELAPSED_HOURS,
      wind: windAt(ship.x, ship.y, START_ELAPSED_HOURS),
    };
  }

  enter(): void {
    this.deps.hud.show();
    this.deps.touch?.show();
  }

  exit(): void {
    this.deps.hud.hide();
    this.deps.touch?.hide();
    this.deps.messages.hide();
  }

  handleAction(action: Action): void {
    if (action === 'hoist')
      this.state.ship = { ...this.state.ship, sail: changeSail(this.state.ship.sail, 1) };
    if (action === 'reef')
      this.state.ship = { ...this.state.ship, sail: changeSail(this.state.ship.sail, -1) };
  }

  update(dtSec: number): void {
    const { held, world, messages } = this.deps;
    this.state.wind = windAt(this.state.ship.x, this.state.ship.y, this.state.elapsedHours);
    const result = stepShip(this.state.ship, held, this.state.wind, world, dtSec);
    this.state.ship = result.ship;
    for (const event of result.events) {
      if (event.type === 'shoal') messages.show(STRINGS.shoal, this.timeSec);
    }
    this.state.elapsedHours = advanceClock(this.state.elapsedHours, dtSec);
    this.timeSec += dtSec;
    this.wake.update(this.timeSec, dtSec, this.state.ship);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { world, map, sprites } = this.deps;
    const ship = this.state.ship;
    ctx.fillStyle = DEEP_SEA;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const cam = computeCamera(
      ship.x,
      ship.y,
      ctx.canvas.width,
      ctx.canvas.height,
      world.width,
      world.height,
    );
    drawMapSlice(ctx, map, cam);
    this.wake.draw(ctx, cam, this.timeSec);

    const frames = ship.sail === 'furled' ? sprites.furled : sprites.set;
    const sprite = frames[spriteIndex(ship.headingRad)]!;
    const half = SHIP_SPRITE_SIZE / 2;
    ctx.drawImage(sprite, Math.round(ship.x) - cam.x - half, Math.round(ship.y) - cam.y - half);
    drawPennant(ctx, cam, ship, this.timeSec);

    this.deps.hud.update(this.state, this.timeSec);
    this.deps.messages.update(this.timeSec);
  }
}
