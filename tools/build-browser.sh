#!/bin/sh
set -eu

# Static browser release: no paid service, package install or server bundle.
for source in dist/*.js; do
  node --check "$source"
done
node tests/adventure.cjs
node tests/hero-combat.cjs
node tests/combat.cjs
node tests/enemy-telegraphs.cjs
node tests/progression.cjs
node tests/abilities.cjs
node tests/combat-ui.cjs
node tests/arpg-integration.cjs
node tests/collision-input.cjs
node tests/scene-interactions.cjs
node tests/forage.cjs
node tests/world-map.cjs
node tests/save-transfer.cjs
node tests/offline.cjs
node tests/mobile-controls.cjs
python3 tools/export-standalone.py --prepare-only
python3 tools/export-standalone.py --check
