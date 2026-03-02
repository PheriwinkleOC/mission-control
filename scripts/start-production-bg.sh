#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
APP_DIR=${SCRIPT_DIR:h}
PID_FILE=${MISSION_CONTROL_PID_FILE:-$APP_DIR/mission-control.pid}
LOG_DIR=${MISSION_CONTROL_LOG_DIR:-$APP_DIR/logs}
OUT_LOG=${MISSION_CONTROL_OUT_LOG:-$LOG_DIR/mission-control.out.log}
ERR_LOG=${MISSION_CONTROL_ERR_LOG:-$LOG_DIR/mission-control.err.log}
PORT=${PORT:-3270}
LAUNCHD_LABEL=${MISSION_CONTROL_LAUNCHD_LABEL:-ai.openclaw.mission-control}
LAUNCHD_PLIST=${MISSION_CONTROL_LAUNCHD_PLIST:-$HOME/Library/LaunchAgents/$LAUNCHD_LABEL.plist}
START_TIMEOUT_SECONDS=${MISSION_CONTROL_START_TIMEOUT_SECONDS:-15}

port_listening() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

service_reachable() {
  curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/version" >/dev/null 2>&1
}

wait_for_service() {
  local waited=0
  while (( waited < START_TIMEOUT_SECONDS )); do
    if service_reachable; then
      return 0
    fi
    sleep 1
    ((waited += 1))
  done
  return 1
}

launchd_managed() {
  launchctl print "gui/$UID/$LAUNCHD_LABEL" >/dev/null 2>&1
}

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID=$(<"$PID_FILE")
  if kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "Mission Control is already running with PID $EXISTING_PID"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

if launchd_managed; then
  if service_reachable || port_listening; then
    echo "Mission Control is already running under launchd ($LAUNCHD_LABEL)."
    echo "URL: http://127.0.0.1:$PORT"
    exit 0
  fi
  launchctl kickstart -k "gui/$UID/$LAUNCHD_LABEL"
  if ! wait_for_service; then
    echo "Mission Control launchd service did not become ready within ${START_TIMEOUT_SECONDS}s."
    exit 1
  fi
  echo "Mission Control started under launchd ($LAUNCHD_LABEL)."
  echo "URL: http://127.0.0.1:$PORT"
  exit 0
fi

if [[ -f "$LAUNCHD_PLIST" ]]; then
  launchctl bootstrap "gui/$UID" "$LAUNCHD_PLIST" >/dev/null 2>&1 || true
  launchctl kickstart -k "gui/$UID/$LAUNCHD_LABEL"
  if ! wait_for_service; then
    echo "Mission Control launchd service did not become ready within ${START_TIMEOUT_SECONDS}s."
    exit 1
  fi
  echo "Mission Control started under launchd ($LAUNCHD_LABEL)."
  echo "URL: http://127.0.0.1:$PORT"
  exit 0
fi

if port_listening; then
  if service_reachable; then
    echo "Mission Control is already running on port $PORT."
    echo "URL: http://127.0.0.1:$PORT"
    exit 0
  fi
  echo "Port $PORT is already in use by another process."
  echo "Free the port before starting Mission Control."
  exit 1
fi

cd "$APP_DIR"
export NODE_ENV=${NODE_ENV:-production}
export PORT

nohup "$APP_DIR/scripts/start-production.sh" >>"$OUT_LOG" 2>>"$ERR_LOG" </dev/null &
NEW_PID=$!

sleep 1

if ! kill -0 "$NEW_PID" 2>/dev/null; then
  echo "Mission Control failed to start."
  echo "Check logs: $OUT_LOG and $ERR_LOG"
  exit 1
fi

if ! wait_for_service; then
  echo "Mission Control process started but did not become ready within ${START_TIMEOUT_SECONDS}s."
  echo "Check logs: $OUT_LOG and $ERR_LOG"
  exit 1
fi

echo "$NEW_PID" > "$PID_FILE"

echo "Mission Control started in background."
echo "PID: $NEW_PID"
echo "URL: http://127.0.0.1:$PORT"
echo "Logs: $OUT_LOG and $ERR_LOG"
