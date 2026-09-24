// SPDX-License-Identifier: GPL-3.0-only
import { MAX_FRAME_SECONDS, SIM_STEP_SECONDS } from '../data/constants';

export interface LoopCallbacks {
  /** Advance the simulation by exactly one fixed step. */
  readonly step: (dtSec: number) => void;
  /** Draw the current state. Called once per animation frame. */
  readonly render: () => void;
}

export interface Loop {
  start(): void;
  stop(): void;
}

export interface AdvanceResult {
  readonly steps: number;
  readonly accumulatorSec: number;
}

/**
 * Pure accumulator logic: clamp the frame delta, then work out how many fixed steps to run
 * and what time is left over for the next frame.
 */
export function advance(accumulatorSec: number, frameDeltaSec: number): AdvanceResult {
  let acc = accumulatorSec + Math.min(Math.max(frameDeltaSec, 0), MAX_FRAME_SECONDS);
  let steps = 0;
  while (acc >= SIM_STEP_SECONDS) {
    acc -= SIM_STEP_SECONDS;
    steps++;
  }
  return { steps, accumulatorSec: acc };
}

/** Fixed-timestep simulation, variable-rate rendering, driven by requestAnimationFrame. */
export function createLoop({ step, render }: LoopCallbacks): Loop {
  let rafId: number | null = null;
  let lastMs = 0;
  let accumulatorSec = 0;

  const frame = (nowMs: number): void => {
    const result = advance(accumulatorSec, (nowMs - lastMs) / 1000);
    lastMs = nowMs;
    accumulatorSec = result.accumulatorSec;
    for (let i = 0; i < result.steps; i++) step(SIM_STEP_SECONDS);
    render();
    rafId = requestAnimationFrame(frame);
  };

  return {
    start() {
      if (rafId !== null) return;
      lastMs = performance.now();
      accumulatorSec = 0;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      if (rafId === null) return;
      cancelAnimationFrame(rafId);
      rafId = null;
    },
  };
}
