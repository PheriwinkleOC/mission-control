#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
APP_DIR=${SCRIPT_DIR:h}
PID_FILE=${MISSION_CONTROL_PID_FILE:-$APP_DIR/mission-control.pid}
LOG_DIR=${MISSION_CONTROL_LOG_DIR:-$APP_DIR/logs}
OUT_LOG=${MISSION_CONTROL_OUT_LOG:-$LOG_DIR/mission-control.out.log}
ERR_LOG=${MISSION_CONTROL_ERR_LOG:-$LOG_DIR/mission-control.err.log}

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID=$(<"$PID_FILE")
  if kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "Mission Control is already running with PID $EXISTING_PID"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

cd "$APP_DIR"
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3270}

nohup "$APP_DIR/scripts/start-production.sh" >>"$OUT_LOG" 2>>"$ERR_LOG" </dev/null &
NEW_PID=$!

sleep 1

if ! kill -0 "$NEW_PID" 2>/dev/null; then
  echo "Mission Control failed to start."
  echo "Check logs: $OUT_LOG and $ERR_LOG"
  exit 1
fi

echo "$NEW_PID" > "$PID_FILE"

echo "Mission Control started in background."
echo "PID: $NEW_PID"
echo "URL: http://127.0.0.1:$PORT"
echo "Logs: $OUT_LOG and $ERR_LOG"
