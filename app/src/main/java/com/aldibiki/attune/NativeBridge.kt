package com.aldibiki.attune

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * window.AttuneNative — what the page can ask the phone to do.
 *
 * Quick calls return a JSON string directly. Slow ones take a request id and
 * answer later through window.__attuneNative.resolve / reject / progress, so
 * the page never freezes while a model downloads or a search runs.
 *
 * Only our own page is ever loaded in this WebView; every other link opens in
 * the browser, so no third-party page can reach this interface.
 */
class NativeBridge(private val ctx: Context, private val web: WebView) {

    private val pool = Executors.newCachedThreadPool()
    private val cancels = ConcurrentHashMap<String, AtomicBoolean>()
    private val conns = ConcurrentHashMap<String, java.net.HttpURLConnection>()

    // ---- replies to the page -------------------------------------------------
    private fun js(code: String) { web.post { web.evaluateJavascript(code, null) } }
    private fun q(s: String) = JSONObject.quote(s)

    private fun resolve(id: String, json: JSONObject) =
        js("window.__attuneNative&&window.__attuneNative.resolve(${q(id)},${q(json.toString())})")

    private fun reject(id: String, msg: String) =
        js("window.__attuneNative&&window.__attuneNative.reject(${q(id)},${q(msg)})")

    private fun progress(id: String, pct: Int, stage: String, detail: String) =
        js("window.__attuneNative&&window.__attuneNative.progress(${q(id)},$pct,${q(stage)},${q(detail)})")

    /** Streamed answer text (and the model's reasoning) as it is written. */
    private fun delta(id: String, content: String, reasoning: String) =
        js("window.__attuneNative&&window.__attuneNative.delta(${q(id)},${q(content)},${q(reasoning)})")

    /** Tell the page the engine changed state (status chip, reconnect). */
    fun announceEngine() = js(
        "window.dispatchEvent(new CustomEvent('attune-engine',{detail:${engineJson()}}))"
    )

    private fun engineJson(): JSONObject {
        val active = Engine.modelId?.let { ModelStore.get(ctx, it) }
        val started = Engine.loadStartedAt
        return JSONObject()
            .put("state", Engine.state.name.lowercase())
            .put("modelId", Engine.modelId ?: JSONObject.NULL)
            .put("error", Engine.error ?: JSONObject.NULL)
            .put("settings", Engine.settingsNote)
            .put("cpu", Engine.cpuFeatures)
            .put("loadingFor", if (started > 0) (System.currentTimeMillis() - started) / 1000 else 0)
            .put("phase", Engine.loadPhase(ctx))
            .put("heavy", active != null && Engine.isHeavy(ctx, active))
            .put("thermal", DeviceInfo.thermalStatus(ctx))
    }

    private fun blockedByAirGap(id: String, what: String): Boolean {
        if (!Prefs.airGap(ctx)) return false
        reject(id, "Offline lock is on — $what needs the internet. Turn the lock off in Engine first.")
        return true
    }

    // ---- quick calls -----------------------------------------------------------
    @JavascriptInterface
    fun info(): String = DeviceInfo.toJson(ctx)
        .put("airGap", Prefs.airGap(ctx))
        .put("engine", engineJson())
        .put("activeModel", Prefs.activeModel(ctx) ?: JSONObject.NULL)
        .toString()

    @JavascriptInterface
    fun setAirGap(on: Boolean) { Prefs.setAirGap(ctx, on) }

    @JavascriptInterface
    fun models(): String {
        val active = Prefs.activeModel(ctx)
        val arr = JSONArray()
        for (m in ModelStore.list(ctx)) arr.put(m.toJson(m.id == active))
        return JSONObject().put("models", arr).put("active", active ?: JSONObject.NULL).toString()
    }

    @JavascriptInterface
    fun remove(modelId: String): Boolean {
        if (Engine.modelId == modelId) Engine.stop { announceEngine() }
        return ModelStore.remove(ctx, modelId)
    }

    @JavascriptInterface
    fun log(): String = Engine.logTail(ctx)

    @JavascriptInterface
    fun engine(): String = engineJson().toString()

    /** Every connection made or refused this session (host + reason only). */
    @JavascriptInterface
    fun netLog(): String = NetLog.toJson().toString()

