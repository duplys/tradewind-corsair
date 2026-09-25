// SPDX-License-Identifier: GPL-3.0-only
import { MAX_BALLS, SINKING_SEC } from '../data/combat';
import { SHIP_CLASSES } from '../data/ships';
import type { CombatShip, CombatState } from '../sim/combat/state';
import type { CameraOffset } from './camera';
import { COMBAT_COLORS, NPC_SAIL_COLORS, SHIP_COLORS } from './palette';
import { spriteIndex, type ShipSpriteCache } from './sprites/ship';

const SPLASH_SEC = 0.3;
const SPLASH_POOL = 32;
/** Both ships stay in view with this margin before the camera stops framing them both. */
const FRAME_MARGIN_PX = 24;

/** Recent splashes, in a fixed ring (no allocation per splash). */
export class SplashRing {
  private readonly x = new Float64Array(SPLASH_POOL);
  private readonly y = new Float64Array(SPLASH_POOL);
  private readonly born = new Float64Array(SPLASH_POOL).fill(-Infinity);
  private next = 0;

  add(x: number, y: number, nowSec: number): void {
    this.x[this.next] = x;
    this.y[this.next] = y;
    this.born[this.next] = nowSec;
    this.next = (this.next + 1) % SPLASH_POOL;
  }

  clear(): void {
    this.born.fill(-Infinity);
  }

  draw(ctx: CanvasRenderingContext2D, cam: CameraOffset, nowSec: number): void {
    ctx.fillStyle = COMBAT_COLORS.splash;
    for (let i = 0; i < SPLASH_POOL; i++) {
      const age = nowSec - this.born[i]!;
      if (age < 0 || age >= SPLASH_SEC) continue;
      const r = 1 + Math.floor((age / SPLASH_SEC) * 3);
      const x = Math.round(this.x[i]!) - cam.x;
      const y = Math.round(this.y[i]!) - cam.y;
      ctx.fillRect(x - r, y, 1, 1);
      ctx.fillRect(x + r, y, 1, 1);
      ctx.fillRect(x, y - r, 1, 1);
      ctx.fillRect(x, y + r, 1, 1);
    }
  }
}

/**
 * Frame the fight (spec §6.2): centre on the midpoint of the two ships while both fit on
 * screen, otherwise follow the player. The sea has no edge (ADR 013), so nothing is clamped.
 */
export function combatCamera(state: CombatState, viewW: number, viewH: number): CameraOffset {
  const [p, e] = state.ships;
  const fits =
    Math.abs(p.ship.x - e.ship.x) + 2 * FRAME_MARGIN_PX <= viewW &&
    Math.abs(p.ship.y - e.ship.y) + 2 * FRAME_MARGIN_PX <= viewH;
  const fx = fits ? (p.ship.x + e.ship.x) / 2 : p.ship.x;
  const fy = fits ? (p.ship.y + e.ship.y) / 2 : p.ship.y;
  // Open sea: no edges to clamp to.
  return { x: Math.round(fx - viewW / 2), y: Math.round(fy - viewH / 2) };
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  cam: CameraOffset,
  sprites: ShipSpriteCache,
  ship: CombatShip,
): void {
  const cls = SHIP_CLASSES[ship.classId];
  const sail = ship.role === 'player' ? SHIP_COLORS.sail : NPC_SAIL_COLORS[ship.role];
  const set = sprites.get(ship.classId, sail);
  const frames = ship.ship.sail === 'furled' ? set.furled : set.set;
  // World sprites scaled up to the combat hull length (proper combat sprites arrive in M6).
  const size = Math.round(set.size * (cls.lengthPx / cls.worldLengthPx));
  ctx.globalAlpha = ship.sinkingSec === null ? 1 : Math.max(0, 1 - ship.sinkingSec / SINKING_SEC);
  ctx.drawImage(
    frames[spriteIndex(ship.ship.headingRad)]!,
    Math.round(ship.ship.x - size / 2) - cam.x,
    Math.round(ship.ship.y - size / 2) - cam.y,
    size,
    size,
  );
  ctx.globalAlpha = 1;
}

/** Draw the arena, both ships, the shot in flight and splashes. */
export function drawCombatScene(
  ctx: CanvasRenderingContext2D,
  state: CombatState,
  sprites: ShipSpriteCache,
  splashes: SplashRing,
  nowSec: number,
): void {
  const { width, height } = ctx.canvas;
  const cam = combatCamera(state, width, height);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = COMBAT_COLORS.sea;
  ctx.fillRect(0, 0, width, height);

  for (const ship of state.ships) drawShip(ctx, cam, sprites, ship);

  const { balls } = state;
  for (let i = 0; i < MAX_BALLS; i++) {
    if (!balls.active[i]) continue;
    const speed = Math.hypot(balls.vx[i]!, balls.vy[i]!) || 1;
    const x = Math.round(balls.x[i]!) - cam.x;
    const y = Math.round(balls.y[i]!) - cam.y;
    ctx.fillStyle = COMBAT_COLORS.ballTrail;
    ctx.fillRect(x - Math.round(balls.vx[i]! / speed), y - Math.round(balls.vy[i]! / speed), 1, 1);
    ctx.fillStyle = COMBAT_COLORS.ball;
    ctx.fillRect(x, y, 1, 1);
  }
  splashes.draw(ctx, cam, nowSec);
}
