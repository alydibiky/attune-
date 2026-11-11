#!/bin/bash
# The 10,000 notifications through the mirror of what Attune does with each (brain.mjs):  bash tests/notifs/run.sh [count]
cd "$(dirname "$0")" && node gen.mjs "$@" 2>&1 | grep -v "MODULE_TYPELESS\|Reparsing as ES\|eliminate this warning\|trace-warnings"
