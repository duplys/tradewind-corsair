// SPDX-License-Identifier: GPL-3.0-only
import { el } from './dom';

const SEGMENTS = 10;
/** Below these percentages the bar turns amber, then red. */
const LOW_PCT = 50;
const CRITICAL_PCT = 25;

/** A small segmented bar for hull or rigging, exposed to assistive technology as a meter. */
export class PixelBar {
  readonly el = el('span', 'pixel-bar');
  private readonly segments: HTMLSpanElement[] = [];
  private lastPct = NaN;

  constructor() {
    this.el.setAttribute('role', 'meter');
    this.el.setAttribute('aria-valuemin', '0');
    this.el.setAttribute('aria-valuemax', '100');
    for (let i = 0; i < SEGMENTS; i++) {
      const segment = el('span', 'pixel-bar-segment');
      this.segments.push(segment);
      this.el.append(segment);
    }
  }

  /** Show a whole-number percentage; `label` is the accessible name and tooltip. */
  set(pct: number, label: string): void {
    if (pct === this.lastPct) return;
    this.lastPct = pct;
    const filled = pct > 0 ? Math.max(1, Math.round((pct / 100) * SEGMENTS)) : 0;
    this.segments.forEach((segment, i) => segment.classList.toggle('is-filled', i < filled));
    this.el.classList.toggle('is-low', pct < LOW_PCT && pct >= CRITICAL_PCT);
    this.el.classList.toggle('is-critical', pct < CRITICAL_PCT);
    this.el.setAttribute('aria-valuenow', String(pct));
    this.el.setAttribute('aria-label', label);
    this.el.title = label;
  }
}
