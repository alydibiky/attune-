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
git clone https://github.com/ggml-org/llama.cpp "$DIR/llama.cpp"
cd "$DIR/llama.cpp"
git checkout "$PIN"
echo "Done. You can now build the APK in Android Studio."
