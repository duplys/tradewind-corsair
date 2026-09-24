#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Build the game and sync dist/ to the web root given in DEPLOY_TARGET,
# for example: DEPLOY_TARGET=deploy@host:/var/www/tradewind/ deploy/deploy.sh
set -euo pipefail

if [[ -z "${DEPLOY_TARGET:-}" ]]; then
  echo "error: DEPLOY_TARGET is not set." >&2
  echo "Set it to an rsync destination, e.g. DEPLOY_TARGET=user@host:/var/www/tradewind/" >&2
  exit 1
fi

cd "$(dirname "$0")/.."
npm run build
rsync -avz --delete dist/ "$DEPLOY_TARGET"
