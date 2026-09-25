// SPDX-License-Identifier: GPL-3.0-only
import type { Action } from './actions';
import type { Input } from './input';

/** Key bindings (slice 1 spec §9.5). WASD match by physical position, M and Esc by key. */
function actionForKey(e: KeyboardEvent): Action | null {
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      return 'turnLeft';
    case 'ArrowRight':
    case 'KeyD':
      return 'turnRight';
    case 'ArrowUp':
    case 'KeyW':
      return 'hoist';
    case 'ArrowDown':
    case 'KeyS':
      return 'reef';
    case 'Enter':
    case 'NumpadEnter':
    case 'Space':
      return 'confirm';
  }
  if (e.key === 'Escape') return 'close';
  if (import.meta.env.DEV && e.code === 'KeyK') return 'debugDamage';
  if (e.key === 'm' || e.key === 'M') return 'chart';
  return null;
}

function isActivatingControl(target: EventTarget | null, action: Action): boolean {
  // Let Enter and Space press buttons normally instead of steering the ship.
  return action === 'confirm' && target instanceof HTMLButtonElement;
}

/** Keyboard → held actions plus one-shot presses (auto-repeat ignored), written into Input. */
export class KeyboardInput {
  private readonly held;

  constructor(private readonly input: Input) {
    this.held = input.source('keyboard');
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = actionForKey(e);
    if (!action || isActivatingControl(e.target, action)) return;
    e.preventDefault();
    this.held[action] = true;
    if (!e.repeat) this.input.press(action);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const action = actionForKey(e);
    if (action) this.held[action] = false;
  };

  private readonly onBlur = (): void => this.clear();

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.clear();
  };

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  clear(): void {
    this.input.clearSource('keyboard');
    this.input.clearQueue();
  }
}
