// SPDX-License-Identifier: GPL-3.0-only
// Ship classes (slice 2 spec §3.1). All balance numbers live in this one table.

export type ShipClassId = 'sloop' | 'brigantine' | 'fluyt' | 'frigate' | 'galleon';

export interface ShipClass {
  readonly id: ShipClassId;
  readonly name: string;
  readonly masts: 1 | 2 | 3;
  /** Combat sprite hull length and width, in combat px. */
  readonly lengthPx: number;
  readonly beamPx: number;
  /** World-map sprite hull length, in world px. */
  readonly worldLengthPx: number;
  readonly maxSpeedKn: number;
  /** Turn rate at full way, in radians per second. */
  readonly turnRateRadPerSec: number;
  /** Fraction of the gap to target speed closed per second. */
  readonly accelPerSec: number;
  /** Hit points of the hull at 100 %. */
  readonly hullStrength: number;
  /** Total guns, split evenly per side. */
  readonly guns: number;
  readonly crewMax: number;
  /** Crew needed to fight and sail at full efficiency. */
  readonly crewTypical: number;
  /** Base plunder in gold. */
  readonly cargoValue: number;
  /** [relDeg, factor]: relDeg is the angle between heading and the wind's toward direction. */
  readonly polar: readonly (readonly [relDeg: number, factor: number])[];
}

/** The polar's relDeg rows, shared by every class. */
const POLAR_DEG = [0, 30, 60, 90, 120, 135, 150, 180] as const;

function polar(...factors: readonly number[]): ShipClass['polar'] {
  return POLAR_DEG.map((deg, i) => [deg, factors[i]!] as const);
}

export const SHIP_CLASSES: Readonly<Record<ShipClassId, ShipClass>> = {
  sloop: {
    id: 'sloop',
    name: 'Sloop',
    masts: 1,
    lengthPx: 22,
    beamPx: 8,
    worldLengthPx: 16,
    maxSpeedKn: 9,
    turnRateRadPerSec: 1.6,
    accelPerSec: 0.7,
    hullStrength: 60,
    guns: 8,
    crewMax: 60,
    crewTypical: 40,
    cargoValue: 300,
    polar: polar(0.72, 0.78, 0.9, 1.0, 0.86, 0.6, 0.18, 0.05),
  },
  brigantine: {
    id: 'brigantine',
    name: 'Brigantine',
    masts: 2,
    lengthPx: 26,
    beamPx: 9,
    worldLengthPx: 18,
    maxSpeedKn: 8.5,
    turnRateRadPerSec: 1.2,
    accelPerSec: 0.6,
    hullStrength: 90,
    guns: 14,
    crewMax: 100,
    crewTypical: 60,
    cargoValue: 800,
    polar: polar(0.8, 0.84, 0.92, 1.0, 0.78, 0.45, 0.12, 0.05),
  },
  fluyt: {
    id: 'fluyt',
    name: 'Fluyt',
    masts: 3,
    lengthPx: 28,
    beamPx: 10,
    worldLengthPx: 20,
    maxSpeedKn: 7,
    turnRateRadPerSec: 0.9,
    accelPerSec: 0.45,
    hullStrength: 110,
    guns: 10,
    crewMax: 60,
    crewTypical: 30,
    cargoValue: 2500,
    polar: polar(0.9, 0.92, 0.95, 0.9, 0.6, 0.3, 0.08, 0.04),
  },
  frigate: {
    id: 'frigate',
    name: 'Frigate',
    masts: 3,
    lengthPx: 32,
    beamPx: 11,
    worldLengthPx: 21,
    maxSpeedKn: 8,
    turnRateRadPerSec: 1.0,
    accelPerSec: 0.5,
    hullStrength: 160,
    guns: 28,
    crewMax: 220,
    crewTypical: 150,
    cargoValue: 1200,
    polar: polar(0.9, 0.95, 1.0, 0.95, 0.65, 0.35, 0.1, 0.04),
  },
  galleon: {
    id: 'galleon',
    name: 'Galleon',
    masts: 3,
    lengthPx: 36,
    beamPx: 13,
    worldLengthPx: 23,
    maxSpeedKn: 6.5,
    turnRateRadPerSec: 0.7,
    accelPerSec: 0.35,
    hullStrength: 220,
    guns: 36,
    crewMax: 300,
    crewTypical: 200,
    cargoValue: 6000,
    polar: polar(1.0, 0.98, 0.9, 0.8, 0.5, 0.25, 0.07, 0.03),
  },
};

export const SHIP_CLASS_IDS = Object.keys(SHIP_CLASSES) as ShipClassId[];
