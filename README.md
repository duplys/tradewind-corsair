# Tradewind Corsair

A browser game about privateering in the 17th-century Caribbean. It is an open-world
sandbox built from small, tight mini-games (sailing, ship combat, duels, towns and
trade) tied together by a simple world simulation. The game is single-player, runs
entirely in the browser and saves to the player's browser. There is no backend.

The project is in early development. Work proceeds in slices; see `docs/specs/`.

## What you can do so far

- **Sail the Caribbean** (slice 1): a pixel-art map of real coastlines and 21 ports of four
  nations. Wind is everything: sail across it for speed, and tack when you must go upwind.
- **Meet other ships** (slice 2): merchantmen, warships and pirates sail between the ports.
  Spanish warships and pirates hunt you (you sail under an English letter of marque), and
  Spanish merchantmen run.
- **Fight at sea:** close with a ship and attack, or try to run when caught. In battle the
  point of sail, the angle of your broadside and your crew's reloading decide the fight.
  Ships sink, strike their colours, board each other or escape over the horizon.
- **Take prizes:** plunder and recruits, and you can take a captured ship as your own.
  Defeat puts you ashore in a small sloop. Repair at any friendly shipwright.

## Requirements

- Node.js 22 LTS (22.13 or newer) or 24+
- npm

## Running locally

```bash
npm install
npm run dev        # Vite dev server with HMR
```

Other scripts:

| Script                 | What it does                                         |
| ---------------------- | ---------------------------------------------------- |
| `npm run build`        | Type-check, then build static files into `dist/`     |
| `npm run preview`      | Serve `dist/` locally                                |
| `npm test`             | Run the unit tests once (Vitest)                     |
| `npm run test:watch`   | Run the tests in watch mode                          |
| `npm run lint`         | ESLint                                               |
| `npm run format`       | Prettier                                             |
| `npm run check`        | Lint, type-check and test (run before committing)    |
| `npm run test:balance` | Slow combat balance tests (about 20 s; CI runs them) |
| `npm run sim:balance`  | Print the AI-against-AI combat balance table         |

## Controls

| Action                              | Keyboard       | Touch (phones and tablets) |
| ----------------------------------- | -------------- | -------------------------- |
| Turn to port                        | ← or A (hold)  | ◀ (hold)                   |
| Turn to starboard                   | → or D (hold)  | ▶ (hold)                   |
| Hoist (more sail)                   | ↑ or W         | Hoist                      |
| Reef (less sail)                    | ↓ or S         | Reef                       |
| Drop anchor, close with a ship      | Enter or Space | The button at the bottom   |
| Chart                               | M (Esc closes) | Chart button               |
| In combat: fire port, starboard     | Q, E           | —                          |
| In combat: fire the side that bears | Space or Enter | Fire                       |
| In combat: pause                    | P or Esc       | ‖                          |

Development builds also take **K** to damage your own ship (for testing the HUD and the
shipwright).

The voyage is saved in the browser (localStorage) when you dock, when you leave port,
every 30 seconds at sea, when you switch tabs, just before a fight and after it. It is
never saved during a fight, so closing the page mid-battle brings you back to just before
the encounter. Choose **Continue voyage** on the title screen to pick it up again. Saves
from before slice 2 are upgraded automatically.

Sail across the wind for the best speed. The red wedge on the compass marks the wind's
eye, where the ship stops.

## Project layout

- `src/sim/`: pure, deterministic simulation (no DOM, no wall clock, seeded randomness):
  the world, sailing, ship condition, NPC ships and navigation, and combat with its AI
- `src/game/`: game loop and mode state machine
- `src/render/`, `src/ui/`, `src/input/`, `src/persist/`: presentation, DOM overlays,
  input mapping and save/load
- `src/data/`: static tables and tuning constants
- `tests/`: unit tests mirroring `src/`; `tests/balance/` holds the slow balance tests
- `scripts/`: headless tools, such as the combat balance harness
- `docs/specs/`: slice specifications. `docs/decisions/`: architecture decision records
- `deploy/`: Caddyfile example and deploy script

See `CLAUDE.md` for the architecture rules and conventions.

## Deploying

The build is fully static: `dist/` holds `index.html`, `favicon.svg` and hashed files in
`assets/`. There is no server-side code, no database and no cookies.

### One-time server setup (Caddy on the VPS)

1. Create the web root and give the deploy user write access:
   ```bash
   sudo mkdir -p /var/www/tradewind
   sudo chown deploy:deploy /var/www/tradewind
   ```
2. Add the site block from [`deploy/Caddyfile`](deploy/Caddyfile) to
   `/etc/caddy/Caddyfile`, with your real domain instead of `tradewind.example.org`. Point
   the domain's DNS at the server first; Caddy gets the HTTPS certificate on its own.
3. Check and reload Caddy:
   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

### Each deploy

```bash
DEPLOY_TARGET=deploy@your-host:/var/www/tradewind/ deploy/deploy.sh
```

The script runs `npm run build` and then `rsync -avz --delete dist/ "$DEPLOY_TARGET"`. It
stops with an error if `DEPLOY_TARGET` is not set. Keep the trailing slash on the target.
`--delete` removes the previous build's asset files, which is safe because `index.html` is
served with `Cache-Control: no-cache` and always points at the new ones.

### After deploying

Open the site in a private window. The title screen should appear within about two
seconds, with no errors in the browser console. Sail a little, reload, and check that
**Continue voyage** appears.

## License

Tradewind Corsair is free software, licensed under the GNU General Public License,
version 3 only (`GPL-3.0-only`). See [`LICENSE`](LICENSE) for the full text. Every
source file carries the header `SPDX-License-Identifier: GPL-3.0-only`.

Third-party assets (such as the fonts) keep their own licenses. They are listed in
[`THIRD_PARTY.md`](THIRD_PARTY.md).
