package com.aldibiki.attune

import android.content.Context
import java.io.File
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.ServerSocket
import java.net.URL
import java.security.SecureRandom
import java.util.concurrent.Executors

/**
 * Owns the on-device model server: picks the settings for this phone, starts
 * it, waits until it is really serving, and switches models safely.
 *
 * The server only listens on 127.0.0.1 and requires a per-launch API key, so
 * no other app on the phone can use the model or read what is sent to it.
 */
object Engine {

    enum class State { IDLE, STARTING, READY, ERROR }

    @Volatile var state: State = State.IDLE
        private set
    @Volatile var error: String? = null
        private set
    @Volatile var modelId: String? = null
        private set
    @Volatile var settingsNote: String = ""
        private set

    /** e.g. "ARM · dotprod · int8 matmul · SVE2 · KleidiAI" — what this chip is using. */
    @Volatile var cpuFeatures: String = ""
        private set

    @Volatile private var preloaded = false

    /**
     * Whoever is showing the app right now. The engine outlives any one
     * screen: if the app was closed and reopened while a model loaded, the
     * screen that asked for it is gone, and the "ready" news must reach the
     * new one — otherwise the new screen says "Loading the model…" forever.
     */
    @Volatile var onChange: (() -> Unit)? = null
    private fun changed() { try { onChange?.invoke() } catch (e: Exception) {} }

    /** Load the fastest CPU backend for this chip. Once per process. */
    fun preload(ctx: Context) {
        if (preloaded) return
        EngineNative.nPreload(ctx.applicationInfo.nativeLibraryDir)
        preloaded = true
        cpuFeatures = summarizeFeatures(EngineNative.nSystemInfo())
    }

    private fun summarizeFeatures(info: String): String {
        fun on(k: String) = Regex("\\b$k = 1\\b").containsMatchIn(info)
        val parts = ArrayList<String>()
        if (on("NEON")) parts += "NEON"
        if (on("DOTPROD")) parts += "dotprod"
        if (on("MATMUL_INT8")) parts += "int8 matmul"
        if (on("FP16_VA")) parts += "fp16"
        if (on("SVE2")) parts += "SVE2" else if (on("SVE")) parts += "SVE"
        if (on("SME")) parts += "SME"
        if (on("KLEIDIAI")) parts += "KleidiAI"
        if (on("AVX2")) parts += "AVX2"
        return if (parts.isEmpty()) info.take(160) else parts.joinToString(" · ")
    }

    /** Chosen once per launch: a free port, so nothing else can collide with it. */
    val port: Int by lazy { try { ServerSocket(0).use { it.localPort } } catch (e: Exception) { 18080 } }

    /** Random per launch. Handed only to our own page. */
    val apiKey: String by lazy {
        val b = ByteArray(24); SecureRandom().nextBytes(b)
        b.joinToString("") { "%02x".format(it) }
    }

    val baseUrl: String get() = "http://127.0.0.1:$port"

    private val exec = Executors.newSingleThreadExecutor()
    private var appCtx: Context? = null

    fun logFile(ctx: Context) = File(ctx.filesDir, "engine.log")

    /** Last few KB of the engine log, for the "Engine log" view and bug reports. */
    fun logTail(ctx: Context, maxBytes: Int = 12000): String {
        val f = logFile(ctx)
        if (!f.exists()) return ""
        return try {
            RandomAccessFile(f, "r").use { raf ->
                val len = raf.length()
                val start = (len - maxBytes).coerceAtLeast(0)
                raf.seek(start)
                val buf = ByteArray((len - start).toInt())
                raf.readFully(buf)
                String(buf, Charsets.UTF_8)
            }
        } catch (e: Exception) { "" }
    }

    /** Start (or switch to) a model. onDone runs on the engine thread. */
    fun start(ctx: Context, model: ModelStore.Installed, onDone: (Boolean, String?) -> Unit) {
        appCtx = ctx.applicationContext
        exec.execute {
            val ok = startBlocking(ctx.applicationContext, model)
            changed()
            onDone(ok, error)
        }
    }

