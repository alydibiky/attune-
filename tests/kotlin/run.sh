#!/bin/bash
# Compiles the pure-Kotlin parts of the app (no Android) with their tests and runs them. Needs kotlinc on PATH or KOTLINC=.
set -e
cd "$(dirname "$0")/../.."
K=${KOTLINC:-kotlinc}
OUT=$(mktemp -d)
for pair in "Franco:FrancoTest" "LocalSync:LocalSyncTest" "WatchMatch:WatchMatchTest"; do
  src=${pair%%:*}; t=${pair##*:}
  $K app/src/main/java/com/aldibiki/attune/$src.kt tests/kotlin/$t.kt -include-runtime -d "$OUT/$t.jar" 2>&1 | grep -v "^warning" || true
  java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$OUT/$t.jar" ${t}Kt
done
