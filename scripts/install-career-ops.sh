#!/usr/bin/env bash
set -euo pipefail
app_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
revision=24da28e8307d19f3002cf32eb953ad990d71da95
install_dir="$app_root/career-ops"
if [ -e "$install_dir" ]; then
  if [ "$(git -C "$install_dir" rev-parse HEAD)" != "$revision" ]; then
    echo 'Existing installation differs from pinned revision; left untouched.' >&2
    exit 1
  fi
else
  git init "$install_dir"
  git -C "$install_dir" remote add origin https://github.com/career-ops-hq/career-ops.git
  git -C "$install_dir" fetch --depth 1 origin "$revision"
  git -C "$install_dir" checkout --detach FETCH_HEAD
fi
cd "$install_dir"
cp "$app_root/integrations/career-ops/package-lock.json" package-lock.json
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --no-audit --no-fund
mkdir -p "$app_root/private/career-ops-data"
printf '%s\n' '../private/career-ops-data' > .career-ops-data
node role-clarity.mjs --self-test
node doctor.mjs --json
printf '\nToolkit installed. Private profile onboarding is separate; browser/PDF tools need a Chromium installation.\n'
