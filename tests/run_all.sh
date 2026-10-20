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
# a unit file can print PASS on its last line after an earlier FAIL, so any FAIL line is reported instead
for f in tests/unit/*.test.mjs; do o=$(node "$f" 2>/dev/null); fl=$(printf '%s\n' "$o" | grep -m1 '^FAIL')
  echo "$f: ${fl:-$(printf '%s\n' "$o" | tail -1)}"; done > "$OUT"
# v6.37: the desktop app's Wi-Fi sync, and the pure-Kotlin parts (Franco, LocalSync) when a Kotlin compiler is there
o=$(node desktop/test/localsync.js 2>&1 | tail -1); echo "desktop/test/localsync.js: $o" >> "$OUT"
o=$(node desktop/test/gdrive.js 2>&1 | tail -1); echo "desktop/test/gdrive.js: $o" >> "$OUT"
if command -v "${KOTLINC:-kotlinc}" >/dev/null 2>&1; then o=$(bash tests/kotlin/run.sh 2>&1); fl=$(printf '%s\n' "$o" | grep -m1 '^FAIL'); echo "tests/kotlin: ${fl:-$(printf '%s\n' "$o" | tail -1)}" >> "$OUT"; fi
# a failing file keeps its whole output in tests/fail-<name>.log (which check, and why), so an
# intermittent failure can be read afterwards instead of guessed at
( cd tests && rm -f fail-*.log && for f in e2e_*.py; do out=$(timeout 900 python3 "$f" 2>&1); last=$(printf '%s\n' "$out" | tail -1)
  case "$last" in *FAILED*|*Error*|*Traceback*) printf '%s\n' "$out" > "fail-${f%.py}.log" ;; esac; echo "$f: $last"; done ) >> "$OUT"
timeout 1500 python3 tests/audit.py > tests/audit.txt 2>&1
echo DONE >> "$OUT"
grep -v "ALL PASSED" "$OUT"
