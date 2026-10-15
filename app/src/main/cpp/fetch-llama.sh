#!/usr/bin/env bash
# Places llama.cpp where the native build expects it: app/src/main/cpp/llama.cpp
# Pinned to the exact commit the JNI (attune-llama.cpp) was written against, so
# the C API matches. Run this ONCE before building the APK.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
PIN="7ab4ee7baad2d920464cbacfad4f4b07cf111fd2"

if [ -d "$DIR/llama.cpp/.git" ]; then
  echo "llama.cpp already present. Leaving it as-is."
  exit 0
fi

echo "Cloning llama.cpp (pinned $PIN)…"
# (v6.29: GitHub sometimes times out mid-clone — HTTP 408 — so the clone is tried up to 4 times)
for i in 1 2 3 4; do
  git clone https://github.com/ggml-org/llama.cpp "$DIR/llama.cpp" && break
  rm -rf "$DIR/llama.cpp"; [ "$i" = 4 ] && exit 1; echo "clone failed, trying again in $((i * 10)) s"; sleep $((i * 10))
done
cd "$DIR/llama.cpp"
git checkout "$PIN"
echo "Done. You can now build the APK in Android Studio."
