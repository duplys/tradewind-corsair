// SPDX-License-Identifier: GPL-3.0-only
import './styles/main.css';
import { FONT_WAIT_TIMEOUT_MS, MAP_SEED } from './data/constants';
import { PORTS } from './data/ports';
import { STRINGS } from './data/strings';
import { Game } from './game/game';
import { createMapCanvas } from './render/map/buildMap';
import { Navigator } from './sim/npc/navigator';
import { derivePorts } from './sim/world/ports';
import { buildWorld } from './sim/world/world';
import { waitForFonts } from './ui/fonts';

function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

async function boot(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root element');

  const loading = document.createElement('p');
  loading.className = 'loading';
  loading.textContent = STRINGS.loading;
  root.append(loading);

  await waitForFonts(FONT_WAIT_TIMEOUT_MS);
  await nextPaint();

  const world = buildWorld();
  const ports = derivePorts(world, PORTS);
  const map = createMapCanvas(world, ports, MAP_SEED);
  const navStarted = performance.now();
  const nav = new Navigator(world, ports);
  if (import.meta.env.DEV) {
    console.info(`Navigation grid built in ${Math.round(performance.now() - navStarted)} ms`);
  }
  const game = new Game(world, map, ports, nav);
  loading.remove();
  game.attach(root);
  game.start();
}

void boot();