    @JavascriptInterface
    fun clearNetLog() = NetLog.clear()

    /** Keep the screen on while a long answer is being written, so it isn't paused. */
    @JavascriptInterface
    fun keepAwake(on: Boolean) {
        web.post {
            val w = (web.context as? android.app.Activity)?.window ?: return@post
            val flag = android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            if (on) w.addFlags(flag) else w.clearFlags(flag)
        }
    }

    @JavascriptInterface
    fun cancel(id: String) {
        cancels[id]?.set(true)
        conns.remove(id)?.let { c -> pool.execute { try { c.disconnect() } catch (e: Exception) {} } }
    }

    /**
     * One request to the on-device model, made here rather than from the page.
     * A page on https asking http://127.0.0.1 runs into the browser's CORS,
     * mixed-content and local-network rules; native code does not. With
     * "stream": true the answer arrives piece by piece through delta().
     * Cancelling closes the connection, which makes the engine stop writing.
     */
    @JavascriptInterface
    fun chat(id: String, body: String) {
        val flag = AtomicBoolean(false); cancels[id] = flag
        pool.execute {
            var conn: java.net.HttpURLConnection? = null
            try {
                if (Engine.state == Engine.State.STARTING) throw java.io.IOException("Still loading")
                if (Engine.state != Engine.State.READY) throw java.io.IOException(Engine.error ?: "The model is not running yet — open Engine")
                val stream = JSONObject(body).optBoolean("stream", false)
                conn = (java.net.URL(Engine.baseUrl + "/v1/chat/completions").openConnection() as java.net.HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    connectTimeout = 5000
                    readTimeout = 0                      // a long answer can take minutes
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer " + Engine.apiKey)
                }
                conns[id] = conn
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                if (code !in 200..299) {
                    val err = (conn.errorStream ?: conn.inputStream)?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
                    val msg = try { JSONObject(err).optJSONObject("error")?.optString("message") } catch (e: Exception) { null }
                    throw java.io.IOException(if (msg.isNullOrBlank()) "The model returned HTTP $code" else msg)
                }
                if (!stream) {
                    val txt = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                    resolve(id, JSONObject(txt))
                    return@execute
                }
                val content = StringBuilder(); val reasoning = StringBuilder()
                val pendC = StringBuilder(); val pendR = StringBuilder()
                var stats: JSONObject? = null
                var lastFlush = 0L
                var lastHeatCheck = System.currentTimeMillis()
                var tooHot = false
                conn.inputStream.bufferedReader(Charsets.UTF_8).use { rd ->
                    while (!flag.get()) {
                        val line = rd.readLine() ?: break
                        if (!line.startsWith("data:")) continue
                        val data = line.substring(5).trim()
                        if (data == "[DONE]") break
                        val j = try { JSONObject(data) } catch (e: Exception) { continue }
                        if (j.has("timings") || j.has("usage")) stats = j
                        val d = j.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("delta") ?: continue
                        val c = if (d.isNull("content")) "" else d.optString("content", "")
                        val r = if (d.isNull("reasoning_content")) "" else d.optString("reasoning_content", "")
                        if (c.isEmpty() && r.isEmpty()) continue
                        content.append(c); reasoning.append(r); pendC.append(c); pendR.append(r)
                        val now = System.currentTimeMillis()
                        // A phone at "critical" temperature is about to throttle
                        // hard or shut apps down. Stop and keep what was written.
                        if (now - lastHeatCheck > 3000) {
                            lastHeatCheck = now
                            if (DeviceInfo.thermalStatus(ctx) >= 4) { tooHot = true; flag.set(true) }
                        }
                        if (now - lastFlush > 60) {           // at most ~16 updates a second
                            delta(id, pendC.toString(), pendR.toString())
                            pendC.setLength(0); pendR.setLength(0); lastFlush = now
                        }
                    }
                }
                if (pendC.isNotEmpty() || pendR.isNotEmpty()) delta(id, pendC.toString(), pendR.toString())
                if (tooHot) { reject(id, "Too hot"); return@execute }
                if (flag.get()) { reject(id, "Stopped"); return@execute }
                val out = JSONObject().put("content", content.toString()).put("reasoning", reasoning.toString())
                stats?.let { st ->
                    st.optJSONObject("timings")?.let { out.put("timings", it) }
                    st.optJSONObject("usage")?.let { out.put("usage", it) }
                }
                resolve(id, out)
            } catch (e: Exception) {
                reject(id, if (flag.get()) "Stopped" else (e.message ?: "The model failed"))
            } finally {
                conns.remove(id)
                try { conn?.disconnect() } catch (e: Exception) {}
                cancels.remove(id)
            }
        }
    }

