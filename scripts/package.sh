#!/usr/bin/env bash
# Build dist/tabsnap-v<version>.zip containing only the files Chrome needs.
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION=$(node -p "require('./manifest.json').version")
rm -rf dist && mkdir -p dist/tabsnap
cp manifest.json background.js strategies.js popup.html popup.js dist/tabsnap/
cp -R icons dist/tabsnap/icons
(cd dist && zip -qr "tabsnap-v${VERSION}.zip" tabsnap)
echo "dist/tabsnap-v${VERSION}.zip"
