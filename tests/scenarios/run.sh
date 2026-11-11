#!/bin/bash
# The sentence runs through the mirror of Chat's decision order (brain.mjs):
#   bash tests/scenarios/run.sh hard [count]   the 10,000 HARD sentences, details checked (hard.mjs → hard-report.md)
#   bash tests/scenarios/run.sh [count]        the first 10,000 everyday sentences (gen.mjs → report.md)
cd "$(dirname "$0")"
if [ "$1" = "hard" ]; then shift; f=hard.mjs; else f=gen.mjs; fi
node $f "$@" 2>&1 | grep -v "MODULE_TYPELESS\|Reparsing as ES\|eliminate this warning\|trace-warnings"
