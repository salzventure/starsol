#!/bin/bash
# Run Supabase migrations without a full deploy.
# Requires supabase CLI: brew install supabase/tap/supabase

set -e
cd "$(dirname "$0")/../backend"

echo "[migrations] Pushing schema to Supabase..."
supabase db push

echo "[migrations] Done."
