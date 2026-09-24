// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../../data/strings';
import type { Action, HeldActions } from '../../input/actions';
import { computeCamera } from '../../render/camera';
import { drawPennant, Wake } from '../../render/effects/wake';
import { drawMapSlice } from '../../render/map/drawMap';
import { DEEP_SEA } from '../../render/palette';
import { SHIP_SPRITE_SIZE, spriteIndex, type ShipSprites } from '../../render/sprites/ship';
import { bearingToCompass16, headingToBearingDeg } from '../../sim/math';
import { pointOfSail, relativeWindDeg } from '../../sim/sailing/polar';
import { changeSail, stepShip, type PlayerShip } from '../../sim/sailing/ship';
import { createStartShip } from '../../sim/sailing/start';
import { fromBearingDeg, windAt, type Wind } from '../../sim/sailing/wind';
import { advanceClock, START_ELAPSED_HOURS } from '../../sim/time';
import type { World } from '../../sim/world/world';
import type { DevReadout } from '../../ui/devReadout';
import type { Mode } from './mode';

export interface SailingDeps {
  readonly world: World;
  readonly map: HTMLCanvasElement;
  readonly sprites: ShipSprites;
  readonly held: Readonly<HeldActions>;
  readonly readout: DevReadout | null;
}

export class SailingMode implements Mode {
  readonly id = 'sailing';
  private ship: PlayerShip;
  private elapsedHours = START_ELAPSED_HOURS;
  private wind: Wind;
  /** Real seconds spent sailing; drives effects only. */
  private timeSec = 0;
  private readonly wake = new Wake();

  constructor(private readonly deps: SailingDeps) {
    this.ship = createStartShip(deps.world);
    this.wind = windAt(this.ship.x, this.ship.y, this.elapsedHours);
  }

  enter(): void {}

  exit(): void {}

  handleAction(action: Action): void {
    if (action === 'hoist') this.ship = { ...this.ship, sail: changeSail(this.ship.sail, 1) };
    if (action === 'reef') this.ship = { ...this.ship, sail: changeSail(this.ship.sail, -1) };
  }

  update(dtSec: number): void {
    const { held, world, readout } = this.deps;
    this.wind = windAt(this.ship.x, this.ship.y, this.elapsedHours);
    const result = stepShip(this.ship, held, this.wind, world, dtSec);
    this.ship = result.ship;
    for (const event of result.events) {
      if (event.type === 'shoal') readout?.flash(STRINGS.shoal, this.timeSec);
    }
    this.elapsedHours = advanceClock(this.elapsedHours, dtSec);
    this.timeSec += dtSec;
    this.wake.update(this.timeSec, dtSec, this.ship);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { world, map, sprites } = this.deps;
    const ship = this.ship;
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

    this.deps.readout?.update(this.timeSec, () => this.readoutText());
  }

  private readoutText(): string {
    const ship = this.ship;
    const course = headingToBearingDeg(ship.headingRad);
    const windFrom = fromBearingDeg(this.wind);
    const pos =
      STRINGS.pointOfSail[pointOfSail(relativeWindDeg(ship.headingRad, this.wind.towardRad))];
    const day = Math.floor(this.elapsedHours / 24) + 1;
    return [
      `Course ${Math.round(course).toString().padStart(3, '0')}° ${bearingToCompass16(course)}`,
      `${ship.speedKn.toFixed(1)} kn · ${pos}`,
      `Wind ${bearingToCompass16(windFrom)} ${Math.round(this.wind.speedKn)} kn`,
      STRINGS.sail[ship.sail],
      `Day ${day} of the voyage`,
      '',
      '←/→ steer   ↑/↓ hoist/reef',
    ].join('\n');
  }
}
