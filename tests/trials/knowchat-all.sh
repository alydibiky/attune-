#!/bin/bash
# Runs knowchat.mjs on the 0.8B, 2B and 4B models, one after another, on its own port.   nohup bash tests/trials/knowchat-all.sh &
cd "$(dirname "$0")/../.."
BIN="$PWD/tests/build-dl/bin"; PORT=${TRIAL_PORT:-8177}
for m in ${MODELS:-q08 q2mtp q4mtp}; do
  LD_LIBRARY_PATH="$BIN" "$BIN/llama-server" -m /home/user/models/$m.gguf --host 127.0.0.1 --port $PORT -c 4096 -t 4 -np 1 --jinja --no-ui --cache-ram 0 >/dev/null 2>&1 &
  pid=$!
  for i in $(seq 600); do curl -sf http://127.0.0.1:$PORT/health >/dev/null && break; sleep 1; done
  TRIAL_PORT=$PORT node tests/trials/knowchat.mjs > tests/trials/knowchat-$m.md 2>&1
  kill $pid; wait $pid 2>/dev/null
done
echo done > tests/trials/knowchat.done
