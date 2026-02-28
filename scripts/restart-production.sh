#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}

"$SCRIPT_DIR/stop-production.sh"
"$SCRIPT_DIR/start-production-bg.sh"
