// SPDX-License-Identifier: GPL-3.0-only
// Ship classes (slice 1 spec §6.1). Only the sloop exists in this slice.

export interface ShipClass {
  readonly id: 'sloop';
  readonly name: string;
  readonly guns: number;
  readonly maxSpeedKn: number;
  /** Turn rate at full way, in radians per second. */
  readonly turnRateRadPerSec: number;
  /** Fraction of the gap to target speed closed per second. */
  readonly accelPerSec: number;
  /** [relDeg, factor]: relDeg is the angle between heading and the wind's toward direction. */
  readonly polar: readonly (readonly [relDeg: number, factor: number])[];
}

export type ShipClassId = ShipClass['id'];

export const SHIP_CLASSES: Readonly<Record<ShipClassId, ShipClass>> = {
  sloop: {
    id: 'sloop',
    name: 'Sloop',
    guns: 8,
    maxSpeedKn: 9,
    turnRateRadPerSec: 1.6,
    accelPerSec: 0.7,
    polar: [
      [0, 0.72],
      [30, 0.78],
      [60, 0.9],
      [90, 1.0],
      [120, 0.86],
      [135, 0.6],
      [150, 0.18],
      [180, 0.05],
    ],
  },
};
