#!/bin/bash
# Ticket hunter offline tests. Uses Node if installed, otherwise macOS JavaScriptCore (osascript).
# 離線測試：有 Node 就用 Node，否則用 macOS 內建的 JavaScriptCore。
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FIXTURES="$DIR/tests/fixtures"
{
  printf 'var TH_FIXTURE_DIR = "%s";\n' "${FIXTURES//\"/\\\"}"
  cat "$DIR/tests/harness.js"
  for f in "$DIR"/src/*.gs; do cat "$f"; echo; done
  for f in "$DIR"/tests/*.test.js; do cat "$f"; echo; done
} > "$TMP/all.js"

if command -v node >/dev/null 2>&1; then
  echo 'console.log(thRunAll());' >> "$TMP/all.js"
  node "$TMP/all.js"
elif command -v osascript >/dev/null 2>&1; then
  echo 'thRunAll();' >> "$TMP/all.js"
  osascript -l JavaScript "$TMP/all.js"
else
  echo "Need Node.js or macOS osascript to run tests." >&2
  exit 2
fi
