// SPDX-License-Identifier: GPL-3.0-only
import {
  COMBAT_SAILING_SCALE,
  EDGE_WARNING_PX,
  ESCAPE_DISTANCE_PX,
  MAX_BALLS,
  SINKING_SEC,
} from '../data/combat';
import { NATIONS, PIRATE_FLAG, type FlagPixels } from '../data/nations';
import { PLAYER_NATION, type Allegiance } from '../data/relations';
import { SHIP_CLASSES } from '../data/ships';
import type { CombatEvent } from '../sim/combat/step';
import type { CombatShip, CombatState } from '../sim/combat/state';
import { hash2, createRng, type Rng } from '../sim/rng';
import type { CameraOffset } from './camera';
import { sparkleProgress } from './effects/sparkles';
import { ParticlePool } from './effects/particles';
import { Wake } from './effects/wake';
import {
  COMBAT_COLORS,
  EFFECT_COLORS,
  NPC_SAIL_COLORS,
  SHIP_COLORS,
  SPARKLE_COLOR,
} from './palette';
import {
  combatDims,
  sailHoles,
  spriteIndex,
  type CombatSprites,
  type ShipSpriteCache,
} from './sprites/ship';

const SPLASH_SEC = 0.3;
const SPLASH_POOL = 32;
/** Both ships stay in view with this margin before the camera stops framing them both. */
const FRAME_MARGIN_PX = 24;
const SMOKE_WIND_SHARE = 0.3;
const SWELL_SPACING_PX = 16;
const SWELL_SPEED_PX_PER_SEC = 4;
const SPARKLE_CELL_PX = 12;
const POINTER_MARGIN_PX = 6;
const BUBBLE_INTERVAL_SEC = 0.1;
const STRUCK_FLAG: FlagPixels = ['#f2f2f2', '#f2f2f2', '#f2f2f2', '#f2f2f2', '#f2f2f2', '#f2f2f2'];

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
      const r = 1 + Math.floor((age / SPLASH_SEC) * 3); // a ring in three frames
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
  return { x: Math.round(fx - viewW / 2), y: Math.round(fy - viewH / 2) };
}

/**
 * Where to put the pointer to an off-screen enemy (spec §6.2): the point where the ray from
 * `(fromX, fromY)` toward `(dx, dy)` leaves the view, inset by `margin`. Screen px.
 */
export function edgePointer(
  viewW: number,
  viewH: number,
  fromX: number,
  fromY: number,
  dx: number,
  dy: number,
  margin: number,
): { x: number; y: number; angleRad: number } {
  const angleRad = Math.atan2(dy, dx);
  const tx = dx > 0 ? (viewW - margin - fromX) / dx : dx < 0 ? (margin - fromX) / dx : Infinity;
  const ty = dy > 0 ? (viewH - margin - fromY) / dy : dy < 0 ? (margin - fromY) / dy : Infinity;
  const t = Math.max(0, Math.min(tx, ty));
  return { x: fromX + dx * t, y: fromY + dy * t, angleRad };
}

function flagFor(allegiance: Allegiance | 'player'): FlagPixels {
  if (allegiance === 'player') return NATIONS[PLAYER_NATION].flag;
  return allegiance === 'pirate' ? PIRATE_FLAG : NATIONS[allegiance].flag;
}

/** The pointer shown when the enemy is off screen: where it points and how far she is. */
export interface CombatPointer {
  readonly x: number;
  readonly y: number;
  readonly rangePx: number;
}

/**
 * Everything the combat view remembers that the simulation does not: smoke, splinters, splashes,
 * wakes, hit flashes, sail holes and sinking debris (spec §10.1–10.2). Pooled: no allocation
 * per frame.
 */
export class CombatScene {
  private readonly particles = new ParticlePool();
  private readonly splashes = new SplashRing();
  private wakes: [Wake, Wake] = [new Wake(), new Wake()];
  private holes: [{ x: number; y: number }[], { x: number; y: number }[]] = [[], []];
  private flags: [FlagPixels, FlagPixels] = [STRUCK_FLAG, STRUCK_FLAG];
  private flashFrames = [0, 0];
  private lastBubbleSec = [0, 0];
  private debrisDropped = [false, false];
  private rng: Rng = createRng(1);
  private swell: CanvasPattern | null = null;

  constructor(private readonly sprites: ShipSpriteCache) {}

