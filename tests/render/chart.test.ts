// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { chartLayout } from '../../src/render/chart';

describe('chartLayout', () => {
  it('fits the world inside the margins and centres it', () => {
    const l = chartLayout(1000, 800, 20, 1560, 920);
    expect(l.mapW).toBeLessThanOrEqual(960 + 1e-9);
    expect(l.mapH).toBeLessThanOrEqual(760 + 1e-9);
    expect(l.mapW / l.mapH).toBeCloseTo(1560 / 920);
    expect(l.ox).toBeCloseTo((1000 - l.mapW) / 2);
    expect(l.oy).toBeCloseTo((800 - l.mapH) / 2);
  });

  it('is limited by height on tall screens', () => {
    const l = chartLayout(400, 900, 10, 1560, 920);
    expect(l.mapW).toBeCloseTo(380);
    expect(l.oy).toBeGreaterThan(10);
  });

  it('never goes negative', () => {
    expect(chartLayout(10, 10, 20, 1560, 920).scale).toBe(0);
  });
});
