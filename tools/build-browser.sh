#!/bin/sh
set -eu

# Static browser release: no paid service, package install or server bundle.
for source in dist/*.js; do
  node --check "$source"
done
for test in tests/*.cjs; do
  node "$test"
done
python3 tools/export-standalone.py --prepare-only
python3 tools/export-standalone.py --check
python3 tests/standalone-export.py
