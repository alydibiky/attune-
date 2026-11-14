#!/usr/bin/env bash
# The 1,000,000-case test (TEST_1M.md) — every part, then tests/onemillion/REPORT.md. Takes several hours on 4 cores.
#   bash tests/onemillion/run.sh            (SEED_SHIFT=1: cases the features were not tuned on)
set -u
cd "$(dirname "$0")/../.."
export SEED_SHIFT="${SEED_SHIFT:-1}" PYTHONPATH="$PWD/tests/pwshim:$PWD/tests"
H=tests/onemillion
node tests/scenarios/mega.mjs > /dev/null 2>&1            # A1 100,000 hard sentences      → A1-mega-s1.md
node tests/scenarios/chat100k.mjs > /dev/null 2>&1        # A2 100,000 chat orders         → A2-chat-s1.md
node $H/langs.mjs > /dev/null 2>&1                        # A3 100,000 in 20 languages     → A3-langs-s1.md
HELDOUT=1 node $H/langs.mjs 10000 > /dev/null 2>&1        #    + held-out phrasings          → A3-langs-heldout-s1.md
node $H/partB.mjs 2 > /dev/null 2>&1                      # B  every feature generator     → B-features-s1.md
node $H/partD.mjs > /dev/null 2>&1                        # D  150,000 answers vs truth    → D-answers-s1.md
rm -f $H/C-shard-*.json; rm -rf $H/C-en
for i in 0 1; do C_LANGS=en python3 $H/partC.py $i 2 > /dev/null 2>&1 & done; wait   # C  English first (what the others compare with)
for i in 0 1 2; do python3 $H/partC.py $i 3 > /dev/null 2>&1 & done; wait            #    then the other 20 languages
python3 $H/partC.py merge > /dev/null                                                  #                                 → C-uiux.md
python3 $H/partE.py > /dev/null 2>&1                      # E  50,000 journeys             → E-flows.md
node $H/report.mjs                                        # → REPORT.md