    // ---- read aloud and share -----------------------------------------------------
    // The phone's own text-to-speech voices (offline for installed languages).
    private var tts: android.speech.tts.TextToSpeech? = null
    private var ttsReady = false
    private var ttsPending: Pair<String, String>? = null

    @JavascriptInterface
    fun speak(text: String, lang: String) {
        web.post {
            val t = tts
            if (t == null) {
                ttsPending = text to lang
                tts = android.speech.tts.TextToSpeech(ctx) { status ->
                    ttsReady = status == android.speech.tts.TextToSpeech.SUCCESS
                    ttsPending?.let { (x, l) -> ttsPending = null; say(x, l) }
                }
            } else if (ttsReady) say(text, lang) else ttsPending = text to lang
        }
    }

    private fun say(text: String, lang: String) {
        val t = tts ?: return
        if (!ttsReady) return
        val loc = if (lang.isNotBlank()) java.util.Locale.forLanguageTag(lang) else java.util.Locale.getDefault()
        try { t.language = loc } catch (e: Exception) {}
        // Long answers are split: one utterance has a length limit.
        val chunks = text.chunked(3500)
        chunks.forEachIndexed { i, c ->
            t.speak(c, if (i == 0) android.speech.tts.TextToSpeech.QUEUE_FLUSH else android.speech.tts.TextToSpeech.QUEUE_ADD, null, "attune-$i")
        }
    }

    @JavascriptInterface
    fun stopSpeaking() { web.post { try { tts?.stop() } catch (e: Exception) {} } }

