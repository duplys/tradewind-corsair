# Tradewind Corsair

A browser game about privateering in the 17th-century Caribbean. It is an open-world
sandbox built from small, tight mini-games (sailing, ship combat, duels, towns and
trade) tied together by a simple world simulation. The game is single-player, runs
entirely in the browser and saves to the player's browser. There is no backend.

The project is in early development. Work proceeds in slices; see `docs/specs/`.

## Requirements

- Node.js 22 LTS (22.13 or newer) or 24+
- npm

## Running locally

```bash
npm install
npm run dev        # Vite dev server with HMR
```

Other scripts:

| Script               | What it does                                      |
| -------------------- | ------------------------------------------------- |
| `npm run build`      | Type-check, then build static files into `dist/`  |
| `npm run preview`    | Serve `dist/` locally                             |
| `npm test`           | Run the unit tests once (Vitest)                  |
| `npm run test:watch` | Run the tests in watch mode                       |
| `npm run lint`       | ESLint                                            |
| `npm run format`     | Prettier                                          |
| `npm run check`      | Lint, type-check and test (run before committing) |

## Controls

| Action            | Keyboard      | Touch (phones and tablets) |
| ----------------- | ------------- | -------------------------- |
| Turn to port      | ← or A (hold) | ◀ (hold)                   |
| Turn to starboard | → or D (hold) | ▶ (hold)                   |
| Hoist (more sail) | ↑ or W        | Hoist                      |
| Reef (less sail)  | ↓ or S        | Reef                       |

The voyage is saved in the browser (localStorage) when you dock, when you leave port,
every 30 seconds at sea and when you switch tabs. Choose **Continue voyage** on the title
screen to pick it up again.

Sail across the wind for the best speed. The red wedge on the compass marks the wind's
eye, where the ship stops.

## Project layout

- `src/sim/`: pure, deterministic simulation (no DOM, no wall clock, seeded randomness)
- `src/game/`: game loop and mode state machine
- `src/render/`, `src/ui/`, `src/input/`, `src/persist/`: presentation, DOM overlays,
  input mapping and save/load
- `src/data/`: static tables and tuning constants
- `tests/`: unit tests mirroring `src/`
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
