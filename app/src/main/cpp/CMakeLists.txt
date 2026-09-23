cmake_minimum_required(VERSION 3.22.1)
project(attune-engine C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# ---------------------------------------------------------------------------
# llama.cpp, fetched into ./llama.cpp by fetch-llama.sh (pinned to 7ab4ee7).
#
# SPEED. The CPU backend is built once per ARM generation and the phone keeps
# the fastest build it can run (dotprod → int8 matrix multiply → SVE2 → SME),
# chosen at start-up by attune-engine.cpp (nPreload). Arm's KleidiAI kernels
# sit on top. This is the same layout as llama.cpp's own Android app. It needs
# shared libraries, which Android packages and unpacks for us (see
# useLegacyPackaging in app/build.gradle.kts).
#
# OpenMP stays off, as llama.cpp's Android guide says; ggml's own thread pool
# is used.
# ---------------------------------------------------------------------------
set(BUILD_SHARED_LIBS      ON  CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL        ON  CACHE BOOL "" FORCE)
set(GGML_CPU_ALL_VARIANTS  ON  CACHE BOOL "" FORCE)
set(GGML_NATIVE            OFF CACHE BOOL "" FORCE)  # never tune for the build PC
set(GGML_OPENMP            OFF CACHE BOOL "" FORCE)
set(GGML_LLAMAFILE         OFF CACHE BOOL "" FORCE)

if(ANDROID_ABI STREQUAL "arm64-v8a")
    set(GGML_SYSTEM_ARCH   "ARM" CACHE STRING "" FORCE)
    set(GGML_CPU_KLEIDIAI  ON    CACHE BOOL   "" FORCE)
elseif(ANDROID_ABI STREQUAL "x86_64")                # emulator only
    set(GGML_SYSTEM_ARCH   "x86" CACHE STRING "" FORCE)
    set(GGML_CPU_KLEIDIAI  OFF   CACHE BOOL   "" FORCE)
endif()

# The official server, as a library, with its photo reader (mtmd).
set(LLAMA_BUILD_COMMON     ON  CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS      ON  CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER     ON  CACHE BOOL "" FORCE)
set(LLAMA_BUILD_UI         OFF CACHE BOOL "" FORCE)  # Attune has its own UI
set(LLAMA_USE_PREBUILT_UI  OFF CACHE BOOL "" FORCE)  # never download a UI at build time
set(LLAMA_BUILD_TESTS      OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES   OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_APP        OFF CACHE BOOL "" FORCE)
set(LLAMA_TOOLS_INSTALL    OFF CACHE BOOL "" FORCE)
set(LLAMA_OPENSSL          OFF CACHE BOOL "" FORCE)  # 127.0.0.1 only; downloads are done in Kotlin

add_subdirectory(llama.cpp)

# ---------------------------------------------------------------------------
# The JNI library the app loads: System.loadLibrary("attune-engine")
# ---------------------------------------------------------------------------
add_library(attune-engine SHARED attune-engine.cpp)
target_link_libraries(attune-engine PRIVATE llama-server-impl)

if(ANDROID)
    target_link_libraries(attune-engine PRIVATE android log)
else()
    find_package(JNI REQUIRED)                       # desktop test build
    target_include_directories(attune-engine PRIVATE ${JNI_INCLUDE_DIRS})
endif()
