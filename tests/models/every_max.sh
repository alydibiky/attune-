#!/usr/bin/env bash
# v6.8 — Ali: "test all the models to the max in everything". For every catalogue model that fits this
# machine: download the model and its photo reader → tests/trials/run2.sh (all trials + the max set +
# photos + speed) → delete (Core is kept). Summary: tests/trials/every-max.txt
#   bash tests/models/every_max.sh [names…]      (hours on a CPU; run it in the background)
cd "$(dirname "$0")/../.."
D=/home/user/models; mkdir -p "$D"
SUM=tests/trials/every-max.txt; [ $# -eq 0 ] && : > "$SUM"
while read -r NAME REPO FILE MM; do
  [ -z "$NAME" ] && continue
  if [ $# -gt 0 ] && ! printf '%s\n' "$@" | grep -qx "$NAME"; then continue; fi
  M="$D/$NAME.gguf"; P="$D/$NAME-mmproj.gguf"
  [ -s "$M" ] || curl -sL --retry 4 -o "$M" "https://huggingface.co/$REPO/resolve/main/$FILE" || { echo "$NAME: download failed" >> "$SUM"; continue; }
  [ -s "$P" ] || curl -sL --retry 4 -o "$P" "https://huggingface.co/$REPO/resolve/main/$MM" || rm -f "$P"
  MMP=""; [ -s "$P" ] && MMP="$P"
  out=$(NAME=$NAME MMPROJ=$MMP timeout 36000 bash tests/trials/run2.sh "$M" 2>/dev/null | grep -E "^(CHECKS|MAX)|^  ")
  { echo "== $NAME ($FILE)"; echo "$out"; } >> "$SUM"
  [ "$NAME" != core-4b ] && rm -f "$M"; rm -f "$P"
done <<'LIST'
spark unsloth/Qwen3.5-0.8B-GGUF Qwen3.5-0.8B-Q4_K_M.gguf mmproj-F16.gguf
glow unsloth/Qwen3.5-2B-GGUF Qwen3.5-2B-UD-Q4_K_XL.gguf mmproj-F16.gguf
corelite unsloth/Qwen3.5-4B-GGUF Qwen3.5-4B-IQ4_XS.gguf mmproj-F16.gguf
core-4b unsloth/Qwen3.5-4B-GGUF Qwen3.5-4B-Q4_K_M.gguf mmproj-F16.gguf
coreplus unsloth/Qwen3.5-4B-GGUF Qwen3.5-4B-Q5_K_M.gguf mmproj-F16.gguf
sense unsloth/gemma-4-E4B-it-GGUF gemma-4-E4B-it-UD-Q4_K_XL.gguf mmproj-F16.gguf
zenith unsloth/Qwen3.5-9B-GGUF Qwen3.5-9B-IQ4_NL.gguf mmproj-F16.gguf
zenithplus unsloth/gemma-4-12B-it-GGUF gemma-4-12b-it-UD-Q4_K_XL.gguf mmproj-BF16.gguf
LIST
echo DONE >> "$SUM"
