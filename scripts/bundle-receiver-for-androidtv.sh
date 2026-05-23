#!/bin/bash
# Copy the self-contained receiver/index.html into the APK assets folder so
# the WebView shell can load it from file:///android_asset/receiver/index.html.
# Idempotent — safe to run on every build (preBuild gradle hook does this).
set -e
cd "$(dirname "$0")/.."
mkdir -p android-tv/app/src/main/assets/receiver
cp receiver/index.html android-tv/app/src/main/assets/receiver/index.html
SIZE=$(wc -c < android-tv/app/src/main/assets/receiver/index.html)
echo "[bundle] receiver/index.html -> assets/receiver/index.html ($SIZE bytes)"
