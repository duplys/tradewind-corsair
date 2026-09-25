// SPDX-License-Identifier: GPL-3.0-only
import { NATIONS } from '../data/nations';
import { hostileToPlayer } from '../data/relations';
import { SHIP_CLASSES } from '../data/ships';
import { STRINGS } from '../data/strings';
import type { NpcShip } from '../sim/npc/npc';
import type { PlayerShip } from '../sim/sailing/ship';
import type { Port } from '../sim/world/ports';
import type { World } from '../sim/world/world';
import { computeCamera, type CameraOffset } from './camera';
import type { NpcFade } from './effects/npcFade';
import { drawSparkles } from './effects/sparkles';
import { drawPennant, PLAYER_PENNANT, type Wake } from './effects/wake';
import type { LabelLayer, NpcLabel } from './labels';
import { drawFlags } from './map/flags';
import { drawMapSlice } from './map/drawMap';
import type { ReducedMotion } from './motion';
import { DEEP_SEA, NPC_SAIL_COLORS, PIRATE_PENNANT, SHIP_COLORS } from './palette';
import { spriteIndex, type ShipSpriteCache, type ShipSprites } from './sprites/ship';
import type { View } from './view';

/** NPC labels show within this distance of the player (slice 2 spec §4.5). */
const NPC_LABEL_RANGE_PX = 50;

/** Everything needed to draw the sea around the ship. Shared by the sailing and port modes. */
export interface SeaScene {
  readonly world: World;
  readonly map: HTMLCanvasElement;
  readonly sprites: ShipSpriteCache;
  readonly ports: readonly Port[];
  readonly view: View;
  readonly labels: LabelLayer;
  readonly reducedMotion: ReducedMotion;
  /** Reused every frame for the NPC labels, so drawing allocates no arrays. */
  readonly npcLabels: NpcLabel[];
}

/** Other ships to draw, and how to fade them in and out. */
export interface SeaTraffic {
  readonly npcs: readonly NpcShip[];
  readonly fade: NpcFade | null;
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  cam: CameraOffset,
  sprites: ShipSprites,
  ship: { x: number; y: number; headingRad: number; sail: string },
): void {
  const frames = ship.sail === 'furled' ? sprites.furled : sprites.set;
  const half = sprites.size / 2;
  ctx.drawImage(
    frames[spriteIndex(ship.headingRad)]!,
    Math.round(ship.x) - cam.x - half,
    Math.round(ship.y) - cam.y - half,
  );
}

function npcPennant(npc: NpcShip): readonly [string, string] {
  if (npc.nation === 'pirate') return PIRATE_PENNANT;
  const color = NATIONS[npc.nation].color;
  return [color, color];
}

function npcLabelText(npc: NpcShip): string {
  const adjective = npc.nation === 'pirate' ? STRINGS.npc.pirate : NATIONS[npc.nation].adjective;
  return STRINGS.npc.label(adjective, SHIP_CLASSES[npc.classId].name.toLowerCase());
}

/**
 * Draw map, sparkles, wake, flags, other ships, the player's ship and labels, centred on the
 * player (slice 1 spec §8.3, slice 2 spec §4.5). Under prefers-reduced-motion the sparkles are
 * off and flags and pennants hold still.
 */
export function drawSeaScene(
  scene: SeaScene,
  ship: PlayerShip,
  timeSec: number,
  windTowardRad: number,
  wake: Wake | null,
  traffic: SeaTraffic | null,
): CameraOffset {
  const reduced = scene.reducedMotion();
  const decorTimeSec = reduced ? 0 : timeSec;
  const { ctx } = scene.view;
  const { world } = scene;
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
  drawMapSlice(ctx, scene.map, cam);
  if (!reduced) drawSparkles(ctx, cam, world, timeSec, windTowardRad);
  wake?.draw(ctx, cam, timeSec);
  drawFlags(ctx, cam, scene.ports, decorTimeSec);

  const labels = scene.npcLabels;
  labels.length = 0;
  if (traffic) {
    const drawNpc = (npc: NpcShip, alpha: number): void => {
      const cls = SHIP_CLASSES[npc.classId];
      const sprites = scene.sprites.get(npc.classId, NPC_SAIL_COLORS[npc.role]);
      const margin = sprites.size;
      const sx = npc.ship.x - cam.x;
      const sy = npc.ship.y - cam.y;
      if (sx < -margin || sy < -margin || sx > ctx.canvas.width + margin) return;
      if (sy > ctx.canvas.height + margin) return;
      ctx.globalAlpha = alpha;
      drawSprite(ctx, cam, sprites, npc.ship);
      drawPennant(ctx, cam, npc.ship, cls.worldLengthPx / 2, npcPennant(npc), decorTimeSec);
      ctx.globalAlpha = 1;
      if (Math.hypot(npc.ship.x - ship.x, npc.ship.y - ship.y) <= NPC_LABEL_RANGE_PX) {
        labels.push({
          x: npc.ship.x,
          y: npc.ship.y + sprites.size / 2 - 3,
          text: npcLabelText(npc),
          hostile: hostileToPlayer(npc.nation),
          alpha,
        });
      }
    };
    for (const npc of traffic.npcs) drawNpc(npc, traffic.fade?.alpha(npc.id, timeSec) ?? 1);
    traffic.fade?.fadingOut(timeSec, drawNpc);
  }

  const cls = SHIP_CLASSES[ship.classId];
  drawSprite(ctx, cam, scene.sprites.get(ship.classId, SHIP_COLORS.sail), ship);
  drawPennant(ctx, cam, ship, cls.worldLengthPx / 2, PLAYER_PENNANT, decorTimeSec);

  scene.labels.draw(cam, scene.view.scale, scene.ports, labels);
  return cam;
}
