#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
APP_DIR=${SCRIPT_DIR:h}
LOG_DIR=${MISSION_CONTROL_LOG_DIR:-$APP_DIR/logs}
STDOUT_LOG=${MISSION_CONTROL_OUT_LOG:-$LOG_DIR/mission-control.out.log}
STDERR_LOG=${MISSION_CONTROL_ERR_LOG:-$LOG_DIR/mission-control.err.log}

if [[ -f "$STDOUT_LOG" ]]; then
  echo "==> $STDOUT_LOG <=="
  tail -n 50 "$STDOUT_LOG"
fi

if [[ -f "$STDERR_LOG" ]]; then
  echo "==> $STDERR_LOG <=="
  tail -n 50 "$STDERR_LOG"
fi
