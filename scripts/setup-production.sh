#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
REPO_DIR=${SCRIPT_DIR:h}
PROD_DIR=${MISSION_CONTROL_PROD_DIR:-$HOME/ProductionCode/mission-control}
PROD_BRANCH=${MISSION_CONTROL_PROD_BRANCH:-main}
REMOTE_NAME=${MISSION_CONTROL_REMOTE_NAME:-origin}
REPO_URL=$(git -C "$REPO_DIR" remote get-url "$REMOTE_NAME")

if [[ -z "$REPO_URL" ]]; then
  echo "Remote $REMOTE_NAME is not configured."
  exit 1
fi

if [[ ! -d "$PROD_DIR/.git" ]]; then
  git clone "$REPO_URL" "$PROD_DIR"
fi

git -C "$PROD_DIR" fetch --prune "$REMOTE_NAME"

if git -C "$PROD_DIR" show-ref --verify --quiet "refs/heads/$PROD_BRANCH"; then
  git -C "$PROD_DIR" checkout "$PROD_BRANCH"
else
  git -C "$PROD_DIR" checkout -b "$PROD_BRANCH" "$REMOTE_NAME/$PROD_BRANCH"
fi

git -C "$PROD_DIR" pull --ff-only "$REMOTE_NAME" "$PROD_BRANCH"
npm --prefix "$PROD_DIR" ci
chmod +x "$PROD_DIR/scripts/"*.sh

echo "Production setup complete."
echo "Development: http://127.0.0.1:3001 via npm run dev"
echo "Production:  http://127.0.0.1:3270 via $PROD_DIR/scripts/start-production.sh"