    fun stop(onDone: (() -> Unit)? = null) {
        exec.execute { stopBlocking(); changed(); onDone?.invoke() }
    }

    private fun health(): Int = try {
        val c = URL("$baseUrl/health").openConnection() as HttpURLConnection
        c.connectTimeout = 1500; c.readTimeout = 3000
        val code = c.responseCode
        c.disconnect(); code
    } catch (e: Exception) { -1 }

    /** Wait while a model is still loading (the shutdown hook only exists after load). */
    private fun waitWhileLoading(maxMs: Long): Boolean {
        val deadline = System.currentTimeMillis() + maxMs
        while (System.currentTimeMillis() < deadline) {
            if (EngineNative.nState() != 1) return true
            if (health() == 200) return true
            Thread.sleep(250)
        }
        return false
    }

    private fun stopBlocking() {
        if (EngineNative.nState() == 1) {
            waitWhileLoading(4 * 60_000L)
            Thread.sleep(700)  // upstream installs its shutdown hook right after /health turns ready
            EngineNative.nStop(60_000)
        } else {
            EngineNative.nStop(1000)  // reap a thread that already exited
        }
        if (EngineNative.nState() == 1) {
            state = State.ERROR
            error = "The model is still busy and could not be stopped. Close and reopen the app."
        } else {
            state = State.IDLE
            modelId = null
        }
    }

    /**
     * How many tokens of conversation the model can hold. Every token of
     * context costs memory up front, and a phone that runs short of memory
     * does not fail cleanly: it starts swapping, heats up and freezes. So the
     * window is sized for comfort, not for the maximum the model supports.
     * 8K tokens is roughly 12 pages of text, which covers everything the app
     * does on a phone.
     */
    private fun contextFor(ctx: Context, model: ModelStore.Installed): Int {
        val ram = DeviceInfo.ramGB(ctx)
        val share = model.sizeBytes.toDouble() / DeviceInfo.totalRamBytes(ctx).coerceAtLeast(1)
        var c = when {
            ram >= 12 && share < 0.25 -> 16384
            ram >= 8 -> 8192
            ram >= 6 -> 6144
            else -> 4096
        }
        if (share > 0.40) c = 4096
        else if (share > 0.25) c = minOf(c, 8192)
        return c
    }

    /** True when the model is large for this phone: it works, but slowly and warmly. */
    fun isHeavy(ctx: Context, model: ModelStore.Installed): Boolean =
        model.sizeBytes > DeviceInfo.totalRamBytes(ctx) * 0.30

    /** When loading began, for the "loading for 40 s" readout. 0 when not loading. */
    @Volatile var loadStartedAt: Long = 0L
        private set

    /** What the engine is doing right now while it loads, from its own log. */
    fun loadPhase(ctx: Context): String {
        if (state != State.STARTING) return ""
        val tail = logTail(ctx, 4000).lines().filter { it.isNotBlank() }
        val joined = tail.joinToString("\n")
        return when {
            joined.contains("warming up", true) || joined.contains("warmup", true) -> "Warming up"
            joined.contains("clip", true) || joined.contains("mmproj", true) -> "Loading the photo reader"
            joined.contains("llama_context", true) || joined.contains("kv", true) -> "Preparing memory"
            joined.contains("load_tensors", true) || joined.contains("loading model", true) -> "Reading the model file"
            else -> "Starting"
        }
    }

