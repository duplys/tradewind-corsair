// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { computeCamera } from '../../src/render/camera';
import { computeViewSize } from '../../src/render/view';

describe('computeCamera', () => {
  it('centres on the focus with integer offsets', () => {
    expect(computeCamera(500.4, 400.6, 200, 100, 1560, 920)).toEqual({ x: 400, y: 351 });
  });

  it('clamps to the world edges', () => {
    expect(computeCamera(5, 5, 200, 100, 1560, 920)).toEqual({ x: 0, y: 0 });
    expect(computeCamera(1559, 919, 200, 100, 1560, 920)).toEqual({ x: 1360, y: 820 });
  });

  it('centres the world when the view is larger on an axis', () => {
    expect(computeCamera(10, 10, 1600, 100, 1560, 920)).toEqual({ x: -20, y: 0 });
  });
});

describe('computeViewSize', () => {
  it('picks an integer scale between 2 and 5 from the short side', () => {
    expect(computeViewSize(1440, 900).scale).toBe(4);
    expect(computeViewSize(390, 844).scale).toBe(2);
    expect(computeViewSize(3840, 2160).scale).toBe(5);
  });

  it('covers the whole window', () => {
    const size = computeViewSize(1441, 901);
    expect(size.width * size.scale).toBeGreaterThanOrEqual(1441);
    expect(size.height * size.scale).toBeGreaterThanOrEqual(901);
  });
});
