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

# ---------------------------------------------------------------------------
# GPU (Adreno) through OpenCL — OPTIONAL, and it can never break the build.
#
# CI builds the Khronos OpenCL loader for Android into ./opencl
# (include/CL/*.h + lib/<abi>/libOpenCL.so, see .github/workflows). Only if
# that step succeeded is the GPU backend compiled; otherwise this is a
# CPU-only build exactly as before. The loader is used only to LINK: at run
# time the phone's own libOpenCL.so (the Adreno driver) is used, which the
# manifest requests with <uses-native-library>. A phone without it simply
# never loads the GPU backend.
#
# The backend is renamed libattune-gpu.so so that the CPU start-up scan
# (which looks for libggml-*.so) never touches the GPU driver: it is loaded
# only when the person turns GPU on (attune-engine.cpp, nPreload).
# ---------------------------------------------------------------------------
set(ATTUNE_OPENCL_DIR "${CMAKE_CURRENT_SOURCE_DIR}/opencl" CACHE PATH "OpenCL headers + loader for linking")
if(NOT ATTUNE_OPENCL_LIB)
    set(ATTUNE_OPENCL_LIB "${ATTUNE_OPENCL_DIR}/lib/${ANDROID_ABI}/libOpenCL.so")
endif()
if((ANDROID_ABI STREQUAL "arm64-v8a" OR ATTUNE_FORCE_OPENCL)
        AND EXISTS "${ATTUNE_OPENCL_DIR}/include/CL/cl.h" AND EXISTS "${ATTUNE_OPENCL_LIB}")
    message(STATUS "Attune: building the OpenCL (Adreno GPU) backend")
    set(GGML_OPENCL                    ON  CACHE BOOL "" FORCE)
    set(GGML_OPENCL_EMBED_KERNELS      ON  CACHE BOOL "" FORCE)  # no .cl files to ship
    set(GGML_OPENCL_USE_ADRENO_KERNELS ON  CACHE BOOL "" FORCE)
    set(OpenCL_INCLUDE_DIR "${ATTUNE_OPENCL_DIR}/include" CACHE PATH "" FORCE)
    set(OpenCL_LIBRARY     "${ATTUNE_OPENCL_LIB}"          CACHE FILEPATH "" FORCE)
    set(ATTUNE_GPU ON)
else()
    message(STATUS "Attune: no OpenCL SDK in ${ATTUNE_OPENCL_DIR} — CPU-only engine")
    set(GGML_OPENCL OFF CACHE BOOL "" FORCE)
    set(ATTUNE_GPU OFF)
endif()

add_subdirectory(llama.cpp)

if(ATTUNE_GPU AND TARGET ggml-opencl)
    set_target_properties(ggml-opencl PROPERTIES OUTPUT_NAME "attune-gpu")
endif()

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
