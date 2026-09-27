#!/usr/bin/env bash
# Runs every test Attune has: unit tests, every browser end-to-end test, then the screen audit.
# One line per file in tests/results.txt ("ALL PASSED" or the failure), then "DONE".
#   bash tests/run_all.sh            (about 25 minutes; run it in the background)
# Needs: bash tests/setup.sh once (tiny model + desktop llama-server), Playwright + Chromium,
# python-docx / openpyxl / python-pptx for the real-file checks (skipped if missing).
# e2e_v510_more.py / e2e_v512_more.py are helper modules (they print nothing) — not failures.
cd "$(dirname "$0")/.."
OUT=tests/results.txt
export PYTHONPATH="$PWD/tests/pwshim:$PWD/tests${PYTHONPATH:+:$PYTHONPATH}"   # pwshim: use /opt/pw-browsers/chromium in cloud sessions
for f in tests/unit/*.test.mjs; do echo "$f: $(node "$f" 2>/dev/null | tail -1)"; done > "$OUT"
( cd tests && for f in e2e_*.py; do echo "$f: $(timeout 900 python3 "$f" 2>&1 | tail -1)"; done ) >> "$OUT"
timeout 1500 python3 tests/audit.py > tests/audit.txt 2>&1
echo DONE >> "$OUT"
grep -v "ALL PASSED" "$OUT"
