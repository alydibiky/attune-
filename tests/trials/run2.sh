#!/usr/bin/env bash
# v6.8 — one model, everything: the llama-server like the phone (flash attention, 8-bit KV) WITH its photo
# reader (MMPROJ), then run.mjs (skipped when its report is already complete) and max.mjs.
#   NAME=zenith MMPROJ=/path/mmproj.gguf bash tests/trials/run2.sh /path/model.gguf
set -e
cd "$(dirname "$0")/../.."
M="$1"; N="${NAME:-$(basename "$M" .gguf)}"
[ -f "$M" ] || { echo "model file not found: $M"; exit 1; }
export LD_LIBRARY_PATH="$PWD/tests/build-dl/bin"
tests/build-dl/bin/llama-server -m "$M" ${MMPROJ:+--mmproj "$MMPROJ"} --host 127.0.0.1 --port 8099 -c 8192 -t "$(nproc)" -np 1 --jinja --no-ui \
  -fa on -ctk q8_0 -ctv q8_0 --cache-ram 0 --log-file /tmp/trial-engine.log > /dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 600); do curl -s 127.0.0.1:8099/health | grep -q ok && break; sleep 1; done
export MODEL_NAME="$(basename "$M")"
if ! grep -q "Automatic checks" "tests/trials/report-$N.md" 2>/dev/null; then TRIAL_REPORT="./report-$N.md" node tests/trials/run.mjs; fi
TRIAL_REPORT="./max-$N.md" node tests/trials/max.mjs
