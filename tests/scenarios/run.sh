#!/bin/bash
# The 10,000-sentence run through the mirror of Chat's decision order (brain.mjs):  bash tests/scenarios/run.sh [count]
cd "$(dirname "$0")" && node gen.mjs "$@" 2>&1 | grep -v "MODULE_TYPELESS\|Reparsing as ES\|eliminate this warning\|trace-warnings"