    private fun buildArgs(ctx: Context, model: ModelStore.Installed): Array<String> {
        val nCtx = contextFor(ctx, model)
        val gen = DeviceInfo.generationThreads(ctx)
        val batch = DeviceInfo.batchThreads(ctx)
        val ram = DeviceInfo.ramGB(ctx)
        settingsNote = "context $nCtx · $gen threads (prompt $batch) · flash attention · 8-bit KV cache" +
            (if (cpuFeatures.isNotEmpty()) " · CPU: $cpuFeatures" else "")

        val a = arrayListOf(
            "-m", model.modelFile.absolutePath,
            "--host", "127.0.0.1",
            "--port", port.toString(),
            "--api-key", apiKey,
            "-c", nCtx.toString(),
            "-t", gen.toString(),
            "-tb", batch.toString(),
            "-np", "1",                       // one user, one conversation at a time
            "-fa", "on",                      // flash attention: faster and less memory
            "-ctk", "q8_0", "-ctv", "q8_0",   // 8-bit KV cache: ~half the memory of f16, same answers
            "--cache-reuse", "256",           // reuse the shared prompt prefix between requests
            "--cache-ram", if (ram >= 8) "256" else "0",
            "--jinja",                        // the model's own chat template, incl. thinking switch
            "--no-ui",                        // Attune has its own interface
            "--no-slots",                     // no endpoint that could show recent prompts
            "--threads-http", "2",            // one user; leave the cores for the model
            // Browsers never let "*" stand for the Authorization header, so
            // name it — otherwise the page cannot send its key at all. And only
            // our own page's origin may call the engine.
            "--cors-headers", "Authorization,Content-Type",
            "--cors-origins", "https://appassets.androidplatform.net",
            "--log-file", logFile(ctx).absolutePath,
        )
        val mm = model.mmproj
        if (mm != null && mm.exists()) {
            a += listOf("--mmproj", mm.absolutePath)
            settingsNote += " · reads photos"
        }
        return a.toTypedArray()
    }

    private fun startBlocking(ctx: Context, model: ModelStore.Installed): Boolean {
        if (EngineNative.nState() == 1) stopBlocking()
        if (state == State.ERROR && EngineNative.nState() == 1) return false

        try { preload(ctx) } catch (e: Throwable) {
            state = State.ERROR
            error = "The engine could not start on this processor: ${e.message}"
            return false
        }
        if (!model.modelFile.exists()) {
            state = State.ERROR; error = "The model file is missing. Install it again from Engine."
            return false
        }
        // Android keeps roughly half of a phone's memory for itself and the
        // other apps. A model bigger than that does load — and then swaps,
        // overheats and freezes the phone, which is worse than refusing.
        if (model.sizeBytes > DeviceInfo.totalRamBytes(ctx) * 0.55) {
            state = State.ERROR
            error = "This model is too big for this phone's memory — it would freeze the phone. Pick a smaller one in Engine (Qwen 3.5 4B is the fast choice)."
            return false
        }

        state = State.STARTING
        loadStartedAt = System.currentTimeMillis()
        error = null
        modelId = model.id
        changed()
        try { logFile(ctx).writeText("") } catch (e: Exception) {}

        if (!EngineNative.nStart(buildArgs(ctx, model))) {
            state = State.ERROR; error = "The engine is already running."
            return false
        }

        // A model that fits loads in well under a minute from phone storage.
        // Four minutes without an answer means something is wrong (usually
        // memory), and saying so beats a spinner that never ends.
        val deadline = System.currentTimeMillis() + 4 * 60_000L
        while (System.currentTimeMillis() < deadline) {
            if (EngineNative.nState() == 2) {
                loadStartedAt = 0L
                state = State.ERROR
                error = "The model failed to load. " + lastErrorLine(ctx)
                modelId = null
                return false
            }
            if (health() == 200) {
                Thread.sleep(700)
                state = State.READY
                loadStartedAt = 0L
                return true
            }
            Thread.sleep(300)
        }
        loadStartedAt = 0L
        // Give the memory back rather than leave a half-loaded model behind.
        try { EngineNative.nStop(5000) } catch (e: Throwable) {}
        state = State.ERROR
        error = "The model took too long to load — the phone is probably short of memory. Close other apps, or pick a smaller model in Engine."
        return false
    }

    private fun lastErrorLine(ctx: Context): String {
        val lines = logTail(ctx, 6000).lines().filter { it.isNotBlank() }
        val bad = lines.lastOrNull { it.contains("error", true) || it.contains("failed", true) }
        return (bad ?: lines.lastOrNull() ?: "").take(300)
    }
}
