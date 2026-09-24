package com.aldibiki.attune

import android.content.Context
import android.util.Base64
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.ExperimentalApi
import com.google.ai.edge.litertlm.ExperimentalFlags
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.ThinkingConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import com.google.ai.edge.litertlm.Engine as LlmEngine

/**
 * The fast engine: Google's LiteRT-LM running a .litertlm model (Gemma 4 E2B /
 * E4B) on the phone's GPU.
 *
 * Why a second engine: llama.cpp on a phone CPU writes a 4B model at roughly
 * 10–20 words a second at best, and reads a long prompt at ~50–100 tokens a
 * second — a 2,000-token question then waits 20–40 s before the first word.
 * LiteRT-LM runs Gemma 4 on the Adreno GPU through OpenCL, reads the prompt at
 * thousands of tokens a second (first word in well under a second) and writes
 * with multi-token prediction (the model's own built-in drafter guesses several
 * words ahead, the model checks them in one pass — same answer, faster).
 *
 * Every start is tried in order, most capable first, and the first that works
 * is kept: GPU + photos + multi-token prediction → GPU + photos → GPU → CPU +
 * photos → CPU. What was actually used is reported, never assumed.
 */
object FastEngine {

    fun isFast(m: ModelStore.Installed?): Boolean = m != null && m.modelFile.name.endsWith(".litertlm", ignoreCase = true)

    @Volatile private var engine: LlmEngine? = null
    @Volatile var backend: String = ""       // "GPU" or "CPU" — what really loaded
        private set
    @Volatile var vision: Boolean = false
        private set
    @Volatile var mtp: Boolean = false       // multi-token prediction switched on explicitly
        private set
    @Volatile var context: Int = 0
        private set
    @Volatile var lastError: String = ""
        private set

    /** One answer at a time: the phone has one GPU, and the person's question comes first. */
    private val turn = Semaphore(1)
    @Volatile private var current: Conversation? = null
    @Volatile private var currentId: String? = null

    private fun contextFor(ctx: Context): Int = when {
        DeviceInfo.ramGB(ctx) >= 8 -> 8192
        else -> 4096
    }

    private data class Try(val gpu: Boolean, val vision: Boolean, val mtp: Boolean?)

    /** Load a .litertlm model. Blocking; returns null when it works, or why it didn't. */
    @OptIn(ExperimentalApi::class)
    fun load(ctx: Context, model: ModelStore.Installed): String? {
        close()
        val preferGpu = !Prefs.fastCpu(ctx)
        val tries = ArrayList<Try>()
        if (preferGpu) tries += listOf(Try(true, true, true), Try(true, true, null), Try(true, false, null))
        tries += listOf(Try(false, true, null), Try(false, false, null))
        // The GPU kernels are compiled once and kept here, so later starts are quick.
        val cache = File(ctx.cacheDir, "litert").apply { mkdirs() }.absolutePath
        val nCtx = contextFor(ctx)
        val threads = DeviceInfo.generationThreads(ctx)
        val errors = ArrayList<String>()
        for (t in tries) {
            var e: LlmEngine? = null
            try {
                ExperimentalFlags.enableBenchmark = true          // real speed numbers for every answer
                ExperimentalFlags.enableSpeculativeDecoding = t.mtp
                val main: Backend = if (t.gpu) Backend.GPU() else Backend.CPU(threadCount = threads)
                val vis: Backend? = if (!t.vision) null else if (t.gpu) Backend.GPU() else Backend.CPU(threadCount = threads)
                // Crash guard: a graphics driver can take the whole app down.
                if (t.gpu) Prefs.setFastTrial(ctx, true)
                e = LlmEngine(EngineConfig(
                    modelPath = model.modelFile.absolutePath,
                    backend = main,
                    visionBackend = vis,
                    audioBackend = null,
                    maxNumTokens = nCtx,
                    maxNumImages = if (t.vision) 1 else null,
                    cacheDir = cache,
                ))
                e.initialize()
                Prefs.setFastTrial(ctx, false)
                engine = e
                backend = if (t.gpu) "GPU" else "CPU"
                vision = t.vision
                mtp = t.mtp == true
                context = nCtx
                lastError = ""
                if (preferGpu && !t.gpu) {
                    Prefs.setFastNote(ctx, "The GPU would not start, so the fast engine is on the CPU. " + errors.lastOrNull().orEmpty())
                }
                return null
            } catch (x: Throwable) {
                Prefs.setFastTrial(ctx, false)
                errors += "${if (t.gpu) "GPU" else "CPU"}${if (t.vision) "+photos" else ""}${if (t.mtp == true) "+MTP" else ""}: ${x.message ?: x.javaClass.simpleName}".take(240)
                try { e?.close() } catch (y: Throwable) {}
            }
        }
        lastError = errors.joinToString("\n")
        try { File(ctx.filesDir, "engine.log").writeText("LiteRT-LM could not load ${model.modelFile.name}\n$lastError\n") } catch (x: Exception) {}
        return "The fast engine could not load this model. " + (errors.lastOrNull() ?: "")
    }

    fun loaded(): Boolean = engine != null

