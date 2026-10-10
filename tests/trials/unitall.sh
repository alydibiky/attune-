#!/bin/bash
# Runs every node unit test and lists the failures.   bash tests/trials/unitall.sh
cd "$(dirname "$0")/../.."
f=0; n=0
for t in tests/unit/*.test.mjs; do n=$((n+1)); node "$t" >/dev/null 2>&1 || { echo "FAIL $t"; f=$((f+1)); }; done
echo "unit tests: $n run, $f failed"