    /** The phone's share sheet: WhatsApp, email, notes… */
    @JavascriptInterface
    fun share(text: String) {
        web.post {
            try {
                val i = android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain")
                    .putExtra(android.content.Intent.EXTRA_TEXT, text)
                ctx.startActivity(android.content.Intent.createChooser(i, null).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (e: Exception) {}
        }
    }

    fun release() { try { tts?.shutdown() } catch (e: Exception) {}; tts = null }

    // ---- voice -----------------------------------------------------------------
    var voice: Voice? = null
    var askMic: (() -> Unit)? = null
    var lastVoiceSink: Voice.Sink? = null

    /** Speech to text. Words arrive through progress(id, 0, "partial", text). */
    @JavascriptInterface
    fun listen(id: String, lang: String) {
        val v = voice ?: return reject(id, "Voice input is not available")
        val sink = object : Voice.Sink {
            override fun partial(text: String) = progress(id, 0, "partial", text)
            override fun done(text: String) = resolve(id, JSONObject().put("text", text))
            override fun failed(message: String) = reject(id, message)
        }
        lastVoiceSink = sink
        v.start(lang, sink) { askMic?.invoke() }
    }

    @JavascriptInterface
    fun stopListening() { voice?.stop() }

    // ---- slow calls ------------------------------------------------------------

    /**
     * Install a model and switch to it. arg is one of:
     *   {id,label,repo,quant,vision,ctx}      — a model from the app's list
     *   {id?,label?,url,mmprojUrl?,ctx?}      — any .gguf link (bring your own)
     *   {spec:"owner/repo:QUANT",vision?}     — any Hugging Face GGUF repo
     */
    @JavascriptInterface
    fun install(id: String, arg: String) {
        if (blockedByAirGap(id, "downloading a model")) return
        val flag = AtomicBoolean(false); cancels[id] = flag
        pool.execute {
            try {
                val a = JSONObject(arg)
                var repo = a.optString("repo")
                var quant = a.optString("quant")
                val url = a.optString("url")
                val spec = a.optString("spec")
                if (spec.contains(":") && !spec.startsWith("http")) {
                    repo = spec.substringBefore(":").trim(); quant = spec.substringAfter(":").trim()
                }
                val vision = a.optBoolean("vision", true)
                val ctxLen = a.optInt("ctx", 8192)

                progress(id, 0, "Finding the files", "")
                val plan: ModelStore.Plan
                val modelId: String
                val label: String
                val source: String
                if (url.startsWith("https://")) {
                    plan = ModelStore.resolveUrl(url, a.optString("mmprojUrl").ifBlank { null })
                    modelId = a.optString("id").ifBlank { "custom-" + Integer.toHexString(url.hashCode()) }
                    label = a.optString("label").ifBlank { url.substringAfterLast('/').substringBefore('?') }
                    source = url
                } else {
                    require(repo.contains("/") && quant.isNotBlank()) { "Give a Hugging Face repo and a quantization, like unsloth/Qwen3.5-4B-GGUF:Q4_K_M" }
                    plan = ModelStore.resolveHf(repo, quant, vision)
                    modelId = a.optString("id").ifBlank { "hf-" + Integer.toHexString("$repo:$quant".hashCode()) }
                    label = a.optString("label").ifBlank { repo.substringAfter('/') + " " + quant }
                    source = "$repo:$quant"
                }

                val installed = ModelStore.install(ctx, modelId, label, ctxLen, source, quant, plan,
                    onProgress = { done, total, stage ->
                        val pct = if (total > 0) ((done * 100) / total).toInt().coerceIn(0, 99) else 0
                        progress(id, pct, stage, "%.2f / %.2f GB".format(done / 1e9, total / 1e9))
                    },
                    cancelled = { flag.get() })

                Prefs.setActiveModel(ctx, installed.id)
                progress(id, 99, "Loading the model", "")
                Engine.start(ctx, installed) { ok, err ->
                    announceEngine()
                    if (ok) resolve(id, JSONObject().put("ok", true).put("model", installed.toJson(true)).put("engine", engineJson()))
                    else reject(id, err ?: "The model could not be loaded")
                }
            } catch (e: ModelStore.Cancelled) {
                reject(id, "Download cancelled — it will resume where it stopped if you start it again.")
            } catch (e: Exception) {
                reject(id, e.message ?: "Install failed")
            } finally {
                cancels.remove(id)
            }
        }
    }

    /** Switch to an already-installed model. */
    @JavascriptInterface
    fun use(id: String, modelId: String) {
        val m = ModelStore.get(ctx, modelId) ?: return reject(id, "That model is not installed")
        Prefs.setActiveModel(ctx, m.id)
        Engine.start(ctx, m) { ok, err ->
            announceEngine()
            if (ok) resolve(id, JSONObject().put("ok", true).put("model", m.toJson(true)).put("engine", engineJson()))
            else reject(id, err ?: "The model could not be loaded")
        }
    }

    /** Restart the engine with the active model (e.g. after the phone cooled down). */
    @JavascriptInterface
    fun restart(id: String, unused: String) {
        val m = ModelStore.active(ctx) ?: return reject(id, "No model installed yet")
        use(id, m.id)
    }

    /** Web search: {q, provider: "duckduckgo"|"brave", key?, pages?} */
    @JavascriptInterface
    fun search(id: String, arg: String) {
        if (blockedByAirGap(id, "web lookup")) return
        pool.execute {
            try {
                val a = JSONObject(arg)
                val r = WebTools.search(a.optString("provider", "duckduckgo"), a.getString("q"),
                    a.optString("key"), a.optInt("pages", 3))
                resolve(id, r)
            } catch (e: Exception) { reject(id, e.message ?: "Search failed") }
        }
    }

    /** Readable text of one page. */
    @JavascriptInterface
    fun fetchText(id: String, url: String) {
        if (blockedByAirGap(id, "opening a page")) return
        pool.execute {
            val t = WebTools.pageText(url, 12000)
            if (t.isEmpty()) reject(id, "Could not read that page") else resolve(id, JSONObject().put("url", url).put("text", t))
        }
    }

    /** SHA-256 of the weights in use: proof that the model has not changed. */
    @JavascriptInterface
    fun hash(id: String, modelId: String) {
        pool.execute {
            try { resolve(id, JSONObject().put("id", modelId).put("sha256", ModelStore.sha256(ctx, modelId))) }
            catch (e: Exception) { reject(id, e.message ?: "Could not read the model") }
        }
    }
}
