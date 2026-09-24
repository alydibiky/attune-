#!/bin/bash
# One-time setup for the browser tests: a desktop llama-server built from the
# SAME pinned llama.cpp commit as the app, and a tiny random model to drive it.
# Needs: git, cmake, a C++ compiler, python3 with numpy + gguf + playwright.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; cd "$HERE"
PIN=$(grep -o '[0-9a-f]\{40\}' ../app/src/main/cpp/fetch-llama.sh | head -1)
[ -d llama.cpp ] || git clone -q https://github.com/ggml-org/llama.cpp llama.cpp
(cd llama.cpp && git checkout -q "$PIN")
cmake -S llama.cpp -B build-dl -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=ON -DGGML_BACKEND_DL=ON \
  -DGGML_CPU_ALL_VARIANTS=ON -DGGML_NATIVE=OFF -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_OPENSSL=OFF >/dev/null
cmake --build build-dl --target llama-server -j"$(nproc)" >/dev/null
mkdir -p build-dl/bin && cp -n build-dl/bin/*.so* build-dl/bin/ 2>/dev/null || true
pip install --quiet numpy gguf playwright 2>/dev/null || pip install --quiet --break-system-packages numpy gguf playwright
python3 make_tiny_model.py tiny-a.gguf
bash ../web-src/fetch-pyodide.sh   # Python for the Code sandbox (e2e_v58)
echo "Ready. Build the page (bash ../web-src/build.sh), then: python3 e2e_v4.py && python3 e2e_v3.py"
