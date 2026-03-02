#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
APP_DIR=${SCRIPT_DIR:h}
PID_FILE=${MISSION_CONTROL_PID_FILE:-$APP_DIR/mission-control.pid}
LAUNCHD_LABEL=${MISSION_CONTROL_LAUNCHD_LABEL:-ai.openclaw.mission-control}
LEGACY_LABEL=${MISSION_CONTROL_LEGACY_LAUNCHD_LABEL:-lauch_Mission_Control}

stop_launchd_service() {
  local label=$1
  if launchctl print "gui/$UID/$label" >/dev/null 2>&1; then
    if launchctl bootout "gui/$UID/$label" >/dev/null 2>&1; then
      echo "Stopped Mission Control launchd service $label"
      return 0
    fi
    echo "Failed to stop Mission Control launchd service $label" >&2
    return 1
  fi
  return 1
}

stopped=0

if stop_launchd_service "$LAUNCHD_LABEL"; then
  stopped=1
elif stop_launchd_service "$LEGACY_LABEL"; then
  stopped=1
fi

if [[ -f "$PID_FILE" ]]; then
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
    stopped=1
  else
    echo "PID $PID is not running"
  fi
fi

rm -f "$PID_FILE"

if [[ "$stopped" -eq 0 ]]; then
  echo "Mission Control is not running"
fi
