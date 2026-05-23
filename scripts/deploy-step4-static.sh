#!/bin/bash
# Step 4: Deploy marketing website static files to web root.
# Requires step 3 to have run first.
# website/ directory is built separately (static HTML).

set -e

SSH_KEY="$HOME/.ssh/ls_us_west_2.pem"
SERVER="admin@44.225.86.196"
WEB_ROOT="/var/www/html/starsol.app"

SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")

echo "[step4] Uploading website/ (SHA=$SHA)..."
rsync -avz --exclude='.DS_Store' \
  -e "ssh -i $SSH_KEY" \
  website/ "$SERVER:/tmp/starsol-website/"

ssh -i "$SSH_KEY" "$SERVER" << REMOTE
set -e
echo "[step4-remote] Deploying static files to $WEB_ROOT ..."
sudo mkdir -p "$WEB_ROOT"
sudo rsync -av --delete /tmp/starsol-website/ "$WEB_ROOT/"
sudo chown -R www-data:www-data "$WEB_ROOT/"
echo "[step4-remote] Checking health..."
curl -sf http://localhost:3402/api/health && echo " — backend OK" || echo " — backend CHECK FAILED"
echo "[step4-remote] Static deploy complete (SHA=$SHA)"
REMOTE

echo "[step4] Done. Verify: curl https://starsol.app/api/health"
