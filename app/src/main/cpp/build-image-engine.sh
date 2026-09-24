#!/bin/bash
# The picture engine for Studio: stable-diffusion.cpp (MIT), built for the
# phone as a small command-line program that Attune starts in its own process
# (so a crash while drawing can never take the app down, and all its memory is
# returned the moment a picture is done).
#
#   libattune-image.so      CPU (ARMv8.2 + dotprod + fp16 — every phone from ~2019)
#   libattune-image-gpu.so  the same with the Adreno GPU (OpenCL), if the
#                           OpenCL SDK step ran (app/src/main/cpp/opencl/)
#
# Both land in app/src/main/jniLibs/arm64-v8a/. Android only unpacks files
# named lib*.so from an APK, hence the names; they are programs, not libraries.
#   NDK=/path/to/ndk bash app/src/main/cpp/build-image-engine.sh
set -e
SD_COMMIT=88411ef1e0688ff2df1010aeeb5d92b2d8cea2be      # 2026-09-24, FLUX.2 klein + Z-Image + ESRGAN
HERE="$(cd "$(dirname "$0")" && pwd)"
NDK="${NDK:-$ANDROID_SDK_ROOT/ndk/29.0.14206865}"
NINJA="${NINJA:-$(command -v ninja || echo "$ANDROID_SDK_ROOT/cmake/3.31.6/bin/ninja")}"
SRC="${SD_SRC:-$HERE/stable-diffusion.cpp}"
OUT="$HERE/../jniLibs/arm64-v8a"
OCL="$HERE/opencl"
JOBS="${JOBS:-$(nproc)}"

if [ ! -d "$SRC/.git" ]; then
  git clone -q https://github.com/leejet/stable-diffusion.cpp "$SRC"
fi
(cd "$SRC" && git fetch -q --depth 1 origin "$SD_COMMIT" 2>/dev/null || true; cd "$SRC" && git checkout -q "$SD_COMMIT" && git submodule update -q --init --depth 1 ggml)

common=(-G Ninja -DCMAKE_MAKE_PROGRAM="$NINJA"
  -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake"
  -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=28 -DANDROID_STL=c++_static
  -DCMAKE_BUILD_TYPE=Release -DSD_WEBP=OFF -DSD_WEBM=OFF -DSD_BUILD_SHARED_LIBS=OFF -DBUILD_SHARED_LIBS=OFF
  -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF -DGGML_CPU_ARM_ARCH=armv8.2-a+dotprod+fp16)

mkdir -p "$OUT"
cmake -S "$SRC" -B "$SRC/build-android-cpu" "${common[@]}" > /dev/null
cmake --build "$SRC/build-android-cpu" --target sd-cli -j"$JOBS" > /dev/null
cp "$SRC/build-android-cpu/bin/sd-cli" "$OUT/libattune-image.so"
"$NDK"/toolchains/llvm/prebuilt/*/bin/llvm-strip "$OUT/libattune-image.so" || true
echo "picture engine (CPU): $(du -h "$OUT/libattune-image.so" | cut -f1)"

if [ -f "$OCL/lib/arm64-v8a/libOpenCL.so" ]; then
  cmake -S "$SRC" -B "$SRC/build-android-gpu" "${common[@]}" -DSD_OPENCL=ON \
    -DOpenCL_INCLUDE_DIR="$OCL/include" -DOpenCL_LIBRARY="$OCL/lib/arm64-v8a/libOpenCL.so" > /dev/null
  cmake --build "$SRC/build-android-gpu" --target sd-cli -j"$JOBS" > /dev/null
  cp "$SRC/build-android-gpu/bin/sd-cli" "$OUT/libattune-image-gpu.so"
  "$NDK"/toolchains/llvm/prebuilt/*/bin/llvm-strip "$OUT/libattune-image-gpu.so" || true
  echo "picture engine (GPU, OpenCL): $(du -h "$OUT/libattune-image-gpu.so" | cut -f1)"
else
  echo "no OpenCL SDK — the picture engine is CPU-only in this build"
fi
