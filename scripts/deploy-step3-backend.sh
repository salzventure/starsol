#!/bin/bash
# Step 3: Extract tarball, build Next.js, restart PM2.
# Next.js requires a build step unlike the Express apps — takes ~60s.

set -e

SSH_KEY="$HOME/.ssh/ls_us_west_2.pem"
SERVER="admin@44.225.86.196"
APP_DIR="/opt/starsol-api"

echo "[step3] Deploying backend to $SERVER:$APP_DIR ..."

ssh -i "$SSH_KEY" "$SERVER" << 'REMOTE'
set -e
echo "[step3-remote] Extracting tarball..."
mkdir -p /opt/starsol-api /tmp/starsol-stage
tar -xzf /tmp/starsol-stage.tar.gz -C /tmp/starsol-stage

echo "[step3-remote] Syncing backend/ to $APP_DIR (preserving .env)..."
if [ -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env" /tmp/starsol-env.bak
fi

rsync -av --delete \
  --exclude='.env' \
  --exclude='.next/' \
  /tmp/starsol-stage/backend/ /opt/starsol-api/

if [ -f /tmp/starsol-env.bak ]; then
  cp /tmp/starsol-env.bak /opt/starsol-api/.env
fi

echo "[step3-remote] Installing dependencies..."
cd /opt/starsol-api
npm ci --omit=dev

echo "[step3-remote] Building Next.js (this takes ~60s)..."
npm run build

echo "[step3-remote] Restarting PM2..."
if pm2 show starsol-api > /dev/null 2>&1; then
  pm2 restart starsol-api --update-env
else
  pm2 start npm --name starsol-api -- start
fi

pm2 save

echo "[step3-remote] Backend deploy complete."
REMOTE

echo "[step3] Waiting 15s for server to come up..."
sleep 15

SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "[step3] Checking health (SHA=$SHA)..."
ssh -i "$SSH_KEY" "$SERVER" \
  "curl -sf http://localhost:3402/api/health && echo ' — health OK' || echo ' — health CHECK FAILED'"

echo "[step3] Done."
