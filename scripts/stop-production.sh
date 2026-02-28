#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
APP_DIR=${SCRIPT_DIR:h}
PID_FILE=${MISSION_CONTROL_PID_FILE:-$APP_DIR/mission-control.pid}

if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file found at $PID_FILE"
  exit 0
fi

PID=$(<"$PID_FILE")

if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"

  for _ in {1..20}; do
    if ! kill -0 "$PID" 2>/dev/null; then
      break
    fi
    sleep 0.25
  done

  if kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID"
  fi

  echo "Stopped Mission Control PID $PID"
else
  echo "PID $PID is not running"
fi

rm -f "$PID_FILE"
