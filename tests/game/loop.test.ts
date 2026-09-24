// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { MAX_FRAME_SECONDS, SIM_STEP_SECONDS } from '../../src/data/constants';
import { advance } from '../../src/game/loop';

describe('advance', () => {
  it('runs one step per fixed interval and carries the remainder', () => {
    const result = advance(0, SIM_STEP_SECONDS * 2.5);
    expect(result.steps).toBe(2);
    expect(result.accumulatorSec).toBeCloseTo(SIM_STEP_SECONDS * 0.5);
  });

  it('accumulates short frames until a step is due', () => {
    const first = advance(0, SIM_STEP_SECONDS * 0.6);
    expect(first.steps).toBe(0);
    const second = advance(first.accumulatorSec, SIM_STEP_SECONDS * 0.6);
    expect(second.steps).toBe(1);
  });

  it('clamps long frames to the maximum delta', () => {
    const result = advance(0, 10);
    expect(result.steps).toBe(Math.floor(MAX_FRAME_SECONDS / SIM_STEP_SECONDS + 1e-9));
    expect(result.accumulatorSec).toBeLessThan(SIM_STEP_SECONDS);
  });

  it('ignores negative deltas', () => {
    expect(advance(0, -1)).toEqual({ steps: 0, accumulatorSec: 0 });
  });
});
