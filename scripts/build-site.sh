#!/usr/bin/env bash
# Build the landing page into site-dist/ (the demo reuses the real strategies.js).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf site-dist && mkdir site-dist
cp site/* site-dist/
cp strategies.js site-dist/strategies.js
cp icons/icon128.png site-dist/icon128.png
echo "site-dist/"
