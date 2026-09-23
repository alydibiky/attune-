// Attune on-device engine.
//
// Runs the official llama.cpp server (tools/server, built as the library
// target "llama-server-impl") inside the app process on a background thread.
// The server listens on 127.0.0.1 only and speaks the OpenAI protocol the
// Attune web app already uses, so the app gets the full upstream engine —
// vision (mmproj), prompt caching, flash attention, quantised KV cache,
// chat templates and reasoning handling — without any custom inference code.
//
// Written against llama.cpp commit 7ab4ee7 (see fetch-llama.sh).

#include <jni.h>

#include <atomic>
#include <chrono>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "ggml-backend.h"
#include "llama.h"

#ifdef __ANDROID__
#include <android/log.h>
#define ELOG(...) __android_log_print(ANDROID_LOG_INFO, "attune-engine", __VA_ARGS__)
#else
#include <cstdio>
#define ELOG(...) (std::fprintf(stderr, "[attune-engine] " __VA_ARGS__), std::fprintf(stderr, "\n"))
#endif

// Provided by llama.cpp tools/server/server.cpp
int  llama_server(int argc, char ** argv);
void llama_server_terminate();

namespace {

enum State : int { STOPPED = 0, RUNNING = 1, EXITED = 2 };

std::mutex               g_mu;
std::thread              g_thread;
std::atomic<int>         g_state{STOPPED};
std::atomic<int>         g_exit_code{0};
std::vector<std::string> g_args;   // must outlive the server thread
std::vector<char *>      g_argv;

void join_if_done() {
    if (g_state.load() != RUNNING && g_thread.joinable()) {
        g_thread.join();
    }
}

} // namespace

extern "C" {

// Load the CPU backend before the server starts. The app ships one build of
// the CPU backend per ARM generation (libggml-cpu-android_armv8.2_1.so …
// android_armv9.2_2.so); ggml scores each against this processor and keeps
// the fastest one it can run: dotprod, int8 matrix multiply (i8mm), SVE2, SME.
// The server's own start-up only loads backends when none are loaded yet, so
// doing it here, from the app's native library folder, is what makes the
// variants reachable at all. Safe to call more than once.
JNIEXPORT void JNICALL
Java_com_aldibiki_attune_EngineNative_nPreload(JNIEnv * env, jobject, jstring jdir) {
    static std::once_flag once;
    std::string dir;
    if (jdir) {
        const char * c = env->GetStringUTFChars(jdir, nullptr);
        if (c) { dir = c; env->ReleaseStringUTFChars(jdir, c); }
    }
    std::call_once(once, [&] {
        ggml_backend_load_all_from_path(dir.empty() ? nullptr : dir.c_str());
        ELOG("backends loaded: %d", (int) ggml_backend_reg_count());
    });
}

// Which backends and CPU features are active, e.g.
// "CPU | NEON = 1 | ARM_FMA = 1 | FP16_VA = 1 | MATMUL_INT8 = 1 | DOTPROD = 1 | KLEIDIAI = 1 ..."
JNIEXPORT jstring JNICALL
Java_com_aldibiki_attune_EngineNative_nSystemInfo(JNIEnv * env, jobject) {
    std::string s = "backends:";
    for (size_t i = 0; i < ggml_backend_reg_count(); i++) {
        s += " ";
        s += ggml_backend_reg_name(ggml_backend_reg_get(i));
    }
    s += " | devices:";
    for (size_t i = 0; i < ggml_backend_dev_count(); i++) {
        s += " [";
        s += ggml_backend_dev_description(ggml_backend_dev_get(i));
        s += "]";
    }
    s += " | ";
    s += llama_print_system_info();
    std::string ascii;
    for (char ch : s) ascii += ((unsigned char) ch < 0x80) ? ch : '?'; // NewStringUTF wants plain text
    return env->NewStringUTF(ascii.c_str());
}

// Start the server with the given arguments (without the program name).
// Returns false if it is already running. Non-blocking.
JNIEXPORT jboolean JNICALL
Java_com_aldibiki_attune_EngineNative_nStart(JNIEnv * env, jobject, jobjectArray jargs) {
    std::lock_guard<std::mutex> lk(g_mu);
    if (g_state.load() == RUNNING) {
        return JNI_FALSE;
    }
    join_if_done();

    g_args.clear();
    g_args.emplace_back("llama-server");
    const jsize n = jargs ? env->GetArrayLength(jargs) : 0;
    for (jsize i = 0; i < n; i++) {
        auto s = (jstring) env->GetObjectArrayElement(jargs, i);
        const char * c = s ? env->GetStringUTFChars(s, nullptr) : nullptr;
        g_args.emplace_back(c ? c : "");
        if (c) env->ReleaseStringUTFChars(s, c);
        if (s) env->DeleteLocalRef(s);
    }
    g_argv.clear();
    for (auto & a : g_args) g_argv.push_back(a.data());
    g_argv.push_back(nullptr);

    g_exit_code = 0;
    g_state     = RUNNING;
    g_thread    = std::thread([] {
        ELOG("server thread starting (%d args)", (int) g_args.size());
        const int rc = llama_server((int) g_args.size(), g_argv.data());
        g_exit_code = rc;
        g_state     = EXITED;
        ELOG("server thread exited with code %d", rc);
    });
    return JNI_TRUE;
}

// Ask a READY server to shut down, then wait for its thread to finish.
// Only call this once /health has answered 200: upstream installs its
// shutdown hook after the model has loaded. Blocking — call off the UI thread.
JNIEXPORT void JNICALL
Java_com_aldibiki_attune_EngineNative_nStop(JNIEnv *, jobject, jint timeoutMs) {
    std::lock_guard<std::mutex> lk(g_mu);
    if (g_state.load() == RUNNING) {
        llama_server_terminate();
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeoutMs);
        while (g_state.load() == RUNNING && std::chrono::steady_clock::now() < deadline) {
            std::this_thread::sleep_for(std::chrono::milliseconds(50));
        }
    }
    if (g_state.load() != RUNNING) {
        join_if_done();
        g_state = STOPPED;
    }
}

// 0 = stopped, 1 = running, 2 = exited on its own (see nExitCode)
JNIEXPORT jint JNICALL
Java_com_aldibiki_attune_EngineNative_nState(JNIEnv *, jobject) {
    return g_state.load();
}

JNIEXPORT jint JNICALL
Java_com_aldibiki_attune_EngineNative_nExitCode(JNIEnv *, jobject) {
    return g_exit_code.load();
}

} // extern "C"
