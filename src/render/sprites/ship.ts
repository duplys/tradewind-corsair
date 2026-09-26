// SPDX-License-Identifier: GPL-3.0-only
import { SHIP_CLASSES, type ShipClass, type ShipClassId } from '../../data/ships';
import { TAU } from '../../sim/math';
import { createRng } from '../../sim/rng';
import {
  GUNPORT_COLOR,
  SHIP_COLORS,
  SPRITE_OUTLINE,
  STERNCASTLE_COLOR,
  hexToRgb,
  shadeHex,
} from '../palette';
import { quantiseAndOutline } from './pixelArt';

export const SHIP_HEADINGS = 32;
/** Bowsprit length beyond the bow, in world px. */
const BOWSPRIT_PX = 3;
/** Sail shade relative to the sail colour. */
const SAIL_SHADE = 0.82;

/** Sprites for one ship look: 32 headings with sails set and furled. */
export interface ShipSprites {
  /** Width and height of every canvas, in px. */
  readonly size: number;
  /** Indexed by heading index; `set` is used for half and full sail. */
  readonly set: readonly HTMLCanvasElement[];
  readonly furled: readonly HTMLCanvasElement[];
}

/** Sprite index for a heading: round(heading / 2π · 32) mod 32. */
export function spriteIndex(headingRad: number): number {
  const i = Math.round((headingRad / TAU) * SHIP_HEADINGS) % SHIP_HEADINGS;
  return (i + SHIP_HEADINGS) % SHIP_HEADINGS;
}

/**
 * Canvas size for a world-scale hull: room for half the hull, the bowsprit and the outline at
 * any heading (26 px for the 16 px sloop, as in slice 1).
 */
export function spriteSizeFor(worldLengthPx: number): number {
  return 2 * Math.ceil(worldLengthPx / 2 + BOWSPRIT_PX + 2);
}

/** Beam of the world-scale hull, in proportion to the combat hull (at least 5 px). */
export function worldBeamPx(cls: ShipClass): number {
  return Math.max(5, Math.round((cls.beamPx * cls.worldLengthPx) / cls.lengthPx));
}

/** Hull size to draw: the world-map size or the combat size (spec §3.1, §4.5, §10.1). */
export interface ShipDims {
  readonly lengthPx: number;
  readonly beamPx: number;
}

export function worldDims(cls: ShipClass): ShipDims {
  return { lengthPx: cls.worldLengthPx, beamPx: worldBeamPx(cls) };
}

export function combatDims(cls: ShipClass): ShipDims {
  return { lengthPx: cls.lengthPx, beamPx: cls.beamPx };
}

/** Mast positions along the hull, as fractions of its length from the middle. */
const MAST_POSITIONS: Readonly<Record<1 | 2 | 3, readonly number[]>> = {
  1: [0.1],
  2: [-0.18, 0.14],
  3: [-0.28, -0.02, 0.22],
};

/** An axis-aligned rectangle in the ship's frame (x along the keel toward the bow). */
export interface ShipRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Where things are on a hull drawn pointing along +x and centred on the origin. */
export interface ShipGeometry {
  readonly stern: number;
  readonly bow: number;
  readonly shoulder: number;
  readonly beam: number;
  readonly masts: readonly number[];
  /** Square sails across the beam, or the sloop's mainsail along the centreline. */
  readonly sails: readonly ShipRect[];
  /** The sail kept when the rigging is nearly gone (spec §10.1: below 30 %, only one sail). */
  readonly mainSail: number;
}

export function shipGeometry(cls: ShipClass, dims: ShipDims): ShipGeometry {
  const L = dims.lengthPx;
  const B = dims.beamPx;
  const shift = -BOWSPRIT_PX / 2; // make room for the bowsprit
  const stern = -L / 2 + shift;
  const bow = L / 2 + shift;
  const masts = MAST_POSITIONS[cls.masts].map((f) => f * L + shift);
  let sails: ShipRect[];
  if (cls.masts === 1) {
    const boomEnd = stern + L * 0.2;
    sails = [{ x0: boomEnd, y0: -1.5, x1: masts[0]!, y1: 1.5 }];
  } else {
    const main = Math.floor(masts.length / 2);
    sails = masts.map((x, i) => {
      const width = B + (i === main ? 4 : 2);
      return { x0: x - 1, y0: -width / 2, x1: x + 1, y1: width / 2 };
    });
  }
  return {
    stern,
    bow,
    shoulder: bow - B * 0.7,
    beam: B,
    masts,
    sails,
    mainSail: cls.masts === 1 ? 0 : Math.floor(masts.length / 2),
  };
}

