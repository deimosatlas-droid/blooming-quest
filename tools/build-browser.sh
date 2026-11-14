#!/bin/sh
set -eu

# Static browser release: no paid service, package install or server bundle.
for source in dist/*.js; do
  node --check "$source"
done
node tests/adventure.cjs
node tests/hero-combat.cjs
node tests/collision-input.cjs
node tests/scene-interactions.cjs
node tests/forage.cjs
node tests/world-map.cjs
node tests/save-transfer.cjs
node tests/offline.cjs
python3 tools/export-standalone.py --prepare-only
python3 tools/export-standalone.py --check
