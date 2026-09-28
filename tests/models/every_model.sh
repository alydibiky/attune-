#!/usr/bin/env bash
# v6.8 — Ali: "test every model". Runs ALL the real-model trials (tests/trials) on every catalogue model
# that fits this machine, one at a time: download → trials → report-<name>.md → delete (Core is kept).
#   bash tests/models/every_model.sh            (hours on a CPU; run it in the background)
# The Blaze models use Google's LiteRT GPU engine on the phone and are checked by catalogue.mjs only;
# Apex / Everest (14–22 GB) need more memory than a normal machine has.
cd "$(dirname "$0")/../.."
D=/home/user/models; mkdir -p "$D"
SUM=tests/trials/every-model.txt; : > "$SUM"
while read -r NAME REPO FILE; do
  [ -z "$NAME" ] && continue
  M="$D/$NAME.gguf"
  if [ ! -s "$M" ]; then curl -sL --retry 4 -o "$M" "https://huggingface.co/$REPO/resolve/main/$FILE" || { echo "$NAME: download failed" >> "$SUM"; continue; }; fi
  out=$(TRIAL_REPORT="./report-$NAME.md" timeout 14400 bash tests/trials/run.sh "$M" 2>/dev/null | grep -E "^CHECKS|: [0-9]+/[0-9]+")
  echo "== $NAME ($FILE) $(echo "$out" | grep CHECKS)" >> "$SUM"
  echo "$out" | grep -v CHECKS | sed 's/^/   /' >> "$SUM"
  [ "$NAME" != core-4b ] && rm -f "$M"
done <<'LIST'
spark  unsloth/Qwen3.5-0.8B-GGUF Qwen3.5-0.8B-Q4_K_M.gguf
glow   unsloth/Qwen3.5-2B-GGUF   Qwen3.5-2B-UD-Q4_K_XL.gguf
corelite unsloth/Qwen3.5-4B-GGUF Qwen3.5-4B-IQ4_XS.gguf
core-4b unsloth/Qwen3.5-4B-GGUF  Qwen3.5-4B-Q4_K_M.gguf
coreplus unsloth/Qwen3.5-4B-GGUF Qwen3.5-4B-Q5_K_M.gguf
sense  unsloth/gemma-4-E4B-it-GGUF gemma-4-E4B-it-UD-Q4_K_XL.gguf
zenith unsloth/Qwen3.5-9B-GGUF   Qwen3.5-9B-IQ4_NL.gguf
zenithplus unsloth/gemma-4-12B-it-GGUF gemma-4-12b-it-UD-Q4_K_XL.gguf
LIST
echo DONE >> "$SUM"
