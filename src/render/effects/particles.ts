// SPDX-License-Identifier: GPL-3.0-only
import { EFFECT_COLORS } from '../palette';
import type { CameraOffset } from '../camera';

/** The kinds of particle the combat scene uses (spec §10.2). */
export type ParticleKind = 'smoke' | 'splinter' | 'canvas' | 'bubble' | 'debris';
const KINDS: readonly ParticleKind[] = ['smoke', 'splinter', 'canvas', 'bubble', 'debris'];

/** Pool size (spec §12: up to 400 live particles). */
export const MAX_PARTICLES = 400;

/**
 * A fixed pool of particles in parallel arrays: no allocation per particle or per frame. When
 * the pool is full the oldest particle is replaced.
 */
export class ParticlePool {
  readonly x = new Float32Array(MAX_PARTICLES);
  readonly y = new Float32Array(MAX_PARTICLES);
  readonly vx = new Float32Array(MAX_PARTICLES);
  readonly vy = new Float32Array(MAX_PARTICLES);
  readonly born = new Float64Array(MAX_PARTICLES).fill(-Infinity);
  /** Lifetime in seconds; Infinity lasts until cleared (debris). */
  readonly life = new Float32Array(MAX_PARTICLES);
  /** Starting size in px, and how much it grows per second (smoke). */
  readonly size = new Float32Array(MAX_PARTICLES);
  readonly grow = new Float32Array(MAX_PARTICLES);
  readonly kind = new Uint8Array(MAX_PARTICLES);
  private next = 0;

  spawn(
    kind: ParticleKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    nowSec: number,
    lifeSec: number,
    size = 1,
    grow = 0,
  ): void {
    const i = this.next;
    this.next = (this.next + 1) % MAX_PARTICLES;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.born[i] = nowSec;
    this.life[i] = lifeSec;
    this.size[i] = size;
    this.grow[i] = grow;
    this.kind[i] = KINDS.indexOf(kind);
  }

  clear(): void {
    this.born.fill(-Infinity);
  }

  /** Particles still alive at `nowSec`. */
  countAlive(nowSec: number): number {
    let n = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) if (this.alive(i, nowSec)) n++;
    return n;
  }

  private alive(i: number, nowSec: number): boolean {
    const age = nowSec - this.born[i]!;
    return age >= 0 && age < this.life[i]!;
  }

  /** Move every live particle; smoke and canvas drift, the rest fly and slow. */
  update(dtSec: number, nowSec: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.alive(i, nowSec)) continue;
      this.x[i] = this.x[i]! + this.vx[i]! * dtSec;
      this.y[i] = this.y[i]! + this.vy[i]! * dtSec;
      if (this.kind[i] === 1) {
        // Splinters lose their speed quickly.
        this.vx[i] = this.vx[i]! * 0.9;
        this.vy[i] = this.vy[i]! * 0.9;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, cam: CameraOffset, nowSec: number): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.alive(i, nowSec)) continue;
      const age = nowSec - this.born[i]!;
      const kind = KINDS[this.kind[i]!]!;
      const x = Math.round(this.x[i]!) - cam.x;
      const y = Math.round(this.y[i]!) - cam.y;
      const fade = Number.isFinite(this.life[i]!) ? 1 - age / this.life[i]! : 1;
      ctx.globalAlpha = kind === 'debris' ? 1 : Math.max(0, fade) * (kind === 'smoke' ? 0.75 : 1);
      ctx.fillStyle = EFFECT_COLORS[kind];
      const size = Math.max(1, Math.round(this.size[i]! + this.grow[i]! * age));
      ctx.fillRect(x - (size >> 1), y - (size >> 1), size, size);
    }
    ctx.globalAlpha = 1;
  }
}