    fun close() {
        try { current?.cancelProcess() } catch (e: Throwable) {}
        // wait (briefly) for a running answer to let go of the engine
        val got = try { turn.tryAcquire(10, TimeUnit.SECONDS) } catch (e: InterruptedException) { false }
        try { engine?.close() } catch (e: Throwable) {}
        engine = null; backend = ""; vision = false; mtp = false; context = 0
        if (got) turn.release()
    }

    /** Stop the answer being written for request `id` (if it is the current one). */
    fun cancel(id: String) {
        if (currentId == id) try { current?.cancelProcess() } catch (e: Throwable) {}
    }

    /** "data:image/jpeg;base64,…" → bytes. */
    private fun dataUri(u: String): ByteArray? = try {
        if (!u.startsWith("data:")) null else Base64.decode(u.substringAfter("base64,", ""), Base64.DEFAULT)
    } catch (e: Exception) { null }

    /** OpenAI-style content (a string, or text/image_url parts) → LiteRT contents. */
    private fun contentsOf(c: Any?, allowImages: Boolean): Contents {
        if (c is JSONArray) {
            val parts = ArrayList<Content>()
            for (i in 0 until c.length()) {
                val p = c.optJSONObject(i) ?: continue
                when (p.optString("type")) {
                    "text" -> parts += Content.Text(p.optString("text"))
                    "image_url" -> if (allowImages) {
                        val url = p.optJSONObject("image_url")?.optString("url") ?: p.optString("image_url")
                        dataUri(url)?.let { parts += Content.ImageBytes(it) }
                    }
                }
            }
            // LiteRT-LM expects the text first, then the photo.
            parts.sortBy { if (it is Content.Text) 0 else 1 }
            return if (parts.isEmpty()) Contents.of("") else Contents.of(parts)
        }
        return Contents.of(if (c == null || c == JSONObject.NULL) "" else c.toString())
    }

    private fun textOf(c: Any?): String = when (c) {
        is JSONArray -> (0 until c.length()).mapNotNull { c.optJSONObject(it) }.filter { it.optString("type") == "text" }.joinToString("\n") { it.optString("text") }
        null, JSONObject.NULL -> ""
        else -> c.toString()
    }

