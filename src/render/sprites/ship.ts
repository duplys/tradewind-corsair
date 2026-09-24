// SPDX-License-Identifier: GPL-3.0-only
import { TAU } from '../../sim/math';
import { SHIP_COLORS, SPRITE_OUTLINE, hexToRgb } from '../palette';
import { quantiseAndOutline } from './pixelArt';

export const SHIP_SPRITE_SIZE = 26;
export const SHIP_HEADINGS = 32;

export interface ShipSprites {
  /** Indexed by heading index; `set` is used for half and full sail. */
  readonly set: readonly HTMLCanvasElement[];
  readonly furled: readonly HTMLCanvasElement[];
}

/** Sprite index for a heading: round(heading / 2π · 32) mod 32. */
export function spriteIndex(headingRad: number): number {
  const i = Math.round((headingRad / TAU) * SHIP_HEADINGS) % SHIP_HEADINGS;
  return (i + SHIP_HEADINGS) % SHIP_HEADINGS;
}

/** Draw the sloop pointing along +x, centred on the origin. */
function drawSloop(ctx: CanvasRenderingContext2D, sailsSet: boolean): void {
  // Hull: pointed bow, about 16 px long and 6 px wide, shifted aft to make room for the bowsprit.
  ctx.fillStyle = SHIP_COLORS.hull;
  ctx.beginPath();
  ctx.moveTo(-9.5, -3);
  ctx.lineTo(2.5, -3);
  ctx.lineTo(6.5, 0);
  ctx.lineTo(2.5, 3);
  ctx.lineTo(-9.5, 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(6, -0.5, 3.5, 1); // bowsprit

  ctx.fillStyle = SHIP_COLORS.deck;
  ctx.beginPath();
  ctx.moveTo(-8.5, -2);
  ctx.lineTo(2, -2);
  ctx.lineTo(4.5, 0);
  ctx.lineTo(2, 2);
  ctx.lineTo(-8.5, 2);
  ctx.closePath();
  ctx.fill();

  if (sailsSet) {
    // Two square sails across the beam, about 2 px deep, 10 px and 8 px wide.
    ctx.fillStyle = SHIP_COLORS.sail;
    ctx.fillRect(-5, -5, 2, 10);
    ctx.fillRect(0, -4, 2, 8);
    ctx.fillStyle = SHIP_COLORS.sailShade;
    ctx.fillRect(-5, -5, 1, 10);
    ctx.fillRect(0, -4, 1, 8);
  } else {
    ctx.fillStyle = SHIP_COLORS.mast;
    ctx.fillRect(-4.5, -0.5, 1.5, 1.5);
    ctx.fillRect(0.5, -0.5, 1.5, 1.5);
  }
}

function renderSprite(headingRad: number, sailsSet: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SHIP_SPRITE_SIZE;
  canvas.height = SHIP_SPRITE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context is not available');
  ctx.translate(SHIP_SPRITE_SIZE / 2, SHIP_SPRITE_SIZE / 2);
  ctx.rotate(headingRad);
  drawSloop(ctx, sailsSet);
  const image = ctx.getImageData(0, 0, SHIP_SPRITE_SIZE, SHIP_SPRITE_SIZE);
  quantiseAndOutline(
    image.data,
    SHIP_SPRITE_SIZE,
    SHIP_SPRITE_SIZE,
    Object.values(SHIP_COLORS).map(hexToRgb),
    hexToRgb(SPRITE_OUTLINE),
  );
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** Generate 32 headings × {set, furled} sloop sprites at load (spec §8.4). */
export function createShipSprites(): ShipSprites {
  const set: HTMLCanvasElement[] = [];
  const furled: HTMLCanvasElement[] = [];
  for (let i = 0; i < SHIP_HEADINGS; i++) {
    const heading = (i / SHIP_HEADINGS) * TAU;
    set.push(renderSprite(heading, true));
    furled.push(renderSprite(heading, false));
  }
  return { set, furled };
}