  /** Get ready for a new fight: sprites, holes and flags for these two ships. */
  reset(state: CombatState, enemyAllegiance: Allegiance, seed: number): void {
    this.particles.clear();
    this.splashes.clear();
    this.rng = createRng(seed);
    this.flashFrames = [0, 0];
    this.lastBubbleSec = [0, 0];
    this.debrisDropped = [false, false];
    this.swell = null;
    const [p, e] = state.ships;
    this.wakes = [
      new Wake(SHIP_CLASSES[p.classId].lengthPx / 2),
      new Wake(SHIP_CLASSES[e.classId].lengthPx / 2),
    ];
    this.holes = [
      sailHoles(SHIP_CLASSES[p.classId], combatDims(SHIP_CLASSES[p.classId]), seed),
      sailHoles(SHIP_CLASSES[e.classId], combatDims(SHIP_CLASSES[e.classId]), seed + 1),
    ];
    this.flags = [flagFor('player'), flagFor(enemyAllegiance)];
    // Generate both ships' sprites now rather than on the first frame.
    for (const ship of state.ships) this.spritesFor(ship);
  }

  private spritesFor(ship: CombatShip): CombatSprites {
    const sail = ship.role === 'player' ? SHIP_COLORS.sail : NPC_SAIL_COLORS[ship.role];
    return this.sprites.getCombat(ship.classId, sail);
  }

  /** Turn simulation events into effects (spec §10.2). */
  react(event: CombatEvent, state: CombatState, nowSec: number): void {
    const rng = this.rng;
    const wind = state.wind;
    const drift = wind.speedKn * SMOKE_WIND_SHARE * COMBAT_SAILING_SCALE.pxPerSecPerKnot;
    const wx = Math.cos(wind.towardRad) * drift;
    const wy = Math.sin(wind.towardRad) * drift;
    switch (event.type) {
      case 'shot':
        // A puff of smoke at the gunport that grows, fades and drifts downwind.
        this.particles.spawn(
          'smoke',
          event.x,
          event.y,
          wx,
          wy,
          nowSec,
          2.5,
          3 + Math.floor(rng() * 3),
          1.2,
        );
        break;
      case 'splash':
        this.splashes.add(event.x, event.y, nowSec);
        break;
      case 'hit':
        if (event.location === 'rigging') {
          const n = 2 + Math.floor(rng() * 2);
          for (let i = 0; i < n; i++) {
            this.particles.spawn(
              'canvas',
              event.x,
              event.y,
              wx + (rng() - 0.5) * 6,
              wy + (rng() - 0.5) * 6,
              nowSec,
              1.6,
            );
          }
        } else {
          this.flashFrames[event.ship] = 1;
          const n = 4 + Math.floor(rng() * 3);
          for (let i = 0; i < n; i++) {
            const a = rng() * Math.PI * 2;
            const v = 20 + rng() * 20;
            this.particles.spawn(
              'splinter',
              event.x,
              event.y,
              Math.cos(a) * v,
              Math.sin(a) * v,
              nowSec,
              0.6,
            );
          }
        }
        break;
      default:
        break;
    }
  }

  /** Advance the effects by one frame's worth of time. */
  update(state: CombatState, dtSec: number, nowSec: number): void {
    this.particles.update(dtSec, nowSec);
    for (const ship of state.ships) {
      if (ship.sinkingSec === null) {
        this.wakes[ship.index].update(nowSec, dtSec, ship.ship);
        continue;
      }
      // Bubbles while she goes down, then floating debris for the rest of the fight.
      if (
        ship.sinkingSec < SINKING_SEC &&
        nowSec - this.lastBubbleSec[ship.index]! >= BUBBLE_INTERVAL_SEC
      ) {
        this.lastBubbleSec[ship.index] = nowSec;
        const r = SHIP_CLASSES[ship.classId].lengthPx / 3;
        this.particles.spawn(
          'bubble',
          ship.ship.x + (this.rng() - 0.5) * r,
          ship.ship.y + (this.rng() - 0.5) * r,
          0,
          -6,
          nowSec,
          1,
        );
      }
      if (ship.sinkingSec >= SINKING_SEC * 0.9 && !this.debrisDropped[ship.index]) {
        this.debrisDropped[ship.index] = true;
        const n = 5 + Math.floor(this.rng() * 4);
        for (let i = 0; i < n; i++) {
          this.particles.spawn(
            'debris',
            ship.ship.x + (this.rng() - 0.5) * 14,
            ship.ship.y + (this.rng() - 0.5) * 10,
            0,
            0,
            nowSec,
            Infinity,
          );
        }
      }
    }
  }

