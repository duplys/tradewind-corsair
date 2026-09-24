// SPDX-License-Identifier: GPL-3.0-only
import './styles/main.css';
import { FONT_WAIT_TIMEOUT_MS } from './data/constants';
import { Game } from './game/game';
import { waitForFonts } from './ui/fonts';

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root element');
  await waitForFonts(FONT_WAIT_TIMEOUT_MS);
  const game = new Game();
  game.attach(root);
  game.start();
}

void boot();
