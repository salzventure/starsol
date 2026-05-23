#!/bin/bash
# Step 1: Create deployment tarball from backend/ directory.
# Run from main branch. Deploy order: step1 → step2 → step3 → step4

set -e
cd "$(dirname "$0")/.."

SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

if [ "$BRANCH" != "main" ]; then
  echo "[step1] WARNING: Not on main branch (currently on '$BRANCH'). Deploy from main only."
  echo "[step1] Press Ctrl+C to cancel, or wait 5 seconds to continue anyway."
  sleep 5
fi

echo "[step1] Creating tarball from SHA=$SHA (branch=$BRANCH)"

COPYFILE_DISABLE=1 tar \
  --no-xattrs \
  --exclude='._*' \
  --exclude='.DS_Store' \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='.next' \
  --exclude='.git' \
  -czf /tmp/starsol-stage.tar.gz \
  backend/

SIZE=$(wc -c < /tmp/starsol-stage.tar.gz)
echo "[step1] Created /tmp/starsol-stage.tar.gz ($SIZE bytes, SHA=$SHA)"