  /** Draw the fight; returns the camera and the pointer to an off-screen enemy, if any. */
  draw(
    ctx: CanvasRenderingContext2D,
    state: CombatState,
    nowSec: number,
    reducedMotion: boolean,
  ): { cam: CameraOffset; pointer: CombatPointer | null } {
    const { width, height } = ctx.canvas;
    const cam = combatCamera(state, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COMBAT_COLORS.sea;
    ctx.fillRect(0, 0, width, height);
    if (!reducedMotion) {
      this.drawSwell(ctx, state, cam, nowSec);
      this.drawSparkles(ctx, state, cam, nowSec);
    }
    for (const ship of state.ships)
      if (ship.sinkingSec === null) this.wakes[ship.index].draw(ctx, cam, nowSec);
    for (const ship of state.ships) this.drawShip(ctx, cam, ship);
    this.drawBalls(ctx, state, cam);
    this.splashes.draw(ctx, cam, nowSec);
    this.particles.draw(ctx, cam, nowSec);
    this.drawHorizonWarning(ctx, state);
    return { cam, pointer: this.drawPointer(ctx, state, cam) };
  }

  private drawSwell(
    ctx: CanvasRenderingContext2D,
    state: CombatState,
    cam: CameraOffset,
    nowSec: number,
  ): void {
    if (!this.swell) {
      // A dithered darker band every 16 px, as a tile repeated under a rotation.
      const tile = document.createElement('canvas');
      tile.width = SWELL_SPACING_PX;
      tile.height = SWELL_SPACING_PX;
      const t = tile.getContext('2d');
      if (!t) return;
      t.fillStyle = EFFECT_COLORS.swell;
      for (let x = 0; x < SWELL_SPACING_PX; x += 2) t.fillRect(x, 0, 1, 1);
      for (let x = 1; x < SWELL_SPACING_PX; x += 2) t.fillRect(x, 1, 1, 1);
      this.swell = ctx.createPattern(tile, 'repeat');
    }
    if (!this.swell) return;
    // Bands lie across the wind and roll downwind at 4 px/s.
    const a = state.wind.towardRad - Math.PI / 2;
    const roll = nowSec * SWELL_SPEED_PX_PER_SEC;
    const m = new DOMMatrix()
      .translateSelf(
        -cam.x + Math.cos(state.wind.towardRad) * roll,
        -cam.y + Math.sin(state.wind.towardRad) * roll,
      )
      .rotateSelf((a * 180) / Math.PI);
    this.swell.setTransform(m);
    ctx.fillStyle = this.swell;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  private drawSparkles(
    ctx: CanvasRenderingContext2D,
    state: CombatState,
    cam: CameraOffset,
    nowSec: number,
  ): void {
    const wx = Math.cos(state.wind.towardRad) * 3;
    const wy = Math.sin(state.wind.towardRad) * 3;
    const c0 = Math.floor(cam.x / SPARKLE_CELL_PX);
    const r0 = Math.floor(cam.y / SPARKLE_CELL_PX);
    const c1 = Math.ceil((cam.x + ctx.canvas.width) / SPARKLE_CELL_PX);
    const r1 = Math.ceil((cam.y + ctx.canvas.height) / SPARKLE_CELL_PX);
    ctx.fillStyle = SPARKLE_COLOR;
    for (let row = r0; row < r1; row++) {
      for (let col = c0; col < c1; col++) {
        const progress = sparkleProgress(hash2(col, row, 0x5eb), nowSec);
        if (progress < 0) continue;
        const x = col * SPARKLE_CELL_PX + Math.floor(hash2(col, row, 0x5ec) * SPARKLE_CELL_PX);
        const y = row * SPARKLE_CELL_PX + Math.floor(hash2(col, row, 0x5ed) * SPARKLE_CELL_PX);
        ctx.fillRect(
          Math.round(x + wx * progress) - cam.x - 1,
          Math.round(y + wy * progress) - cam.y,
          3,
          1,
        );
      }
    }
  }

  private drawShip(ctx: CanvasRenderingContext2D, cam: CameraOffset, ship: CombatShip): void {
    const cls = SHIP_CLASSES[ship.classId];
    const sprites = this.spritesFor(ship);
    const rigging = ship.condition.riggingPct;
    const furled = ship.struck || ship.sinkingSec !== null || ship.ship.sail === 'furled';
    const frames = furled ? sprites.furled : rigging < 30 ? sprites.oneSail : sprites.set;
    const sprite = frames[spriteIndex(ship.ship.headingRad)]!;
    const cx = Math.round(ship.ship.x) - cam.x;
    const cy = Math.round(ship.ship.y) - cam.y;
    const half = sprites.size / 2;
    const cos = Math.cos(ship.ship.headingRad);
    const sin = Math.sin(ship.ship.headingRad);

    ctx.save();
    if (ship.sinkingSec !== null) {
      // She goes down by the head: the hull disappears row by row from bow to stern.
      const left = Math.max(0, 1 - ship.sinkingSec / SINKING_SEC);
      ctx.translate(cx, cy);
      ctx.rotate(ship.ship.headingRad);
      ctx.beginPath();
      ctx.rect(-half, -half, half * 2 * left, half * 2);
      ctx.clip();
      ctx.rotate(-ship.ship.headingRad);
      ctx.translate(-cx, -cy);
    }
    ctx.drawImage(sprite, cx - half, cy - half);
    if (this.flashFrames[ship.index]! > 0) {
      // One frame lighter on a hull hit.
      this.flashFrames[ship.index] = this.flashFrames[ship.index]! - 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45;
      ctx.drawImage(sprite, cx - half, cy - half);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    if (ship.sinkingSec !== null) return;

    // Holes in damaged sails (spec §10.1), punched at runtime.
    if (!furled && rigging < 60 && frames === sprites.set) {
      ctx.fillStyle = COMBAT_COLORS.sea;
      for (const h of this.holes[ship.index]) {
        ctx.fillRect(
          Math.round(cx + h.x * cos - h.y * sin),
          Math.round(cy + h.x * sin + h.y * cos),
          1,
          1,
        );
      }
    }
    // The flag at the stern, or a white square once she has struck.
    const flag = ship.struck ? STRUCK_FLAG : this.flags[ship.index];
    const stern = cls.lengthPx / 2 - 1;
    const fx = Math.round(cx - cos * stern) - 1;
    const fy = Math.round(cy - sin * stern) - 1;
    const px = [flag[0], flag[1], flag[3], flag[4]] as const;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = px[i]!;
      ctx.fillRect(fx + (i % 2), fy + (i >> 1), 1, 1);
    }
  }

  private drawBalls(ctx: CanvasRenderingContext2D, state: CombatState, cam: CameraOffset): void {
    const { balls } = state;
    for (let i = 0; i < MAX_BALLS; i++) {
      if (!balls.active[i]) continue;
      const speed = Math.hypot(balls.vx[i]!, balls.vy[i]!) || 1;
      const x = Math.round(balls.x[i]!) - cam.x;
      const y = Math.round(balls.y[i]!) - cam.y;
      ctx.fillStyle = COMBAT_COLORS.ballTrail;
      ctx.fillRect(
        x - Math.round(balls.vx[i]! / speed),
        y - Math.round(balls.vy[i]! / speed),
        1,
        1,
      );
      ctx.fillStyle = COMBAT_COLORS.ball;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  /** Darken the edges as the ships near the horizon (ADR 013; the spec's edge vignette). */
  private drawHorizonWarning(ctx: CanvasRenderingContext2D, state: CombatState): void {
    const [p, e] = state.ships;
    const gap = Math.hypot(p.ship.x - e.ship.x, p.ship.y - e.ship.y);
    const into = gap - (ESCAPE_DISTANCE_PX - EDGE_WARNING_PX);
    if (into <= 0) return;
    const t = Math.min(1, into / EDGE_WARNING_PX);
    const band = Math.round(4 + t * 8);
    const { width, height } = ctx.canvas;
    ctx.fillStyle = EFFECT_COLORS.horizon;
    ctx.globalAlpha = t;
    ctx.fillRect(0, 0, width, band);
    ctx.fillRect(0, height - band, width, band);
    ctx.fillRect(0, band, band, height - 2 * band);
    ctx.fillRect(width - band, band, band, height - 2 * band);
    ctx.globalAlpha = 1;
  }

  /** An arrow at the screen edge toward an enemy who is off screen (spec §6.2). */
  private drawPointer(
    ctx: CanvasRenderingContext2D,
    state: CombatState,
    cam: CameraOffset,
  ): CombatPointer | null {
    const [p, e] = state.ships;
    const { width, height } = ctx.canvas;
    const ex = e.ship.x - cam.x;
    const ey = e.ship.y - cam.y;
    if (ex >= 0 && ey >= 0 && ex < width && ey < height) return null;
    const px = p.ship.x - cam.x;
    const py = p.ship.y - cam.y;
    const pt = edgePointer(width, height, px, py, ex - px, ey - py, POINTER_MARGIN_PX);
    const c = Math.cos(pt.angleRad);
    const s = Math.sin(pt.angleRad);
    ctx.fillStyle = EFFECT_COLORS.pointer;
    // A small arrowhead: a tip, then two widening rows behind it.
    for (let back = 0; back < 4; back++) {
      for (let w = -back; w <= back; w++) {
        ctx.fillRect(
          Math.round(pt.x - c * back - s * w * 0.6),
          Math.round(pt.y - s * back + c * w * 0.6),
          1,
          1,
        );
      }
    }
    const rangePx = Math.hypot(e.ship.x - p.ship.x, e.ship.y - p.ship.y);
    return { x: pt.x + cam.x - c * 8, y: pt.y + cam.y - s * 8, rangePx };
  }
}