    /**
     * One chat request in the same shape the page sends llama.cpp
     * (/v1/chat/completions body), answered in the same shape it gets back:
     * {content, reasoning, timings:{prompt_per_second, predicted_per_second, …}}.
     */
    @OptIn(ExperimentalApi::class)
    fun chat(
        ctx: Context, id: String, body: JSONObject, cancelled: AtomicBoolean,
        onDelta: (String, String) -> Unit,
    ): JSONObject {
        val eng = engine ?: throw java.io.IOException("The fast engine is not running — open Engine")
        if (!turn.tryAcquire(120, TimeUnit.SECONDS)) throw java.io.IOException("The model is busy — try again")
        var conv: Conversation? = null
        try {
            if (cancelled.get()) throw java.io.IOException("Stopped")
            val msgs = body.optJSONArray("messages") ?: JSONArray()
            var system: String? = null
            val history = ArrayList<Message>()
            var last: Contents? = null
            val n = msgs.length()
            for (i in 0 until n) {
                val m = msgs.optJSONObject(i) ?: continue
                val content = m.opt("content")
                when (m.optString("role")) {
                    "system" -> system = listOfNotNull(system, textOf(content)).joinToString("\n\n")
                    "assistant", "model" -> history += Message.model(textOf(content))
                    else -> if (i == n - 1) last = contentsOf(content, vision) else history += Message.user(textOf(content))
                }
            }
            val grammar = body.has("grammar")
            if (grammar) {
                // No GBNF here: the same JSON shape is asked for in words, and the
                // reply is trimmed to the JSON object (the page checks it).
                system = listOfNotNull(system, "Reply with ONLY the JSON object described above. No other text, no code fences.").joinToString("\n\n")
            }
            val question = last ?: run {
                // The page always ends with the person's message; if not, repeat the last turn.
                if (history.isNotEmpty() && history.last().toString().isNotBlank()) Contents.of(history.removeAt(history.size - 1).toString()) else Contents.of("")
            }

            val temp = if (body.has("temperature")) body.optDouble("temperature", 0.3) else 0.3
            val sampler = if (temp <= 0.0) SamplerConfig(topK = 1, topP = 1.0, temperature = 1.0, seed = body.optInt("seed", 0))
                else SamplerConfig(topK = body.optInt("top_k", 64).coerceAtLeast(1), topP = body.optDouble("top_p", 0.95), temperature = temp, seed = body.optInt("seed", 0))
            val think = body.optJSONObject("chat_template_kwargs")?.optBoolean("enable_thinking", false) ?: false
            val maxOut = body.optInt("max_tokens", 900).coerceIn(16, context.coerceAtLeast(1024))

            val cv = eng.createConversation(ConversationConfig(
                systemInstruction = system?.let { Contents.of(it) },
                initialMessages = history,
                samplerConfig = sampler,
                automaticToolCalling = false,
            ))
            conv = cv; current = cv; currentId = id

            val content = StringBuilder(); val reasoning = StringBuilder()
            val pendC = StringBuilder(); val pendR = StringBuilder()
            val done = CountDownLatch(1)
            var failure: Throwable? = null
            var lastFlush = 0L
            var lastHeat = System.currentTimeMillis()
            var tooHot = false
            val t0 = System.currentTimeMillis()
            var firstAt = 0L
            var chunks = 0
            val cb = object : MessageCallback {
                override fun onMessage(message: Message) {
                    val c = message.contents.contents.filterIsInstance<Content.Text>().joinToString("") { it.text }
                    val r = message.channels.values.joinToString("")
                    if (c.isEmpty() && r.isEmpty()) return
                    if (firstAt == 0L) firstAt = System.currentTimeMillis()
                    chunks++
                    synchronized(content) {
                        content.append(c); reasoning.append(r); pendC.append(c); pendR.append(r)
                        val now = System.currentTimeMillis()
                        if (now - lastHeat > 3000) {
                            lastHeat = now
                            if (DeviceInfo.thermalStatus(ctx) >= 4) { tooHot = true; cancelled.set(true); try { cv.cancelProcess() } catch (e: Throwable) {} }
                        }
                        if (now - lastFlush > 60 && !grammar) {
                            onDelta(pendC.toString(), pendR.toString()); pendC.setLength(0); pendR.setLength(0); lastFlush = now
                        }
                    }
                    if (cancelled.get()) try { cv.cancelProcess() } catch (e: Throwable) {}
                }
                override fun onDone() { done.countDown() }
                override fun onError(throwable: Throwable) { failure = throwable; done.countDown() }
            }
            cv.sendMessageAsync(
                Message.user(question), cb,
                maxOutputToken = maxOut,
                thinkingConfig = if (think) ThinkingConfig(enableThinking = true, thinkingTokenBudget = body.optInt("thinking_budget_tokens", -1)) else null,
            )
            // Wait for the end; if Stop was pressed, make sure the engine hears it.
            while (!done.await(200, TimeUnit.MILLISECONDS)) {
                if (cancelled.get()) try { cv.cancelProcess() } catch (e: Throwable) {}
            }
            synchronized(content) {
                if (!grammar && (pendC.isNotEmpty() || pendR.isNotEmpty())) onDelta(pendC.toString(), pendR.toString())
            }
            if (tooHot) throw java.io.IOException("Too hot")
            if (cancelled.get()) throw java.io.IOException("Stopped")
            failure?.let { throw java.io.IOException(it.message ?: "The model failed") }

            var text = content.toString()
            if (grammar) {
                val a = text.indexOf('{'); val b = text.lastIndexOf('}')
                if (a >= 0 && b > a) text = text.substring(a, b + 1)
                onDelta(text, "")
            }
            val ms = (System.currentTimeMillis() - t0).coerceAtLeast(1)
            val timings = JSONObject()
            try {
                val bi = cv.getBenchmarkInfo()
                timings.put("prompt_n", bi.lastPrefillTokenCount).put("predicted_n", bi.lastDecodeTokenCount)
                    .put("prompt_per_second", bi.lastPrefillTokensPerSecond)
                    .put("predicted_per_second", bi.lastDecodeTokensPerSecond)
                    .put("ttft_ms", (bi.timeToFirstTokenInSecond * 1000).toLong())
            } catch (e: Throwable) {
                // No benchmark numbers from this build: estimate from the stream.
                val writeMs = (System.currentTimeMillis() - (if (firstAt > 0) firstAt else t0)).coerceAtLeast(1)
                val approxTokens = (text.length / 3.5).toInt().coerceAtLeast(chunks)
                timings.put("predicted_n", approxTokens).put("predicted_per_second", approxTokens * 1000.0 / writeMs)
                    .put("ttft_ms", if (firstAt > 0) firstAt - t0 else ms)
            }
            timings.put("engine", "litert").put("backend", backend).put("mtp", mtp)
            return JSONObject().put("content", text).put("reasoning", reasoning.toString()).put("timings", timings)
                .put("usage", JSONObject().put("completion_tokens", timings.optInt("predicted_n")).put("prompt_tokens", timings.optInt("prompt_n")))
        } finally {
            current = null; currentId = null
            try { conv?.close() } catch (e: Throwable) {}
            turn.release()
        }
    }

    /** At launch: a fast-engine GPU start that never finished means the driver crashed the app. */
    fun checkCrash(ctx: Context) {
        if (Prefs.fastTrial(ctx)) {
            Prefs.setFastTrial(ctx, false)
            Prefs.setFastCpu(ctx, true)
            Prefs.setFastNote(ctx, "Last time, starting the fast engine on the GPU closed the app. It is on the CPU now; you can try the GPU again in Engine → Speed.")
        }
    }

    fun settingsNote(): String = listOfNotNull(
        "Fast engine (LiteRT-LM) on the $backend",
        "context $context",
        if (mtp) "multi-token prediction" else null,
        if (vision) "reads photos" else null,
        "weights in RAM",
    ).joinToString(" · ")
}
