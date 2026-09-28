#!/usr/bin/env bash
# Real-model trials of the app's tools: bash tests/trials/run.sh /path/to/model.gguf [tools]
# Starts the desktop llama-server with that model (like the phone: flash attention, 8-bit KV cache),
# runs tests/trials/run.mjs, writes tests/trials/report.md.
set -e
cd "$(dirname "$0")/../.."
M="$1"; shift || true
[ -f "$M" ] || { echo "model file not found: $M"; exit 1; }
export LD_LIBRARY_PATH="$PWD/tests/build-dl/bin"
tests/build-dl/bin/llama-server -m "$M" --host 127.0.0.1 --port 8099 -c 8192 -t "$(nproc)" -np 1 --jinja --no-ui \
  -fa on -ctk q8_0 -ctv q8_0 --log-file /tmp/trial-engine.log > /dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 300); do curl -s 127.0.0.1:8099/health | grep -q ok && break; sleep 1; done
MODEL_NAME="$(basename "$M")" node tests/trials/run.mjs "$@"