/** How the rig is drawn: all sails set, only the main sail left, or furled. */
export type RigState = 'set' | 'oneSail' | 'furled';

/**
 * Draw a ship pointing along +x, centred on the origin (slice 2 spec §4.5, §10.1): a pointed
 * hull with a bowsprit, a sterncastle on the fluyt and galleon, gunports along the sides at
 * combat size, and its rig. The sloop has one mast with a fore-and-aft mainsail and a jib; the
 * others have square sails across the beam.
 */
function drawShip(
  ctx: CanvasRenderingContext2D,
  cls: ShipClass,
  dims: ShipDims,
  sail: string,
  rig: RigState,
  gunports: boolean,
): void {
  const g = shipGeometry(cls, dims);
  const L = dims.lengthPx;
  const B = g.beam;
  const { stern, bow, shoulder } = g;
  const shade = shadeHex(sail, SAIL_SHADE);

  ctx.fillStyle = SHIP_COLORS.hull;
  ctx.beginPath();
  ctx.moveTo(stern, -B / 2);
  ctx.lineTo(shoulder, -B / 2);
  ctx.lineTo(bow, 0);
  ctx.lineTo(shoulder, B / 2);
  ctx.lineTo(stern, B / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(bow - 0.5, -0.5, BOWSPRIT_PX + 0.5, 1);

  ctx.fillStyle = SHIP_COLORS.deck;
  ctx.beginPath();
  ctx.moveTo(stern + 1, -B / 2 + 1);
  ctx.lineTo(shoulder - 0.5, -B / 2 + 1);
  ctx.lineTo(bow - 2, 0);
  ctx.lineTo(shoulder - 0.5, B / 2 - 1);
  ctx.lineTo(stern + 1, B / 2 - 1);
  ctx.closePath();
  ctx.fill();
  if (cls.id === 'fluyt' || cls.id === 'galleon') {
    ctx.fillStyle = STERNCASTLE_COLOR;
    ctx.fillRect(stern + 1, -B / 2 + 1, L * 0.2, B - 2);
  }

  if (gunports) {
    // One dark port per gun a side, along the middle 70 % of the hull, never closer than 2 px.
    const span = L * 0.7;
    const ports = Math.min(cls.guns / 2, Math.floor(span / 2) + 1);
    ctx.fillStyle = GUNPORT_COLOR;
    for (let i = 0; i < ports; i++) {
      const x = ports === 1 ? 0 : -span / 2 + (span * i) / (ports - 1) - BOWSPRIT_PX / 2;
      ctx.fillRect(x - 0.5, -B / 2, 1, 1);
      ctx.fillRect(x - 0.5, B / 2 - 1, 1, 1);
    }
  }

  if (rig === 'furled') {
    ctx.fillStyle = SHIP_COLORS.mast;
    for (const x of g.masts) ctx.fillRect(x - 0.75, -0.75, 1.5, 1.5);
    if (cls.masts === 1) ctx.fillRect(g.sails[0]!.x0, -0.5, g.masts[0]! - g.sails[0]!.x0, 1); // boom
    return;
  }
  g.sails.forEach((r, i) => {
    if (rig === 'oneSail' && i !== g.mainSail) return;
    ctx.fillStyle = sail;
    ctx.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    ctx.fillStyle = shade;
    if (cls.masts === 1) ctx.fillRect(r.x0, 0.5, r.x1 - r.x0, 1);
    else ctx.fillRect(r.x0, r.y0, 1, r.y1 - r.y0);
  });
  if (cls.masts === 1 && rig === 'set') {
    const mast = g.masts[0]!;
    ctx.fillStyle = sail;
    ctx.beginPath(); // jib
    ctx.moveTo(mast + 1, -1.2);
    ctx.lineTo(bow + BOWSPRIT_PX, 0);
    ctx.lineTo(mast + 1, 1.2);
    ctx.closePath();
    ctx.fill();
  }
}

function renderSprite(
  cls: ShipClass,
  dims: ShipDims,
  sail: string,
  headingRad: number,
  rig: RigState,
  gunports: boolean,
): HTMLCanvasElement {
  const size = spriteSizeFor(dims.lengthPx);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is not available');
  ctx.translate(size / 2, size / 2);
  ctx.rotate(headingRad);
  drawShip(ctx, cls, dims, sail, rig, gunports);
  const image = ctx.getImageData(0, 0, size, size);
  const palette = [
    SHIP_COLORS.hull,
    SHIP_COLORS.deck,
    SHIP_COLORS.mast,
    STERNCASTLE_COLOR,
    GUNPORT_COLOR,
    sail,
    shadeHex(sail, SAIL_SHADE),
  ].map(hexToRgb);
  quantiseAndOutline(image.data, size, size, palette, hexToRgb(SPRITE_OUTLINE));
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function headings(render: (headingRad: number) => HTMLCanvasElement): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let i = 0; i < SHIP_HEADINGS; i++) out.push(render((i / SHIP_HEADINGS) * TAU));
  return out;
}

