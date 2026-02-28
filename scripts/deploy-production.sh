#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
REPO_DIR=${SCRIPT_DIR:h}
PROD_DIR=${MISSION_CONTROL_PROD_DIR:-$HOME/ProductionCode/mission-control}
PROD_BRANCH=${MISSION_CONTROL_PROD_BRANCH:-main}
REMOTE_NAME=${MISSION_CONTROL_REMOTE_NAME:-origin}

if [[ ! -d "$PROD_DIR/.git" ]]; then
  echo "Production checkout not found at $PROD_DIR"
  echo "Run npm run setup:prod first."
  exit 1
fi

git -C "$REPO_DIR" fetch "$REMOTE_NAME" "$PROD_BRANCH" --quiet

LOCAL_HEAD=$(git -C "$REPO_DIR" rev-parse HEAD)
REMOTE_HEAD=$(git -C "$REPO_DIR" rev-parse "$REMOTE_NAME/$PROD_BRANCH")

if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "Current checkout is not at $REMOTE_NAME/$PROD_BRANCH."
  echo "Push or switch to the commit you want to deploy, then run this again."
  exit 1
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

echo "Deployed $PROD_BRANCH to production."
echo "Production URL: http://127.0.0.1:3270"
