#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
APP_DIR=${SCRIPT_DIR:h}
PROD_DIR=${MISSION_CONTROL_PROD_DIR:-$HOME/ProductionCode/mission-control}
PLIST_DIR=${MISSION_CONTROL_LAUNCH_AGENTS_DIR:-$HOME/Library/LaunchAgents}
LAUNCHD_LABEL=${MISSION_CONTROL_LAUNCHD_LABEL:-ai.openclaw.mission-control}
PLIST_PATH=${PLIST_DIR}/${LAUNCHD_LABEL}.plist
OUT_LOG=${MISSION_CONTROL_OUT_LOG:-$PROD_DIR/logs/mission-control.out.log}
ERR_LOG=${MISSION_CONTROL_ERR_LOG:-$PROD_DIR/logs/mission-control.err.log}
LEGACY_PLISTS=(
  "$HOME/Library/LaunchAgents/lauch_Mission_Control.plist"
  "$HOME/Library/LaunchAgents/start_MissionControl.plist"
)
LEGACY_LABELS=(
  "lauch_Mission_Control"
  "start_MissionControl"
)

mkdir -p "$PLIST_DIR" "$PROD_DIR/logs"

for label in "${LEGACY_LABELS[@]}"; do
  launchctl bootout "gui/$UID/$label" >/dev/null 2>&1 || true
done

for legacy_plist in "${LEGACY_PLISTS[@]}"; do
  rm -f "$legacy_plist"
done

cat >"$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LAUNCHD_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$PROD_DIR/scripts/start-production.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$PROD_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StandardOutPath</key>
  <string>$OUT_LOG</string>
  <key>StandardErrorPath</key>
  <string>$ERR_LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$UID/$LAUNCHD_LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID" "$PLIST_PATH"
launchctl kickstart -k "gui/$UID/$LAUNCHD_LABEL"

echo "Installed launchd agent: $LAUNCHD_LABEL"
echo "Plist: $PLIST_PATH"
echo "Logs: $OUT_LOG and $ERR_LOG"
