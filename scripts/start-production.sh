#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
APP_DIR=${SCRIPT_DIR:h}

cd "$APP_DIR"
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3270}
export PATH="$(dirname "$(command -v node)"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

exec node server.js