/** Generate 32 headings × {set, furled} world-scale sprites for one class and sail colour. */
export function createShipSprites(cls: ShipClass, sail: string): ShipSprites {
  const dims = worldDims(cls);
  return {
    size: spriteSizeFor(dims.lengthPx),
    set: headings((h) => renderSprite(cls, dims, sail, h, 'set', false)),
    furled: headings((h) => renderSprite(cls, dims, sail, h, 'furled', false)),
  };
}

/** Combat sprites: 32 headings with all sails, with only the main sail, and furled. */
export interface CombatSprites extends ShipSprites {
  readonly oneSail: readonly HTMLCanvasElement[];
}

/**
 * Generate combat-size sprites (spec §10.1) with gunports. A struck ship uses the furled set;
 * its flag, the white square that replaces it and the holes in damaged sails are drawn at
 * runtime.
 */
export function createCombatSprites(cls: ShipClass, sail: string): CombatSprites {
  const dims = combatDims(cls);
  return {
    size: spriteSizeFor(dims.lengthPx),
    set: headings((h) => renderSprite(cls, dims, sail, h, 'set', true)),
    oneSail: headings((h) => renderSprite(cls, dims, sail, h, 'oneSail', true)),
    furled: headings((h) => renderSprite(cls, dims, sail, h, 'furled', true)),
  };
}

/** Sprites per class and sail colour, generated the first time each look is needed. */
export class ShipSpriteCache {
  private readonly sprites = new Map<string, ShipSprites>();
  private readonly combat = new Map<string, CombatSprites>();

  get(classId: ShipClassId, sail: string): ShipSprites {
    const key = `${classId}|${sail}`;
    let found = this.sprites.get(key);
    if (!found) {
      found = createShipSprites(SHIP_CLASSES[classId], sail);
      this.sprites.set(key, found);
    }
    return found;
  }

  getCombat(classId: ShipClassId, sail: string): CombatSprites {
    const key = `${classId}|${sail}`;
    let found = this.combat.get(key);
    if (!found) {
      found = createCombatSprites(SHIP_CLASSES[classId], sail);
      this.combat.set(key, found);
    }
    return found;
  }
}

/**
 * Where the holes in a damaged ship's sails are (spec §10.1: 2–4 holes below 60 % rigging),
 * in the ship's frame and seeded per ship, so they stay put for the whole fight.
 */
export function sailHoles(
  cls: ShipClass,
  dims: ShipDims,
  seed: number,
): { x: number; y: number }[] {
  const rng = createRng(seed);
  const sails = shipGeometry(cls, dims).sails;
  const count = 2 + Math.floor(rng() * 3);
  const holes: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const r = sails[Math.floor(rng() * sails.length)]!;
    holes.push({
      x: r.x0 + 0.5 + rng() * Math.max(0, r.x1 - r.x0 - 1),
      y: r.y0 + 0.5 + rng() * Math.max(0, r.y1 - r.y0 - 1),
    });
  }
  return holes;
}
