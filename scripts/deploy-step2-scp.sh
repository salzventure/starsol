#!/bin/bash
# Step 2: Upload tarball to Lightsail server.
# Requires /tmp/starsol-stage.tar.gz from step 1.

set -e

SSH_KEY="$HOME/.ssh/ls_us_west_2.pem"
SERVER="admin@44.225.86.196"

if [ ! -f "/tmp/starsol-stage.tar.gz" ]; then
  echo "[step2] ERROR: /tmp/starsol-stage.tar.gz not found. Run step 1 first."
  exit 1
fi

echo "[step2] Uploading to $SERVER..."
scp -i "$SSH_KEY" /tmp/starsol-stage.tar.gz "$SERVER:/tmp/starsol-stage.tar.gz"
echo "[step2] Upload complete."
