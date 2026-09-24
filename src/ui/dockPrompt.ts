// SPDX-License-Identifier: GPL-3.0-only
import { STRINGS } from '../data/strings';
import type { Port } from '../sim/world/ports';

/** "Drop anchor at …" button, bottom-centre, shown only near a port (slice 1 spec §4.2). */
export class DockPrompt {
  private readonly button = document.createElement('button');
  private portId: string | null = null;

  constructor(onDock: () => void) {
    this.button.type = 'button';
    this.button.className = 'dock-prompt';
    this.button.hidden = true;
    this.button.addEventListener('click', onDock);
  }

  attach(parent: HTMLElement): void {
    parent.append(this.button);
  }

  /** Show the prompt for a port, or hide it with null. Touches the DOM only on change. */
  setPort(port: Port | null): void {
    const id = port?.def.id ?? null;
    if (id === this.portId) return;
    this.portId = id;
    this.button.hidden = port === null;
    if (port) this.button.textContent = STRINGS.port.dropAnchor(port.def.name);
  }
}
