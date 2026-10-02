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
    private val imageJobs = ConcurrentHashMap<String, ImageRun.Job>()

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
            .put("engine", Engine.kind)
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

    /** Text size for the whole app (percent of normal), kept across launches. */
    @JavascriptInterface
    fun setTextZoom(pct: Int) {
        val z = pct.coerceIn(70, 140)
        ctx.getSharedPreferences("attune", Context.MODE_PRIVATE).edit().putInt("text_zoom", z).apply()
        web.post { web.settings.textZoom = z }
    }

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
        // Full speed even if the person switches apps while it writes.
        GenService.set(ctx.applicationContext, on)
    }

    /** A line from the page into Engine → Engine log (screen errors). (v5.19) */
    @JavascriptInterface
    fun logLine(text: String) {
        try { java.io.File(ctx.filesDir, "engine.log").appendText("\n${java.util.Date()}: ${text.take(500)}\n") } catch (e: Exception) {}
    }

    /** Studio's Stop: the only way a picture is stopped. (v5.19) */
    @JavascriptInterface
    fun cancelImage(id: String) { imageJobs.remove(id)?.cancel() }

    @JavascriptInterface
    fun cancel(id: String) {
        cancels[id]?.set(true)
        FastEngine.cancel(id)
        // (pictures are NOT stopped here any more — only by cancelImage, from
        //  Studio's own Stop button; a stray cancel ended pictures silently. v5.19)
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
                if (Engine.kind == "litert") {
                    // The fast engine: no server in between, the answer streams straight here.
                    val out = FastEngine.chat(ctx, id, JSONObject(body), flag) { c, r -> delta(id, c, r) }
                    resolve(id, out)
                    return@execute
                }
                // v6.8: a photo, and the model started without its photo reader to save memory → load it now
                if (body.contains("\"image_url\"") && !Engine.photosLoaded) {
                    if (!Engine.ensurePhotos(ctx)) throw java.io.IOException("The photo reader could not be loaded — the phone may be short of memory. Close other apps and try again.")
                }
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

    // ---- files: backups ------------------------------------------------------------
    /** Set by MainActivity: opens Android's "Save to…" picker and returns the chosen place. */
    var createDocument: ((name: String, mime: String, done: (android.net.Uri?) -> Unit) -> Unit)? = null

    /**
     * Save text (an encrypted backup) to a file the user picks: Downloads,
     * Google Drive, a USB stick. arg = {name, mime, text}. Resolves {ok, name}.
     */
    @JavascriptInterface
    fun saveFile(id: String, arg: String) {
        val a = try { JSONObject(arg) } catch (e: Exception) { return reject(id, "Bad request") }
        val name = a.optString("name", "Attune-backup.attune").replace(Regex("[\\\\/:*?\"<>|]"), "_")
        val mime = a.optString("mime", "application/octet-stream")
        val text = a.optString("text")
        val open = createDocument ?: return reject(id, "Saving files is not available")
        web.post {
            open(name, mime) { uri ->
                if (uri == null) { reject(id, "Cancelled"); return@open }
                pool.execute {
                    try {
                        // v5.17: binary files (an Excel workbook) come as base64
                        val bytes = if (a.has("b64")) android.util.Base64.decode(a.optString("b64"), android.util.Base64.DEFAULT) else text.toByteArray(Charsets.UTF_8)
                        ctx.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(bytes) }
                        val shown = try {
                            ctx.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)
                                ?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
                        } catch (e: Exception) { null }
                        resolve(id, JSONObject().put("ok", true).put("name", shown ?: name))
                    } catch (e: Exception) { reject(id, "Could not write the file: " + (e.message ?: "")) }
                }
            }
        }
    }

    // A small private stash in the app's own storage (not shared, not backed
    // up by Android): the phone's data just before a restore, so it can be undone.
    private fun stashFile(name: String): java.io.File? =
        if (Regex("^[a-z0-9][a-z0-9._-]{0,63}$").matches(name)) java.io.File(ctx.filesDir, "stash/$name") else null

    @JavascriptInterface
    fun stashPut(name: String, text: String): Boolean = try {
        val f = stashFile(name) ?: throw IllegalArgumentException()
        f.parentFile?.mkdirs(); f.writeText(text, Charsets.UTF_8); true
    } catch (e: Exception) { false }

    @JavascriptInterface
    fun stashGet(name: String): String = try { stashFile(name)?.takeIf { it.exists() }?.readText(Charsets.UTF_8) ?: "" } catch (e: Exception) { "" }

    @JavascriptInterface
    fun stashDel(name: String): Boolean = try { stashFile(name)?.delete() ?: false } catch (e: Exception) { false }

    // ---- reminders and phone actions ------------------------------------------------
    var askNotify: (() -> Unit)? = null
    var askHealth: (() -> Unit)? = null
    var askHuawei: (() -> Unit)? = null
    val billing = Billing(ctx)

    // ---- v6.3 watches through Health Connect (read only) --------------------------------------
    /** "ready" | "update" | "none", and how many of Attune's health permissions are granted. */
    @JavascriptInterface
    fun healthStatus(): String = try {
        JSONObject().put("available", Health.availability(ctx)).put("granted", Health.granted(ctx).count { it in Health.PERMISSIONS }).put("of", Health.PERMISSIONS.size)
            .put("huawei", Health.installed(ctx, Health.HUAWEI)).put("healthSync", Health.installed(ctx, Health.HEALTH_SYNC)).toString()
    } catch (e: Throwable) { JSONObject().put("available", "none").put("error", e.message ?: "").toString() }

    /** Health Connect's permission screen (or its Play Store page when it must be installed/updated). */
    @JavascriptInterface
    fun healthConnect() {
        if (Health.availability(ctx) == "update") {
            try { ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("market://details?id=com.google.android.apps.healthdata&url=healthconnect%3A%2F%2Fonboarding"))
                .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) {}
            return
        }
        askHealth?.invoke()
    }

    // ---- v6.7 Google Play Billing -------------------------------------------------------------
    @JavascriptInterface fun storeProducts(id: String, arg: String) { billing.products { resolve(id, it) } }
    @JavascriptInterface fun storeBuy(id: String, arg: String) { billing.buy(JSONObject(arg).optString("sku")) { resolve(id, it) } }
    @JavascriptInterface fun storeOwned(id: String, arg: String) { billing.owned { resolve(id, it) } }
    @JavascriptInterface fun storeConsume(id: String, arg: String) { billing.consume(JSONObject(arg).optString("token")) { resolve(id, it) } }

    // ---- v6.5 Huawei Health directly, through Huawei's Health Kit (read only) ----
    /** {configured, hms, app, authorized} */
    @JavascriptInterface
    fun huaweiStatus(): String = try { HuaweiHealth.status(ctx).toString() } catch (e: Throwable) { JSONObject().put("configured", false).put("error", e.message ?: "").toString() }

    /** Huawei ID sign-in + Health Kit permissions; the answer comes as the 'attune-health-permission' event. */
    @JavascriptInterface
    fun huaweiConnect() { askHuawei?.invoke() }

    /** One day from Huawei Health ({date: "yyyy-mm-dd"}), same shape as healthDay. */
    @JavascriptInterface
    fun huaweiDay(id: String, arg: String) {
        pool.execute {
            try { resolve(id, HuaweiHealth.day(ctx, JSONObject(arg).optString("date"))) }
            catch (e: Throwable) { reject(id, e.message ?: "Couldn't read Huawei Health") }
        }
    }

    /** Opens Huawei Health or Health Sync (installed), else its Play Store / AppGallery page — only these two. */
    @JavascriptInterface
    fun openHealthApp(pkg: String) {
        if (pkg != Health.HUAWEI && pkg != Health.HEALTH_SYNC && pkg != HuaweiHealth.HMS_CORE) return
        val launch = if (Health.installed(ctx, pkg)) ctx.packageManager.getLaunchIntentForPackage(pkg) else null
        val intents = listOfNotNull(launch,
            android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("market://details?id=$pkg")),
            android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("appmarket://details?id=$pkg")),   // Huawei AppGallery
            android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://play.google.com/store/apps/details?id=$pkg")))
        for (i in intents) {
            try { ctx.startActivity(i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)); return } catch (e: Exception) {}
        }
    }

    /** One day's steps, calories burned, distance, heart rate and workouts ({date: "yyyy-mm-dd"}). */
    @JavascriptInterface
    fun healthDay(id: String, arg: String) {
        pool.execute {
            try { resolve(id, Health.day(ctx, JSONObject(arg).optString("date"))) }
            catch (e: Throwable) { reject(id, e.message ?: "Couldn't read Health Connect") }
        }
    }

    /** {id, at, title, body, repeat} → rung by Reminders even when the app is closed. */
    @JavascriptInterface
    fun schedule(json: String): String = try {
        val ok = Reminders.schedule(ctx, JSONObject(json))
        JSONObject().put("ok", ok).put("exact", Reminders.canExact(ctx)).put("notify", notifyAllowed()).toString()
    } catch (e: Exception) { JSONObject().put("ok", false).put("error", e.message ?: "").toString() }

    @JavascriptInterface
    fun unschedule(id: String): Boolean = Reminders.unschedule(ctx, id)

    /** What the phone will ring, for the page to reconcile with its own list. */
    @JavascriptInterface
    fun scheduled(): String = Reminders.all(ctx).toString()

    /** True when reminders can ring on the minute (Android 12+ "Alarms & reminders"). */
    @JavascriptInterface
    fun canExact(): Boolean = Reminders.canExact(ctx)

    @JavascriptInterface
    fun notifyAllowed(): Boolean =
        android.os.Build.VERSION.SDK_INT < 33 ||
            ctx.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED

    /** Ask once for permission to show notifications (Android 13+). */
    @JavascriptInterface
    fun askNotifications() { web.post { askNotify?.invoke() } }

    /** Open Settings at "Alarms & reminders" for Attune. */
    @JavascriptInterface
    fun askExact() {
        web.post {
            try {
                val i = if (android.os.Build.VERSION.SDK_INT >= 31)
                    android.content.Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, android.net.Uri.parse("package:" + ctx.packageName))
                else android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:" + ctx.packageName))
                ctx.startActivity(i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (e: Exception) {}
        }
    }

    /** A confirmed alarm / timer / calendar event / WhatsApp message / call, handed to its app. */
    @JavascriptInterface
    fun intent(json: String): String = try {
        val a = JSONObject(json)
        var out = JSONObject()
        val latch = java.util.concurrent.CountDownLatch(1)
        web.post { out = PhoneActions.open(ctx, a); latch.countDown() }
        latch.await(3, java.util.concurrent.TimeUnit.SECONDS)
        out.toString()
    } catch (e: Exception) { JSONObject().put("ok", false).put("error", e.message ?: "").toString() }

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

                if (a.optBoolean("draft", false)) {
                    // The small helper model for speculative decoding: kept, not switched to.
                    Prefs.setDraftModel(ctx, installed.id)
                    Prefs.setDraft(ctx, true)
                    progress(id, 99, "Loading the model", "")
                    val m = ModelStore.active(ctx)
                    if (m == null) { resolve(id, JSONObject().put("ok", true).put("draft", installed.toJson(false))); return@execute }
                    Engine.start(ctx, m) { ok, err ->
                        announceEngine()
                        if (ok) resolve(id, JSONObject().put("ok", true).put("draft", installed.toJson(false)).put("engine", engineJson()))
                        else reject(id, err ?: "The model could not be loaded")
                    }
                    return@execute
                }
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

    /** Wake the engine: if it is asleep and a model is installed, load the one used last (or the newest).
     *  Returns "ready", "starting" or "none" (no model installed). Never starts it twice. */
    @Volatile private var wakingUntil = 0L
    @JavascriptInterface @Synchronized
    fun wake(): String {
        if (Engine.state == Engine.State.READY) return "ready"
        if (Engine.state == Engine.State.STARTING || System.currentTimeMillis() < wakingUntil) return "starting"
        wakingUntil = System.currentTimeMillis() + 4000   // Engine.start runs on another thread: don't start twice
        val m = ModelStore.active(ctx) ?: ModelStore.list(ctx).lastOrNull() ?: return "none"
        Prefs.setActiveModel(ctx, m.id)
        Engine.start(ctx, m) { _, _ -> announceEngine() }
        return "starting"
    }

    // ---- speed doctor ---------------------------------------------------------------
    /** Everything that decides speed, read from the phone and the engine's own log. */
    @JavascriptInterface
    fun doctor(): String {
        val log = Engine.logTail(ctx, 60000)
        fun grab(re: String) = Regex(re).find(log)?.value ?: ""
        val active = ModelStore.active(ctx)
        return JSONObject()
            .put("model", active?.label ?: JSONObject.NULL)
            .put("modelGB", active?.let { it.sizeBytes / 1e9 } ?: 0)
            .put("ramGB", DeviceInfo.ramGB(ctx))
            .put("availRamGB", DeviceInfo.availRamBytes(ctx) / 1e9)
            .put("cores", DeviceInfo.cores()).put("bigCores", DeviceInfo.bigCores())
            .put("genThreads", DeviceInfo.generationThreads(ctx))
            .put("thermal", DeviceInfo.thermalStatus(ctx)).put("powerSave", DeviceInfo.powerSave(ctx))
            .put("cpu", Engine.cpuFeatures).put("gpu", Engine.gpuName).put("settings", Engine.settingsNote)
            .put("engine", Engine.kind).put("fastBackend", FastEngine.backend).put("fastMtp", FastEngine.mtp)
            .put("sysInfo", grab("system_info:[^\\n]*").take(400))
            .put("buffers", Regex("(CPU_Mapped|CPU_REPACK|CPU|OpenCL)[^\\n]*model buffer size[^\\n]*").findAll(log).map { it.value }.joinToString("\n").take(600))
            .put("mmap", !Engine.settingsNote.contains("in RAM"))
            .put("logTail", log.takeLast(3000))
            .toString()
    }

    // ---- speed: GPU, draft model --------------------------------------------------
    /** What Engine → Speed shows. */
    @JavascriptInterface
    fun speed(): String {
        val draft = Prefs.draftModel(ctx)?.let { ModelStore.get(ctx, it) }
        val active = ModelStore.active(ctx)
        return JSONObject()
            .put("gpuBuilt", Engine.gpuBuilt(ctx))
            .put("gpu", Prefs.gpu(ctx)).put("gpuName", Engine.gpuName)
            .put("gpuNote", Prefs.gpuNote(ctx))
            .put("draft", Prefs.draft(ctx))
            .put("draftInstalled", draft != null).put("draftLabel", draft?.label ?: JSONObject.NULL)
            .put("draftActive", Engine.draftId != null)
            .put("draftFits", active != null && Engine.isQwen35(active))
            .put("activeLabel", active?.label ?: JSONObject.NULL)
            // the fast engine (LiteRT-LM)
            .put("engine", if (FastEngine.isFast(active)) "litert" else "llama")
            .put("fastBackend", FastEngine.backend).put("fastMtp", FastEngine.mtp).put("fastVision", FastEngine.vision)
            .put("fastCpu", Prefs.fastCpu(ctx)).put("fastNote", Prefs.fastNote(ctx)).put("fastMtpPref", Prefs.fastMtp(ctx))
            .toString()
    }

    /** {gpu?, draft?} → saved, then the engine restarts with them. */
    @JavascriptInterface
    fun setSpeed(id: String, arg: String) {
        val a = try { JSONObject(arg) } catch (e: Exception) { return reject(id, "Bad request") }
        if (a.has("gpu")) { Prefs.setGpu(ctx, a.optBoolean("gpu")); Prefs.setGpuNote(ctx, "") }
        if (a.has("draft")) Prefs.setDraft(ctx, a.optBoolean("draft"))
        if (a.has("fastCpu")) { Prefs.setFastCpu(ctx, a.optBoolean("fastCpu")); Prefs.setFastNote(ctx, "") }
        if (a.has("fastMtp")) Prefs.setFastMtp(ctx, a.optBoolean("fastMtp"))
        val m = ModelStore.active(ctx) ?: return resolve(id, JSONObject().put("ok", true).put("speed", JSONObject(speed())))
        Engine.start(ctx, m) { ok, err ->
            announceEngine()
            val out = JSONObject().put("ok", ok).put("speed", JSONObject(speed()))
            if (ok) resolve(id, out) else reject(id, err ?: "The model could not be loaded")
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

    /** The last day's news on a topic (Daily → News). */
    @JavascriptInterface
    fun news(id: String, arg: String) {
        if (blockedByAirGap(id, "news")) return
        pool.execute {
            try {
                val a = JSONObject(arg)
                resolve(id, WebTools.news(a.getString("q"), a.optString("lang") == "ar", a.optInt("pages", 3)))
            } catch (e: Exception) { reject(id, e.message ?: "News failed") }
        }
    }

    /** What the home-screen widget shows: today's lesson and headline. */
    @JavascriptInterface
    fun setWidget(json: String): Boolean = try { DailyWidget.save(ctx, json); true } catch (e: Exception) { false }

    /** Readable text of one page. */
    @JavascriptInterface
    fun fetchText(id: String, url: String) {
        if (blockedByAirGap(id, "opening a page")) return
        pool.execute {
            val t = WebTools.pageText(url, 12000)
            if (t.isEmpty()) reject(id, "Could not read that page") else resolve(id, JSONObject().put("url", url).put("text", t))
        }
    }

    /** v6.1: raw JSON from a food database (Open Food Facts / USDA only). */
    @JavascriptInterface
    fun fetchJson(id: String, url: String) {
        if (blockedByAirGap(id, "the food database")) return
        pool.execute {
            try { resolve(id, JSONObject().put("url", url).put("body", WebTools.foodJson(url))) }
            catch (e: Exception) { reject(id, e.message ?: "Couldn't reach the food database") }
        }
    }

    /** v6.1: the barcodes in a photo ({b64}), read on the phone by ML Kit → {codes: [..]}. */
    @JavascriptInterface
    fun scanBarcode(id: String, arg: String) {
        pool.execute {
            try {
                val bytes = android.util.Base64.decode(JSONObject(arg).getString("b64"), android.util.Base64.DEFAULT)
                val bmp = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: throw Exception("Couldn't open that picture")
                val client = com.google.mlkit.vision.barcode.BarcodeScanning.getClient()
                val found = com.google.android.gms.tasks.Tasks.await(client.process(com.google.mlkit.vision.common.InputImage.fromBitmap(bmp, 0)), 20, java.util.concurrent.TimeUnit.SECONDS)
                val codes = org.json.JSONArray()
                for (b in found) b.rawValue?.let { if (it.isNotBlank()) codes.put(it) }
                client.close(); bmp.recycle()
                resolve(id, JSONObject().put("codes", codes))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't read a barcode in that picture") }
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

    // ---- Studio: pictures drawn on the phone ------------------------------------------
    @JavascriptInterface
    fun imageInfo(): String = JSONObject()
        .put("built", ImageEngine.built(ctx)).put("gpuBuilt", ImageEngine.gpuBuilt(ctx))
        .put("cpuOnly", ImageEngine.cpuOnly(ctx)).put("note", ImageEngine.note(ctx)).put("lastError", ImageEngine.lastError(ctx))
        .put("lastBackend", ImageEngine.lastBackend)
        .put("gpuState", ImageEngine.gpuState(ctx))
        .put("packs", ImageEngine.packs(ctx))
        .put("ramGB", DeviceInfo.ramGB(ctx)).put("availRamGB", DeviceInfo.availRamBytes(ctx) / 1e9)
        .put("freeGB", DeviceInfo.freeStorageBytes(ctx) / 1e9)
        .toString()

    @JavascriptInterface
    fun setImageCpu(on: Boolean) = ImageEngine.setCpuOnly(ctx, on)

    /** Every picture in the Studio folder, so Studio can show ones it missed (v5.20). */
    @JavascriptInterface
    fun imageList(): String = try { ImageEngine.list(ctx).toString() } catch (e: Exception) { "[]" }

    /** {id, label, kind, files:[{role, name, url, size, what}]} */
    @JavascriptInterface
    fun installImagePack(id: String, arg: String) {
        if (blockedByAirGap(id, "downloading a picture model")) return
        val flag = AtomicBoolean(false); cancels[id] = flag
        pool.execute {
            // v5.32: the download keeps the app awake (screen off used to slow or pause it — Ali:
            // "it took forever"), and shows its speed and the time left
            var lastT = 0L; var lastDone = -1L; var bps = 0.0
            try {
                GenService.set(ctx.applicationContext, true)
                val meta = ImageEngine.install(ctx, JSONObject(arg), { done, total, stage ->
                    val pct = if (total > 0) ((done * 100) / total).toInt().coerceIn(0, 99) else 0
                    val now = System.currentTimeMillis()
                    if (lastDone >= 0 && now > lastT && done >= lastDone) {
                        val inst = (done - lastDone) * 1000.0 / (now - lastT)
                        bps = if (bps <= 0) inst else bps * 0.8 + inst * 0.2
                    }
                    lastT = now; lastDone = done
                    val speed = if (bps > 0) " · %.1f MB/s".format(bps / 1e6) else ""
                    val left = if (bps > 50_000 && total > done) (total - done) / bps else -1.0
                    val eta = when { left < 0 -> ""; left < 90 -> " · ~${left.toInt().coerceAtLeast(1)} s left"; else -> " · ~${(left / 60).toInt()} min left" }
                    progress(id, pct, stage, "%.2f / %.2f GB".format(done / 1e9, total / 1e9) + speed + eta)
                }, { flag.get() })
                resolve(id, JSONObject().put("ok", true).put("pack", meta))
            } catch (e: ModelStore.Cancelled) {
                reject(id, "Download cancelled — it will resume where it stopped if you start it again.")
            } catch (e: Exception) { reject(id, e.message ?: "Install failed") }
            finally { cancels.remove(id); GenService.set(ctx.applicationContext, false) }
        }
    }

    @JavascriptInterface
    fun removeImagePack(packId: String): Boolean = ImageEngine.remove(ctx, packId)

    private fun imageProgress(id: String, p: ImageRun.Progress) {
        val pct = if (p.total > 0) (p.step * 100 / p.total) else 0
        progress(id, pct, p.stage, if (p.total > 0) "${p.step}/${p.total}" + (if (p.line.isNotEmpty()) " · " + p.line else "") else p.line)
    }

    private fun imageResult(r: ImageEngine.Result): JSONObject {
        val (w, h) = ImageEngine.size(r.file)
        return JSONObject().put("ok", true).put("file", r.file.name).put("url", "https://appassets.androidplatform.net/studio/" + r.file.name)
            .put("width", w).put("height", h).put("ms", r.ms).put("backend", r.backend).put("pausedChat", r.pausedChat)
            .put("seed", if (r.seed >= 0) r.seed else JSONObject.NULL)
    }

    /** {pack, prompt, width, height, steps, seed?, refImage?} → a picture. */
    @JavascriptInterface
    fun imagine(id: String, arg: String) {
        pool.execute {
            try {
                GenService.set(ctx.applicationContext, true)
                val r = ImageEngine.imagine(ctx, JSONObject(arg), { imageProgress(id, it) }, { j -> if (j != null) imageJobs[id] = j else imageJobs.remove(id) })
                ImageEngine.setLastError(ctx, "")
                resolve(id, imageResult(r))
            } catch (e: Throwable) {   // v5.20: an Error (out of memory …) too — the page must always get an answer
                if (e.message != "Stopped") ImageEngine.setLastError(ctx, e.message ?: e.javaClass.simpleName)
                // v5.17: every failed picture leaves its reason in Engine → Engine log.
                try { java.io.File(ctx.filesDir, "engine.log").appendText("\nStudio (${java.util.Date()}): ${e.javaClass.simpleName}: ${e.message}\n") } catch (x: Exception) {}
                reject(id, e.message?.takeIf { it.isNotBlank() } ?: "The picture could not be made (${e.javaClass.simpleName})")
            }
            finally { imageJobs.remove(id); GenService.set(ctx.applicationContext, false); announceEngine() }
        }
    }

    /** {file} → the same picture 4× bigger and sharper. */
    @JavascriptInterface
    fun upscaleImage(id: String, arg: String) {
        pool.execute {
            try {
                GenService.set(ctx.applicationContext, true)
                val r = ImageEngine.upscale(ctx, JSONObject(arg).getString("file"), { imageProgress(id, it) }, { j -> if (j != null) imageJobs[id] = j else imageJobs.remove(id) })
                resolve(id, imageResult(r))
            } catch (e: Exception) { reject(id, e.message ?: "Sharpening failed") }
            finally { imageJobs.remove(id); GenService.set(ctx.applicationContext, false) }
        }
    }

    /** v5.42: {file} → the same picture 2× bigger and crisper, in under a second (no model). */
    @JavascriptInterface
    fun sharpenFast(id: String, arg: String) {
        pool.execute {
            try { resolve(id, imageResult(ImageEngine.sharpenFast(ctx, JSONObject(arg).getString("file")))) }
            catch (e: Throwable) { reject(id, e.message ?: "Sharpening failed") }
        }
    }

    // ---- File Converter (v5.36): PDF text, PDF pages as pictures, and making PDFs ----------
    @JavascriptInterface
    fun pdfText(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                resolve(id, DocTools.pdfText(ctx, android.util.Base64.decode(a.getString("b64"), android.util.Base64.DEFAULT)))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't read that PDF") }
        }
    }

    @JavascriptInterface
    fun pdfImages(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                val pages = a.optJSONArray("pages")?.let { p -> (0 until p.length()).map { p.getInt(it) } } ?: emptyList()
                val imgs = DocTools.pdfImages(ctx, android.util.Base64.decode(a.getString("b64"), android.util.Base64.DEFAULT), pages, a.optInt("width", 1240), a.optInt("max", 60))
                resolve(id, JSONObject().put("images", imgs))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't open that PDF") }
        }
    }

    @JavascriptInterface
    fun makePdf(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                val bytes = DocTools.makePdf(a.optJSONArray("blocks") ?: JSONArray(), a.optJSONArray("images") ?: JSONArray(), a.optBoolean("fullPage", false))
                resolve(id, JSONObject().put("b64", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)).put("bytes", bytes.size))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't make the PDF") }
        }
    }

    /**
     * v6.8 — a page (convert.js blocksToPrintHtml) → PDF, laid out and printed by an off-screen WebView:
     * {html, w, h (points)} → {b64, bytes}. The page's own CSS sets the margins, header and footer.
     * Anything going wrong (a phone that refuses silent printing, a 90 s time limit) rejects, and the
     * page makes the PDF the older way (makePdf).
     */
    private val printing = java.util.Collections.synchronizedSet(HashSet<WebView>())
    @JavascriptInterface
    fun htmlToPdf(id: String, arg: String) {
        val a = try { JSONObject(arg) } catch (e: Exception) { reject(id, "Couldn't make the PDF"); return }
        val html = a.optString("html")
        val wPt = a.optDouble("w", 595.3); val hPt = a.optDouble("h", 841.9)
        val out = java.io.File(ctx.cacheDir, "print-" + System.nanoTime() + ".pdf")
        val main = android.os.Handler(android.os.Looper.getMainLooper())
        main.post {
            var wv: WebView? = null
            var over = false
            fun finish(err: Throwable?) {
                if (over) return
                over = true
                wv?.let { v -> printing.remove(v); main.post { try { v.destroy() } catch (e: Throwable) { } } }
                if (err != null) { out.delete(); reject(id, err.message ?: "Couldn't print the page"); return }
                pool.execute {
                    try {
                        val bytes = out.readBytes(); out.delete()
                        if (bytes.size < 200) throw java.io.IOException("The printed PDF is empty")
                        resolve(id, JSONObject().put("b64", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)).put("bytes", bytes.size))
                    } catch (e: Throwable) { reject(id, e.message ?: "Couldn't read the printed PDF") }
                }
            }
            try {
                val v = WebView(ctx)
                wv = v; printing.add(v)
                v.settings.javaScriptEnabled = false
                v.settings.allowFileAccess = false
                v.settings.blockNetworkLoads = true
                v.webViewClient = object : android.webkit.WebViewClient() {
                    private var started = false
                    override fun onPageFinished(view: WebView?, url: String?) {
                        if (started || over) return
                        started = true
                        try {
                            val media = android.print.PrintAttributes.MediaSize("attune", "Page", (wPt / 72.0 * 1000).toInt().coerceAtLeast(1000), (hPt / 72.0 * 1000).toInt().coerceAtLeast(1000))
                            val attrs = android.print.PrintAttributes.Builder().setMediaSize(if (wPt > hPt) media.asLandscape() else media)
                                .setResolution(android.print.PrintAttributes.Resolution("pdf", "PDF", 300, 300))
                                .setMinMargins(android.print.PrintAttributes.Margins.NO_MARGINS).build()
                            android.print.AttunePdfPrinter.print(v.createPrintDocumentAdapter("Attune"), attrs, out) { e -> main.post { finish(e) } }
                        } catch (e: Throwable) { finish(e) }
                    }
                }
                v.loadDataWithBaseURL("about:blank", html, "text/html", "utf-8", null)
                main.postDelayed({ finish(java.util.concurrent.TimeoutException("Printing took too long")) }, 90_000)
            } catch (e: Throwable) { finish(e) }
        }
    }

    @JavascriptInterface
    fun pdfEdit(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                resolve(id, DocTools.pdfEdit(ctx, a.getString("op"), a))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't change that PDF") }
        }
    }

    // ---- Video Downloader (v5.38): read a link, save the video with DownloadManager ----------
    @JavascriptInterface
    fun videoProbe(id: String, arg: String) {
        if (blockedByAirGap(id, "downloading a video")) return
        pool.execute {
            try { resolve(id, MediaTools.probe(JSONObject(arg).getString("url"))) }
            catch (e: Throwable) { reject(id, "Couldn't open that link" + (e.message?.let { " ($it)" } ?: "")) }
        }
    }

    @JavascriptInterface
    fun videoGet(id: String, arg: String) {
        if (blockedByAirGap(id, "downloading a video")) return
        pool.execute {
            try { resolve(id, MediaTools.getText(JSONObject(arg).getString("url"))) }
            catch (e: Throwable) { reject(id, "Couldn't open that link" + (e.message?.let { " ($it)" } ?: "")) }
        }
    }

    @JavascriptInterface
    fun videoDownload(id: String, arg: String) {
        if (blockedByAirGap(id, "downloading a video")) return
        pool.execute {
            try {
                val a = JSONObject(arg)
                resolve(id, MediaTools.download(ctx, a.getString("url"), a.optString("name", "video.mp4"), a.optBoolean("audio"), a.optString("title")))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't start the download") }
        }
    }

    @JavascriptInterface
    fun videoStatus(id: String, arg: String) {
        pool.execute {
            try {
                val ids = JSONObject(arg).optJSONArray("ids")?.let { p -> (0 until p.length()).map { p.getLong(it) } } ?: emptyList()
                resolve(id, JSONObject().put("items", MediaTools.status(ctx, ids)))
            } catch (e: Throwable) { reject(id, e.message ?: "status") }
        }
    }

    @JavascriptInterface
    fun videoOpen(id: String, arg: String) {
        try { if (MediaTools.openFile(ctx, JSONObject(arg).getLong("id"))) resolve(id, JSONObject().put("ok", true)) else reject(id, "The file was moved or deleted") }
        catch (e: Throwable) { reject(id, e.message ?: "Couldn't open the video") }
    }

    @JavascriptInterface
    fun videoCancel(id: String, arg: String) {
        try { resolve(id, JSONObject().put("ok", MediaTools.cancel(ctx, JSONObject(arg).getLong("id")))) }
        catch (e: Throwable) { reject(id, e.message ?: "cancel") }
    }

    /** The text on the clipboard (the app is in front, so Android allows it). */
    @JavascriptInterface
    fun clipboardText(id: String, arg: String) {
        web.post {
            try {
                val cm = ctx.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                val t = cm.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(ctx)?.toString() ?: ""
                resolve(id, JSONObject().put("text", t))
            } catch (e: Throwable) { reject(id, e.message ?: "clipboard") }
        }
    }

    @JavascriptInterface
    fun saveImageToGallery(name: String): String = try {
        JSONObject().put("ok", true).put("where", ImageEngine.saveToGallery(ctx, name)).toString()
    } catch (e: Exception) { JSONObject().put("ok", false).put("error", e.message ?: "Could not save").toString() }

    @JavascriptInterface
    fun deleteImage(name: String): Boolean = ImageEngine.delete(ctx, name)

    /** Share a Studio picture to another app (WhatsApp, Gmail…). */
    @JavascriptInterface
    fun shareImage(name: String) {
        web.post {
            try {
                val f = java.io.File(ImageEngine.studioDir(ctx), java.io.File(name).name)
                val uri = androidx.core.content.FileProvider.getUriForFile(ctx, ctx.packageName + ".files", f)
                val send = android.content.Intent(android.content.Intent.ACTION_SEND).setType("image/png")
                    .putExtra(android.content.Intent.EXTRA_STREAM, uri).addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                ctx.startActivity(android.content.Intent.createChooser(send, null).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (e: Exception) {}
        }
    }
}
