// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import type { Action } from './actions';
import type { Input } from './input';

/** True on phones and tablets, where on-screen controls are shown (slice 1 spec §9.4). */
export function wantsTouchControls(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

function makeButton(text: string, label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `touch-button ${className}`;
  button.textContent = text;
  button.setAttribute('aria-label', label);
  return button;
}

/**
 * On-screen controls: hold-to-turn buttons bottom-left, Reef and Hoist bottom-right. Holds use
 * pointer capture and release on up, cancel, lost capture, or when the finger slides off.
 */
export class TouchControls {
  private readonly root = document.createElement('div');
  private readonly held;

  constructor(private readonly input: Input) {
    this.held = input.source('touch');
    this.root.className = 'touch-controls';
    this.root.hidden = true;

    const turn = document.createElement('div');
    turn.className = 'touch-group touch-turn';
    turn.append(
      this.holdButton(STRINGS.touch.port, STRINGS.touch.portLabel, 'turnLeft'),
      this.holdButton(STRINGS.touch.starboard, STRINGS.touch.starboardLabel, 'turnRight'),
    );
    const sail = document.createElement('div');
    sail.className = 'touch-group touch-sail';
    sail.append(
      this.tapButton(STRINGS.touch.reef, STRINGS.touch.reefLabel, 'reef'),
      this.tapButton(STRINGS.touch.hoist, STRINGS.touch.hoistLabel, 'hoist'),
    );
    this.root.append(turn, sail);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  attach(parent: HTMLElement): void {
    parent.append(this.root);
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
    this.input.clearSource('touch');
  }

  private holdButton(text: string, label: string, action: Action): HTMLButtonElement {
    const button = makeButton(text, label, 'touch-hold');
    let pointerId: number | null = null;
    const release = (): void => {
      if (pointerId !== null && button.hasPointerCapture(pointerId)) {
        button.releasePointerCapture(pointerId);
      }
      pointerId = null;
      this.held[action] = false;
      button.classList.remove('is-held');
    };
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pointerId = e.pointerId;
      button.setPointerCapture(e.pointerId);
      this.held[action] = true;
      button.classList.add('is-held');
    });
    button.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pointerId) return;
      const r = button.getBoundingClientRect();
      const inside =
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) release();
    });
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    return button;
  }

  private tapButton(text: string, label: string, action: Action): HTMLButtonElement {
    const button = makeButton(text, label, 'touch-tap');
    button.addEventListener('click', () => this.input.press(action));
    return button;
  }
}
