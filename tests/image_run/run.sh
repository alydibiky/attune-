#!/bin/bash
# Builds the desktop sd-cli from the pinned commit (once), fetches Real-ESRGAN
# (once, from GitHub) and runs ImageRunTest.kt. Needs kotlinc on PATH or KOTLINC.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; cd "$HERE"
SD_COMMIT=$(grep -o '[0-9a-f]\{40\}' ../../app/src/main/cpp/build-image-engine.sh | head -1)
[ -d sd ] || git clone -q https://github.com/leejet/stable-diffusion.cpp sd
(cd sd && git fetch -q --depth 1 origin "$SD_COMMIT" 2>/dev/null; git checkout -q "$SD_COMMIT" && git submodule update -q --init --depth 1 ggml)
[ -x sd/build/bin/sd-cli ] || { cmake -S sd -B sd/build -DCMAKE_BUILD_TYPE=Release -DSD_WEBP=OFF -DSD_WEBM=OFF >/dev/null && cmake --build sd/build --target sd-cli -j2 >/dev/null; }
[ -s RealESRGAN_x4plus.pth ] || curl -fsSL -o RealESRGAN_x4plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth
KC="${KOTLINC:-kotlinc}"
"$KC" -nowarn ../../app/src/main/java/com/aldibiki/attune/ImageRun.kt ImageRunTest.kt -include-runtime -d imagerun.jar 2>&1 | grep -v "^warning" || true
java -cp imagerun.jar ImageRunTestKt "$HERE/sd/build/bin/sd-cli" "$HERE/RealESRGAN_x4plus.pth" "$HERE/work"
