#!/bin/bash
# Compiles the pure-Kotlin parts of the app (no Android) with their tests and runs them. Needs kotlinc on PATH or KOTLINC=.
set -e
cd "$(dirname "$0")/../.."
K=${KOTLINC:-kotlinc}
OUT=$(mktemp -d)
for pair in "Franco:FrancoTest" "LocalSync:LocalSyncTest" "WatchMatch:WatchMatchTest" "AutoMatch WatchMatch:AutoMatchTest"; do
  src=${pair%%:*}; t=${pair##*:}
  files=""; for f in $src; do files="$files app/src/main/java/com/aldibiki/attune/$f.kt"; done   # several sources: "A B:Test"
  $K $files tests/kotlin/$t.kt -include-runtime -d "$OUT/$t.jar" 2>&1 | grep -v "^warning" || true
  java -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$OUT/$t.jar" ${t}Kt
done
