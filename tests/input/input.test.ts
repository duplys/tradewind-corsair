// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { Input } from '../../src/input/input';

describe('Input', () => {
  it('merges held actions across sources on refresh', () => {
    const input = new Input();
    input.source('keyboard').turnLeft = true;
    expect(input.held.turnLeft).toBe(false);
    input.refresh();
    expect(input.held.turnLeft).toBe(true);
    input.source('touch').turnLeft = true;
    input.clearSource('keyboard');
    input.refresh();
    expect(input.held.turnLeft).toBe(true);
    input.clearSource('touch');
    input.refresh();
    expect(input.held.turnLeft).toBe(false);
  });

  it('queues one-shot presses in order', () => {
    const input = new Input();
    input.press('hoist');
    input.press('reef');
    expect(input.poll()).toBe('hoist');
    expect(input.poll()).toBe('reef');
    expect(input.poll()).toBeUndefined();
  });
});
