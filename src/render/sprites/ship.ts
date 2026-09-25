// SPDX-License-Identifier: GPL-3.0-only
import { SHIP_CLASSES, type ShipClass, type ShipClassId } from '../../data/ships';
import { TAU } from '../../sim/math';
import { SHIP_COLORS, SPRITE_OUTLINE, STERNCASTLE_COLOR, hexToRgb, shadeHex } from '../palette';
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

/** Mast positions along the hull, as fractions of its length from the middle. */
const MAST_POSITIONS: Readonly<Record<1 | 2 | 3, readonly number[]>> = {
  1: [0.1],
  2: [-0.18, 0.14],
  3: [-0.28, -0.02, 0.22],
};

/**
 * Draw a ship pointing along +x, centred on the origin (slice 2 spec §4.5, §10.1): a pointed
 * hull with a bowsprit, a sterncastle on the fluyt and galleon, and its rig. The sloop has one
 * mast with a fore-and-aft mainsail and a jib; the others have square sails across the beam.
 */
function drawShip(
  ctx: CanvasRenderingContext2D,
  cls: ShipClass,
  sail: string,
  sailsSet: boolean,
): void {
  const L = cls.worldLengthPx;
  const B = worldBeamPx(cls);
  const shift = -BOWSPRIT_PX / 2; // make room for the bowsprit
  const stern = -L / 2 + shift;
  const bow = L / 2 + shift;
  const shoulder = bow - B * 0.7;
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

  const masts = MAST_POSITIONS[cls.masts].map((f) => f * L + shift);
  if (!sailsSet) {
    ctx.fillStyle = SHIP_COLORS.mast;
    for (const x of masts) ctx.fillRect(x - 0.75, -0.75, 1.5, 1.5);
    if (cls.masts === 1) ctx.fillRect(stern + L * 0.2, -0.5, masts[0]! - stern - L * 0.2, 1); // boom
    return;
  }
  if (cls.masts === 1) {
    const mast = masts[0]!;
    const boomEnd = stern + L * 0.2;
    ctx.fillStyle = sail;
    ctx.fillRect(boomEnd, -1.5, mast - boomEnd, 3); // mainsail along the centreline
    ctx.beginPath(); // jib
    ctx.moveTo(mast + 1, -1.2);
    ctx.lineTo(bow + BOWSPRIT_PX, 0);
    ctx.lineTo(mast + 1, 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.fillRect(boomEnd, 0.5, mast - boomEnd, 1);
    return;
  }
  const main = Math.floor(masts.length / 2);
  masts.forEach((x, i) => {
    const width = B + (i === main ? 4 : 2);
    ctx.fillStyle = sail;
    ctx.fillRect(x - 1, -width / 2, 2, width);
    ctx.fillStyle = shade;
    ctx.fillRect(x - 1, -width / 2, 1, width);
  });
}

function renderSprite(
  cls: ShipClass,
  sail: string,
  headingRad: number,
  sailsSet: boolean,
): HTMLCanvasElement {
  const size = spriteSizeFor(cls.worldLengthPx);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is not available');
  ctx.translate(size / 2, size / 2);
  ctx.rotate(headingRad);
  drawShip(ctx, cls, sail, sailsSet);
  const image = ctx.getImageData(0, 0, size, size);
  const palette = [
    SHIP_COLORS.hull,
    SHIP_COLORS.deck,
    SHIP_COLORS.mast,
    STERNCASTLE_COLOR,
    sail,
    shadeHex(sail, SAIL_SHADE),
  ].map(hexToRgb);
  quantiseAndOutline(image.data, size, size, palette, hexToRgb(SPRITE_OUTLINE));
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Generate 32 headings × {set, furled} world-scale sprites for one class and sail colour. */
export function createShipSprites(cls: ShipClass, sail: string): ShipSprites {
  const set: HTMLCanvasElement[] = [];
  const furled: HTMLCanvasElement[] = [];
  for (let i = 0; i < SHIP_HEADINGS; i++) {
    const heading = (i / SHIP_HEADINGS) * TAU;
    set.push(renderSprite(cls, sail, heading, true));
    furled.push(renderSprite(cls, sail, heading, false));
  }
  return { size: spriteSizeFor(cls.worldLengthPx), set, furled };
}

/** Sprites per class and sail colour, generated the first time each look is needed. */
export class ShipSpriteCache {
  private readonly sprites = new Map<string, ShipSprites>();

  get(classId: ShipClassId, sail: string): ShipSprites {
    const key = `${classId}|${sail}`;
    let found = this.sprites.get(key);
    if (!found) {
      found = createShipSprites(SHIP_CLASSES[classId], sail);
      this.sprites.set(key, found);
    }
    return found;
  }
}
