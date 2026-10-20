// v6.45 Recall phase 2 — the meaning model (bge-m3) on the phone: text → 1024 numbers, normalised, so Recall can find
// things by what they mean (Arabic ↔ English). A second, small JNI library next to attune-engine: it uses the same
// libllama / ggml (shared), so the CPU backend chosen by EngineNative.nPreload is reused, and it runs beside the chat
// model (its own model and context; the chat server is never touched). Kotlin side: Embedder.kt.
// Built with -DATTUNE_EMBED_CLI on a computer it is a small test tool (tests/trials/meaning.mjs drives it).
#include "llama.h"
#include <cmath>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>

namespace {
std::mutex g_mu;
llama_model * g_model = nullptr;
llama_context * g_ctx = nullptr;
int g_nctx = 512;

void unload() {
    if (g_ctx) { llama_free(g_ctx); g_ctx = nullptr; }
    if (g_model) { llama_model_free(g_model); g_model = nullptr; }
}

bool load(const char * path, int threads) {
    std::lock_guard<std::mutex> lk(g_mu);
    if (g_ctx) return true;
    llama_model_params mp = llama_model_default_params();
    mp.n_gpu_layers = 0;                       // CPU: small, and the GPU stays free for the chat model
    g_model = llama_model_load_from_file(path, mp);
    if (!g_model) return false;
    llama_context_params cp = llama_context_default_params();
    cp.n_ctx = g_nctx; cp.n_batch = g_nctx; cp.n_ubatch = g_nctx; cp.n_seq_max = 1;
    cp.embeddings = true;
    cp.pooling_type = LLAMA_POOLING_TYPE_UNSPECIFIED;   // bge-m3's file says CLS
    cp.n_threads = threads; cp.n_threads_batch = threads;
    g_ctx = llama_init_from_model(g_model, cp);
    if (!g_ctx) { unload(); return false; }
    return true;
}

// one text → its normalised vector (empty on failure). Long text is cut to the model's window.
std::vector<float> embed(const std::string & text) {
    std::lock_guard<std::mutex> lk(g_mu);
    std::vector<float> out;
    if (!g_ctx) return out;
    const llama_vocab * vocab = llama_model_get_vocab(g_model);
    std::vector<llama_token> tok(text.size() + 8);
    int n = llama_tokenize(vocab, text.c_str(), (int) text.size(), tok.data(), (int) tok.size(), true, true);
    if (n < 0) { tok.resize(-n); n = llama_tokenize(vocab, text.c_str(), (int) text.size(), tok.data(), (int) tok.size(), true, true); }
    if (n <= 0) return out;
    if (n > g_nctx) { llama_token last = tok[n - 1]; n = g_nctx; tok[n - 1] = last; }   // keep the closing token
    llama_memory_clear(llama_get_memory(g_ctx), true);
    llama_batch b = llama_batch_init(n, 0, 1);
    for (int i = 0; i < n; i++) { b.token[i] = tok[i]; b.pos[i] = i; b.n_seq_id[i] = 1; b.seq_id[i][0] = 0; b.logits[i] = true; }
    b.n_tokens = n;
    int rc = llama_decode(g_ctx, b);
    llama_batch_free(b);
    if (rc < 0) return out;
    const float * e = llama_get_embeddings_seq(g_ctx, 0);
    if (!e) return out;
    const int d = llama_model_n_embd_out(g_model);
    double s = 0; for (int i = 0; i < d; i++) s += (double) e[i] * e[i];
    const float k = s > 0 ? (float) (1.0 / std::sqrt(s)) : 1.0f;
    out.resize(d); for (int i = 0; i < d; i++) out[i] = e[i] * k;
    return out;
}
}  // namespace

#ifdef ATTUNE_EMBED_CLI
// test tool: attune-embed <model.gguf> < lines → one JSON array per line
#include <cstdio>
#include <iostream>
int main(int argc, char ** argv) {
    if (argc < 2) { fprintf(stderr, "usage: %s model.gguf < lines\n", argv[0]); return 1; }
    llama_backend_init();
    ggml_backend_load_all();
    llama_log_set([](ggml_log_level, const char *, void *) {}, nullptr);
    if (!load(argv[1], argc > 2 ? atoi(argv[2]) : 4)) { fprintf(stderr, "could not load\n"); return 1; }
    std::string line;
    while (std::getline(std::cin, line)) {
        auto v = embed(line);
        std::string o = "["; for (size_t i = 0; i < v.size(); i++) { char buf[24]; snprintf(buf, sizeof buf, "%s%.5f", i ? "," : "", v[i]); o += buf; } o += "]";
        printf("%s\n", o.c_str()); fflush(stdout);
    }
    unload();
    return 0;
}
#else
#include <jni.h>
extern "C" {
JNIEXPORT jboolean JNICALL Java_com_aldibiki_attune_EmbedNative_nLoad(JNIEnv * env, jobject, jstring path, jint threads) {
    const char * p = env->GetStringUTFChars(path, nullptr);
    bool ok = load(p, threads);
    env->ReleaseStringUTFChars(path, p);
    return ok ? JNI_TRUE : JNI_FALSE;
}
JNIEXPORT jfloatArray JNICALL Java_com_aldibiki_attune_EmbedNative_nEmbed(JNIEnv * env, jobject, jstring text) {
    const char * t = env->GetStringUTFChars(text, nullptr);
    std::vector<float> v = embed(std::string(t));
    env->ReleaseStringUTFChars(text, t);
    jfloatArray a = env->NewFloatArray((jsize) v.size());
    if (a && !v.empty()) env->SetFloatArrayRegion(a, 0, (jsize) v.size(), v.data());
    return a;
}
JNIEXPORT void JNICALL Java_com_aldibiki_attune_EmbedNative_nFree(JNIEnv *, jobject) {
    std::lock_guard<std::mutex> lk(g_mu);
    unload();
}
}
#endif
