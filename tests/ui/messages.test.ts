// SPDX-License-Identifier: GPL-3.0-only
import { describe, expect, it } from 'vitest';
import { MESSAGE_SEC, MessageTimer } from '../../src/ui/messageTimer';

describe('MessageTimer', () => {
  it('shows a message for 3 s', () => {
    const t = new MessageTimer();
    expect(t.show('Breakers ahead!', 10)).toBe(true);
    expect(t.isVisible(10 + MESSAGE_SEC - 0.01)).toBe(true);
    expect(t.isVisible(10 + MESSAGE_SEC)).toBe(false);
  });

  it('rate-limits repeats of the showing message', () => {
    const t = new MessageTimer();
    t.show('Breakers ahead!', 0);
    expect(t.show('Breakers ahead!', 1)).toBe(false);
    expect(t.isVisible(3.5)).toBe(false);
    expect(t.show('Breakers ahead!', 3.5)).toBe(true);
  });

  it('replaces the message with a different one at once', () => {
    const t = new MessageTimer();
    t.show('A', 0);
    expect(t.show('B', 1)).toBe(true);
    expect(t.current).toBe('B');
    expect(t.isVisible(3.9)).toBe(true);
  });
});
