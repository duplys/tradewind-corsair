// SPDX-License-Identifier: GPL-3.0-only

export interface CameraOffset {
  /** World px of the view's top-left corner. Negative when the world is centred in a larger view. */
  readonly x: number;
  readonly y: number;
}

function axis(focus: number, view: number, world: number): number {
  if (view >= world) return -Math.floor((view - world) / 2);
  return Math.min(Math.max(Math.round(focus - view / 2), 0), world - view);
}

/**
 * Camera centred on a focus point and clamped to the world bounds, with integer offsets so the
 * map does not shimmer (slice 1 spec §8.2).
 */
export function computeCamera(
  focusX: number,
  focusY: number,
  viewW: number,
  viewH: number,
  worldW: number,
  worldH: number,
): CameraOffset {
  return { x: axis(focusX, viewW, worldW), y: axis(focusY, viewH, worldH) };
}
