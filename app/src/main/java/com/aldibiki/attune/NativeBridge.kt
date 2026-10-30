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

    // v6.32 Private vault: {"bio":true,"secure":true} — and the system fingerprint / face / screen-lock prompt (Vault.kt)
    @JavascriptInterface
    fun vaultAvailable(): String = Vault.available(ctx)

    // ---- v6.37 Wi-Fi sync (LocalSync.kt): this device hosts, or sends to the one hosting. Only encrypted files cross.
    // Android 17 (target 37) asks the person before an app may use the home network: ACCESS_LOCAL_NETWORK.
    var askLocalNet: (() -> Unit)? = null
    private val LOCAL_NET = "android.permission.ACCESS_LOCAL_NETWORK"
    @JavascriptInterface
    fun localNetAllowed(): Boolean = android.os.Build.VERSION.SDK_INT < 37 ||
        ctx.checkSelfPermission(LOCAL_NET) == android.content.pm.PackageManager.PERMISSION_GRANTED
    @JavascriptInterface
    fun askLocalNetwork() { web.post { askLocalNet?.invoke() } }
    @JavascriptInterface
    fun syncHostStart(): String = try { NetLog.add("lan://this-device", "Wi-Fi sync: waiting for the other device"); LocalSync.start() }
        catch (e: Throwable) { "{\"ok\":false,\"error\":" + q(e.message ?: "could not start") + "}" }
    @JavascriptInterface
    fun syncHostTake(): String = LocalSync.take()
    @JavascriptInterface
    fun syncHostAnswer(text: String): String { LocalSync.answer(text); return "ok" }
    @JavascriptInterface
    fun syncHostStop(): String { LocalSync.stop(); return "ok" }
    @JavascriptInterface
    fun syncExchange(id: String, arg: String) {
        pool.execute {
            try {
                val j = JSONObject(arg); val host = j.getString("host"); val port = j.getInt("port")
                NetLog.add("lan://$host:$port", "Wi-Fi sync with your other device (encrypted file)")
                resolve(id, JSONObject().put("text", LocalSync.exchange(host, port, j.getString("body"))))
            } catch (e: Throwable) { reject(id, e.message ?: "Could not reach the other device — are both on the same Wi-Fi?") }
        }
    }

    // ---- v6.37 Google sync (GoogleDrive.kt): the token from Google's screen, then get / put the one encrypted file
    var authorizeDrive: (((String?, String?) -> Unit) -> Unit)? = null
    @JavascriptInterface
    fun driveSync(id: String, arg: String) {
        if (blockedByAirGap(id, "Google sync")) return
        val auth = authorizeDrive ?: run { reject(id, "Google sign-in is not available here"); return }
        auth { token, err ->
            if (token == null) { reject(id, err ?: "Google sign-in was cancelled"); return@auth }
            pool.execute {
                try {
                    val j = JSONObject(arg)
                    NetLog.add("https://www.googleapis.com/drive (app folder)", if (j.optString("op") == "put") "Google sync: upload your encrypted file" else "Google sync: read your encrypted file")
                    if (j.optString("op") == "put") resolve(id, JSONObject().put("id", GoogleDrive.put(token, j.optString("id").ifEmpty { null }, j.getString("text"))))
                    else resolve(id, GoogleDrive.get(token))
                } catch (e: Throwable) { reject(id, e.message ?: "Google Drive did not answer") }
            }
        }
    }

    // v8.7 the referral linked to a Google account: a short-lived token that only says who you are; the page sends it to the
    // referral server (its address is in web-src/referral.js), which asks Google who it belongs to. Nothing else is shared.
    var authorizeGoogle: (((String?, String?) -> Unit) -> Unit)? = null
    @JavascriptInterface
    fun googleAccount(id: String, arg: String) {
        if (blockedByAirGap(id, "Invite friends")) return
        val auth = authorizeGoogle ?: run { reject(id, "Google sign-in is not available here"); return }
        auth { token, err -> if (token == null) reject(id, err ?: "Google sign-in was cancelled") else resolve(id, JSONObject().put("token", token)) }
    }

    // v8.7 (Ali: "reads Gmail by itself"): the money emails, read on the phone (GmailRead.kt). arg = { days, max, silent, q }.
    // silent = the daily read (never shows Google's screen). → [{ id, kind, from, title, text, at, link }]
    var authorizeGmail: ((Boolean, (String?, String?) -> Unit) -> Unit)? = null
    @JavascriptInterface
    fun gmailRead(id: String, arg: String) {
        if (blockedByAirGap(id, "Gmail")) return
        val a = try { JSONObject(arg) } catch (e: Exception) { JSONObject() }
        val auth = authorizeGmail ?: run { reject(id, "Google sign-in is not available here"); return }
        auth(a.optBoolean("silent", false)) { token, err ->
            if (token == null) reject(id, err ?: "Gmail sign-in was cancelled")
            else Thread {
                try { resolve(id, JSONObject().put("emails", GmailRead.money(token, a.optInt("days", 30), a.optInt("max", 40), a.optString("q", "")))) }
                catch (e: Throwable) { reject(id, e.message ?: "Could not read Gmail") }
            }.start()
        }
    }

    // v8.7 (Ali: "send with my confirmation, like Gemini"): the email the person just checked and tapped Send on, from their Gmail.
    // arg = { to: [..], subject, body } → { id }. Google's own screen asks once for "send email on your behalf" (gmail.send).
    var authorizeGmailSend: (((String?, String?) -> Unit) -> Unit)? = null
    @JavascriptInterface
    fun gmailSend(id: String, arg: String) {
        if (blockedByAirGap(id, "Gmail")) return
        val a = try { JSONObject(arg) } catch (e: Exception) { JSONObject() }
        val to = a.optJSONArray("to")?.let { arr -> (0 until arr.length()).map { arr.optString(it) }.filter { it.contains("@") } } ?: emptyList()
        if (to.isEmpty()) { reject(id, "Who should it go to? Add an email address."); return }
        val auth = authorizeGmailSend ?: run { reject(id, "Google sign-in is not available here"); return }
        auth { token, err ->
            if (token == null) reject(id, err ?: "Gmail sign-in was cancelled")
            else Thread {
                try { resolve(id, JSONObject().put("id", GmailRead.send(token, to, a.optString("subject"), a.optString("body")))) }
                catch (e: Throwable) { reject(id, e.message ?: "Could not send") }
            }.start()
        }
    }

    // v8.7 the daily automatic backup like WhatsApp (AutoBackup.kt): the folder (picked once), and writing a backup into it
    var pickBackupFolder: (() -> Unit)? = null
    @JavascriptInterface
    fun autoBackupState(): String = try { AutoBackup.state(ctx).toString() } catch (e: Throwable) { "{}" }
    @JavascriptInterface
    fun autoBackupPick() { try { pickBackupFolder?.invoke() } catch (e: Throwable) { } }
    @JavascriptInterface
    fun autoBackupWrite(id: String, arg: String) {
        val a = try { JSONObject(arg) } catch (e: Exception) { JSONObject() }
        Thread { try { resolve(id, JSONObject().put("name", AutoBackup.write(ctx, a.optString("name"), a.optString("text")))) } catch (e: Throwable) { reject(id, e.message ?: "Could not save the backup") } }.start()
    }

    // v8.7 the WhatsApp groups library (WaGroups.kt): look at a group's photos (labels + the words in them), progress as events
    @JavascriptInterface
    fun waLook(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                resolve(id, WaGroups.look(ctx, a.optString("gid"), a.optJSONArray("names") ?: JSONArray()) { done, all -> progress(id, if (all > 0) done * 100 / all else 100, "look", "$done/$all") })
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't look at the photos") }
        }
    }
    @JavascriptInterface
    fun waForget(gid: String) { try { WaGroups.forget(ctx, gid) } catch (e: Throwable) { } }
    // v8.7 adding directly: the shared photos move into the chosen group; a photo picked inside Attune is saved there
    @JavascriptInterface
    fun waAdopt(gid: String, namesJson: String): Int = try { WaGroups.adopt(ctx, gid, JSONArray(namesJson)) } catch (e: Throwable) { 0 }
    @JavascriptInterface
    fun waSave(id: String, arg: String) {
        pool.execute {
            try { val a = JSONObject(arg); val ok = WaGroups.save(ctx, a.optString("gid"), a.optString("name"), android.util.Base64.decode(a.optString("b64"), android.util.Base64.DEFAULT))
                if (ok) resolve(id, JSONObject().put("ok", true)) else reject(id, "Couldn't keep that photo") }
            catch (e: Throwable) { reject(id, e.message ?: "Couldn't keep that photo") }
        }
    }

    // v8.7 (P7): Python for Code, downloaded on first use in the Play build (PyPack.kt); progress comes as 'attune-pypack' events
    @JavascriptInterface
    fun pyPackStatus(): String = try { PyPack.status(ctx).toString() } catch (e: Throwable) { JSONObject().put("ready", false).toString() }
    @JavascriptInterface
    fun pyPackFetch() {
        if (Prefs.airGap(ctx)) { emitPyPack(JSONObject().put("error", "Offline mode is on — turn it off to download Python")); return }
        PyPack.fetch(ctx, billing.activity) { s -> emitPyPack(s) }
    }
    private fun emitPyPack(s: JSONObject) { val js = "window.dispatchEvent(new CustomEvent('attune-pypack',{detail:$s}))"; web.post { try { web.evaluateJavascript(js, null) } catch (e: Throwable) {} } }

    // v6.32 Scout at night (ScoutNight.kt): the goals' searches for tonight, and what last night found
    @JavascriptInterface
    fun scoutNightPlan(plan: String): String { ScoutNight.setPlan(ctx, plan); return "ok" }

    @JavascriptInterface
    fun scoutNightTake(): String = ScoutNight.take(ctx)

    // v6.32 the Attune keyboard (AttuneKeyboard.kt): is it on, and open the system's keyboard settings / picker
    @JavascriptInterface
    fun keyboardState(): String = org.json.JSONObject().put("enabled", AttuneKeyboard.enabled(ctx)).toString()

    @JavascriptInterface
    fun keyboardSetup(what: String): String = try {
        if (what == "pick") android.os.Handler(android.os.Looper.getMainLooper()).post { try { (ctx.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager).showInputMethodPicker() } catch (e: Exception) {} }
        else ctx.startActivity(android.content.Intent(android.provider.Settings.ACTION_INPUT_METHOD_SETTINGS).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
        "ok"
    } catch (e: Exception) { "error: " + e.message }

    @JavascriptInterface
    fun vaultUnlock(id: String, arg: String) {
        val a = try { JSONObject(arg) } catch (e: Exception) { JSONObject() }
        val act = ctx as? android.app.Activity ?: return reject(id, "not available")
        web.post {
            Vault.prompt(act, a.optString("title", "Attune"), a.optString("subtitle", ""), a.optString("cancel", "Cancel"),
                { resolve(id, JSONObject().put("ok", true)) }, { msg -> reject(id, msg) })
        }
    }

    @JavascriptInterface
    fun setAirGap(on: Boolean) { Prefs.setAirGap(ctx, on) }

    /** v6.29: the newest unexpected app ending since the last start (ExitWatch), once — "" when there was none. */
    @JavascriptInterface
    fun lastExit(): String = ExitWatch.last?.toString()?.also { ExitWatch.clearLast() } ?: ""

    /** v6.29: true only for builds signed with the test key — the page allows developer mode (Pro unlock for testing) only then. */
    @JavascriptInterface
    fun testBuild(): Boolean = try { ctx.resources.getBoolean(R.bool.attune_test_build) } catch (e: Exception) { false }
    // v8.7: the Play Store build (no Video Downloader, no keyboard, no overlay) — the page hides what isn't there
    @JavascriptInterface
    fun playBuild(): Boolean = try { ctx.resources.getBoolean(R.bool.attune_play) } catch (e: Exception) { false }
    // v8.7: the Play install referrer ("attune_ref=<code>" when a friend's link was used), or ""
    @JavascriptInterface
    fun installReferrer(): String = try { Referrer.get(ctx) } catch (e: Throwable) { "" }

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
                // Very hot (SEVERE or worse): give the phone up to 20 s to cool before a new answer.
                DeviceInfo.coolDown(ctx, flag)
                if (flag.get()) throw java.io.IOException("Stopped")
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
        try { t.setSpeechRate(1f) } catch (e: Exception) {}   // the lesson player may have changed it
        // Long answers are split: one utterance has a length limit.
        val chunks = text.chunked(3500)
        chunks.forEachIndexed { i, c ->
            t.speak(c, if (i == 0) android.speech.tts.TextToSpeech.QUEUE_FLUSH else android.speech.tts.TextToSpeech.QUEUE_ADD, null, "attune-$i")
        }
    }

    @JavascriptInterface
    fun stopSpeaking() { web.post { try { tts?.stop() } catch (e: Exception) {} } }

    // v6.27 the lesson player: speak one step and answer when it has been said (or stopped), so pictures and voice stay together
    private val ttsWait = ConcurrentHashMap<String, String>()   // utterance id → the page's call id
    private var ttsListening = false
    private fun ttsListener(t: android.speech.tts.TextToSpeech) {
        if (ttsListening) return
        ttsListening = true
        t.setOnUtteranceProgressListener(object : android.speech.tts.UtteranceProgressListener() {
            override fun onStart(u: String?) {}
            override fun onDone(u: String?) { u?.let { ttsWait.remove(it)?.let { id -> resolve(id, JSONObject().put("ok", true)) } } }
            @Deprecated("old API") override fun onError(u: String?) { u?.let { ttsWait.remove(it)?.let { id -> resolve(id, JSONObject().put("ok", false)) } } }
            override fun onStop(u: String?, interrupted: Boolean) { u?.let { ttsWait.remove(it)?.let { id -> resolve(id, JSONObject().put("ok", false)) } } }
        })
    }

    /** {text, lang, rate} → answered when the phone has finished saying it. */
    @JavascriptInterface
    fun speakWait(id: String, arg: String) {
        val a = try { JSONObject(arg) } catch (e: Exception) { return reject(id, "Bad request") }
        val text = a.optString("text").take(3500)
        val lang = a.optString("lang")
        val rate = a.optDouble("rate", 1.0).toFloat().coerceIn(0.5f, 2f)
        web.post {
            val go: () -> Unit = {
                val t = tts
                if (t == null || !ttsReady || text.isBlank()) resolve(id, JSONObject().put("ok", false))
                else {
                    ttsListener(t)
                    val loc = if (lang.isNotBlank()) java.util.Locale.forLanguageTag(lang) else java.util.Locale.getDefault()
                    try { t.language = loc } catch (e: Exception) {}
                    try { t.setSpeechRate(rate) } catch (e: Exception) {}
                    val uid = "wait-$id"
                    ttsWait[uid] = id
                    if (t.speak(text, android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, uid) != android.speech.tts.TextToSpeech.SUCCESS) {
                        ttsWait.remove(uid); resolve(id, JSONObject().put("ok", false))
                    }
                }
            }
            if (tts == null) {
                tts = android.speech.tts.TextToSpeech(ctx) { status ->
                    ttsReady = status == android.speech.tts.TextToSpeech.SUCCESS
                    ttsPending?.let { (x, l) -> ttsPending = null; say(x, l) }
                    go()
                }
            } else go()
        }
    }

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
    var askHealthTemp: (() -> Unit)? = null   // v6.41 (F4)
    var askHealthVitals: (() -> Unit)? = null   // v8.7 the watch's vitals
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

    /** v6.41 (F4): Cycle — ask for the temperature permissions; read the nights ({days}) → {available, granted, nights}. */
    @JavascriptInterface
    fun healthTempConnect() { if (Health.availability(ctx) == "update") healthConnect() else askHealthTemp?.invoke() }
    @JavascriptInterface
    fun healthTemps(id: String, arg: String) {
        pool.execute {
            try { resolve(id, Health.nights(ctx, try { JSONObject(arg).optInt("days", 120) } catch (e: Exception) { 120 })) }
            catch (e: Throwable) { reject(id, e.message ?: "Couldn't read the temperature") }
        }
    }

    /** v8.7: Health → "From your watch" — ask for the vitals permissions; read the last {days} days of vitals. */
    @JavascriptInterface
    fun healthVitalsConnect() { if (Health.availability(ctx) == "update") healthConnect() else askHealthVitals?.invoke() }
    @JavascriptInterface
    fun healthVitals(id: String, arg: String) {
        pool.execute {
            try { resolve(id, Health.vitals(ctx, try { JSONObject(arg).optInt("days", 30) } catch (e: Exception) { 30 })) }
            catch (e: Throwable) { reject(id, e.message ?: "Couldn't read the watch") }
        }
    }

    // ---- v6.7 Google Play Billing -------------------------------------------------------------
    @JavascriptInterface fun storeProducts(id: String, arg: String) { billing.products { resolve(id, it) } }
    @JavascriptInterface fun storeBuy(id: String, arg: String) { val j = JSONObject(arg); billing.buy(j.optString("sku"), j.optString("account")) { resolve(id, it) } }
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
        if (pkg != Health.HUAWEI && pkg != Health.HEALTH_SYNC && pkg != HuaweiHealth.HMS_CORE && pkg !in Health.WATCH_APPS) return
        val launch = if (Health.installed(ctx, pkg)) ctx.packageManager.getLaunchIntentForPackage(pkg) else null
        val intents = listOfNotNull(launch,
            android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("market://details?id=$pkg")),
            android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("appmarket://details?id=$pkg")),   // Huawei AppGallery
            android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://play.google.com/store/apps/details?id=$pkg")))
        for (i in intents) {
            try { ctx.startActivity(i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)); return } catch (e: Exception) {}
        }
    }

    /** v6.43: which watch apps are on this phone (JSON array of package names), for Fit's "Automatic tracking" row. */
    @JavascriptInterface
    fun watchAppsInstalled(): String = org.json.JSONArray((Health.WATCH_APPS + Health.HUAWEI + Health.HEALTH_SYNC).filter { Health.installed(ctx, it) }).toString()

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

    /** v6.27 "Do it for me", level 2: a website inside Attune with Best offer / Fill my details (AgentBrowser) —
     *  {url, title, profile{}, rules{}, labels{}, search} → when it closes: {reason, offers, filled, payment}. */
    @JavascriptInterface
    fun agentOpen(id: String, arg: String) {
        if (blockedByAirGap(id, "opening a website")) return
        try {
            val a = JSONObject(arg)
            if (!a.optString("url").startsWith("https://")) return reject(id, "Not a web link")
            AgentBrowser.onDone?.invoke(JSONObject().put("reason", "replaced"))
            AgentBrowser.onDone = { r -> resolve(id, r) }
            val i = android.content.Intent(ctx, AgentBrowser::class.java)
                .putExtra("url", a.optString("url")).putExtra("title", a.optString("title"))
                .putExtra("profile", a.optJSONObject("profile")?.toString() ?: "{}")
                .putExtra("rules", a.optJSONObject("rules")?.toString() ?: "{}")
                .putExtra("labels", a.optJSONObject("labels")?.toString() ?: "{}")
                .putExtra("search", a.optBoolean("search", true))
                .putExtra("watch", a.optBoolean("watch", false))
                .putExtra("autoClose", a.optBoolean("autoClose", false))   // v8.2: a round of several days closes each page by itself
                .putExtra("buy", a.optBoolean("buy", false))   // v8.6: a buy agent the person confirmed — Buy now, then their details
                .putExtra("rounds", a.optJSONArray("rounds")?.toString() ?: "")   // v8.7: several start days in ONE window (no flicker)
                .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(i)
        } catch (e: Exception) { AgentBrowser.onDone = null; reject(id, e.message ?: "Could not open it") }
    }

    // ---- v8.0 Agents ------------------------------------------------------------
    /** Every app with a home-screen icon: [{pkg, label}] — so "open Uber" / «افتح طلبات» finds any app by its name. */
    @JavascriptInterface
    fun appsList(): String = try {
        val pm = ctx.packageManager
        val main = android.content.Intent(android.content.Intent.ACTION_MAIN).addCategory(android.content.Intent.CATEGORY_LAUNCHER)
        val arr = org.json.JSONArray(); val seen = HashSet<String>()
        for (r in pm.queryIntentActivities(main, 0)) {
            val pkg = r.activityInfo?.packageName ?: continue
            if (pkg == ctx.packageName || !seen.add(pkg)) continue
            arr.put(JSONObject().put("pkg", pkg).put("label", r.loadLabel(pm)?.toString() ?: pkg))
        }
        arr.toString()
    } catch (e: Exception) { "[]" }

    /** Opens an app: {pkg, url, store} — the app if it is on the phone (at the link when the app takes it), else the link
     *  (website), else its store page. {ok, how: "app" | "link" | "store"}. */
    @JavascriptInterface
    fun openAnyApp(json: String): String = try {
        val a = JSONObject(json); val pkg = a.optString("pkg"); val url = a.optString("url")
        val pm = ctx.packageManager
        val installed = pkg.isNotBlank() && try { pm.getPackageInfo(pkg, 0); true } catch (e: Exception) { false }
        fun go(i: android.content.Intent): Boolean = try { ctx.startActivity(i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)); true } catch (e: Exception) { false }
        val view = { u: String -> android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(u)) }
        val how = when {
            installed && url.isNotBlank() && go(view(url).setPackage(pkg)) -> "app"
            installed && pm.getLaunchIntentForPackage(pkg)?.let { go(it) } == true -> "app"
            url.startsWith("https://") && go(view(url)) -> "link"
            pkg.isNotBlank() && (go(view("market://details?id=$pkg")) || go(view("https://play.google.com/store/apps/details?id=$pkg"))) -> "store"
            else -> ""
        }
        JSONObject().put("ok", how.isNotEmpty()).put("how", how).toString()
    } catch (e: Exception) { JSONObject().put("ok", false).put("error", e.message ?: "").toString() }

    /** SMS notifications on / off (Ali picked B: off by default; never the inbox, never one-time codes). */
    @JavascriptInterface
    fun smsNotifs(): Boolean = try { Prefs.smsNotifs(ctx) } catch (e: Exception) { false }
    @JavascriptInterface
    fun setSmsNotifs(on: Boolean) { try { Prefs.setSmsNotifs(ctx, on) } catch (e: Exception) {} }

    /** v8.7 the old bank SMS (full APK only, SmsInbox.kt): {declared, granted}; ask once (event 'attune-sms-perm'); the money SMS. */
    @JavascriptInterface
    fun smsInboxState(): String = try { JSONObject().put("declared", SmsInbox.declared(ctx)).put("granted", SmsInbox.granted(ctx)).toString() } catch (e: Throwable) { "{}" }
    var askSms: (() -> Unit)? = null
    @JavascriptInterface
    fun smsInboxAsk() { try { askSms?.invoke() } catch (e: Throwable) { } }
    @JavascriptInterface
    fun smsInboxMoney(days: Int): String = try { SmsInbox.money(ctx, days) } catch (e: Throwable) { "[]" }

    /** Voice: the newest chat messages from notifications (ChatInbox.kt) — [{key, app, who, convo, group, text, ts, canReply}]. */
    @JavascriptInterface
    fun chatInbox(): String = try { ChatInbox.list(ctx) } catch (e: Exception) { "[]" }

    /** Voice: a reply into exactly one conversation, through its own notification reply — {key, text} → {ok} / {ok:false, error}. */
    @JavascriptInterface
    fun chatReply(json: String): String = try {
        val a = JSONObject(json)
        ChatInbox.reply(ctx, a.optString("key"), a.optString("text").take(2000)).toString()   // the chat app sends it, not Attune
    } catch (e: Exception) { JSONObject().put("ok", false).put("error", e.message ?: "").toString() }

    /** The price watches to check about every 12 hours with Attune closed (AgentWatch.kt), and what they found. */
    @JavascriptInterface
    fun agentWatchPlan(plan: String): String { AgentWatch.setPlan(ctx, plan); return "ok" }
    @JavascriptInterface
    fun agentWatchTake(): String = AgentWatch.take(ctx)

    // ---- v8.3 Library at scale (BookShelf.kt): topics, books read natively into a full-text index, fast search ----------------
    var pickContact: (((JSONObject?) -> Unit) -> Unit)? = null   // v8.8: Android's contact picker (no permission) → {name, phone}
    @JavascriptInterface
    fun contactPick(id: String, json: String) {
        val p = pickContact ?: return reject(id, "Not available")
        p { r -> if (r == null) reject(id, "Cancelled") else resolve(id, r) }
    }
    var pickBooks: ((String, Boolean) -> Unit)? = null   // (topic, a whole folder?) — MainActivity opens Android's picker
    /** Pick books (files, or a whole folder with folder=true) for a topic; they are read in the background. */
    @JavascriptInterface
    fun booksPick(json: String) { val a = try { JSONObject(json) } catch (e: Exception) { JSONObject() }; pickBooks?.invoke(a.optString("topic"), a.optBoolean("folder", false)) }
    /** {topics, books:[{id, name, topic, pages, done, chunks, scans, state, err}], job:{book, name, page, pages}, dbBytes} */
    @JavascriptInterface
    fun booksState(): String = try { BookShelf.state(ctx).toString() } catch (e: Exception) { "{}" }
    /** {op: add|rename|delete|move, name, to?, book?} → the state */
    @JavascriptInterface
    fun booksTopic(json: String): String = try { BookShelf.topic(ctx, JSONObject(json)).toString() } catch (e: Exception) { "{}" }
    @JavascriptInterface
    fun booksRemove(id: String): String = try { BookShelf.remove(ctx, id.toLong()).toString() } catch (e: Exception) { "{}" }
    /** {q, topic, k, perBook} → {passages:[{book, title, topic, page, text, score}], searched, ms} (off the page's thread) */
    @JavascriptInterface
    fun booksSearch(id: String, json: String) {
        pool.execute { try { resolve(id, BookShelf.search(ctx, JSONObject(json))) } catch (e: Throwable) { reject(id, e.message ?: "Search failed") } }
    }

    // ---- voice -----------------------------------------------------------------
    var voice: Voice? = null
    var askMic: (() -> Unit)? = null
    var lastVoiceSink: Voice.Sink? = null

    /** Speech to text. Words arrive through progress(id, 0, "partial", text). */
    @JavascriptInterface
    fun listen(id: String, lang: String) {
        val v = voice ?: return reject(id, "Voice input is not available")
        // voice phase 3: the wake-word service lets the mic go while Attune listens itself, and takes it back after
        WakeService.selfListening = true; WakeService.resumeLater(ctx, 0)
        val sink = object : Voice.Sink {
            override fun partial(text: String) = progress(id, 0, "partial", text)
            override fun done(text: String) { WakeService.selfListening = false; WakeService.resumeLater(ctx, 400); resolve(id, JSONObject().put("text", text)) }
            override fun failed(message: String) { WakeService.selfListening = false; WakeService.resumeLater(ctx, 400); reject(id, message) }
        }
        lastVoiceSink = sink
        // v8.2: when the wake word holds the mic, it lets go first (its loop stops within ~0.4 s) — then Attune listens
        if (Prefs.wake(ctx)) web.postDelayed({ v.start(lang, sink) { askMic?.invoke() } }, 450) else v.start(lang, sink) { askMic?.invoke() }
    }

    @JavascriptInterface
    fun stopListening() { voice?.stop(); WakeService.selfListening = false; WakeService.resumeLater(ctx, 400) }

    /** Voice phase 3 «يا أتيون»: {on, when, sensitivity, mic, overlay, paused, score, error}. */
    @JavascriptInterface
    fun wakeState(): String = try { WakeService.state(ctx) } catch (e: Exception) { "{}" }
    /** Switch the wake word on / off (asks for the microphone first when it is not allowed yet). */
    @JavascriptInterface
    fun setWake(on: Boolean) {
        if (on && ctx.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) { Prefs.setWake(ctx, true); askMic?.invoke(); return }
        web.post { WakeService.set(ctx, on) }
    }
    /** {when: always|screen|charging, sensitivity: low|normal|high} */
    @JavascriptInterface
    fun setWakeOpts(json: String) {
        try { val o = JSONObject(json); Prefs.setWakeOpts(ctx, o.optString("when", "").ifEmpty { null }, o.optString("sensitivity", "").ifEmpty { null }, o.optString("lang", "").ifEmpty { null }) } catch (e: Exception) {}
        web.post { WakeService.resume(ctx) }
    }
    /** Option C: teach it the person's voice — recording i (0..2); the page polls wakeState().enrol {i, state: listening|ok|unclear}. */
    @JavascriptInterface
    fun wakeEnrol(i: Int) { WakeService.selfListening = false; web.post { WakeService.enrol(ctx, i) } }
    /** Forget the taught voice (then any voice wakes it). */
    @JavascriptInterface
    fun wakeForget() { try { WakeService.forgetVoice(ctx) } catch (e: Exception) {} }
    /** The voice screen closed: the wake word listens again. */
    @JavascriptInterface
    fun wakeResume() { WakeService.selfListening = false; web.post { WakeService.resume(ctx) } }
    /** "Open by itself over other apps" — Android's own page for it (otherwise a tap-to-talk notification appears). */
    @JavascriptInterface
    fun wakeOverlay() {
        try { ctx.startActivity(android.content.Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION, android.net.Uri.parse("package:" + ctx.packageName)).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) {}
    }

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
                    // An MTP build that lacks this quant falls back to the standard repo.
                    plan = try { ModelStore.resolveHf(repo, quant, vision) } catch (e: Exception) {
                        if (repo.contains("-MTP-GGUF")) ModelStore.resolveHf(repo.replace("-MTP-GGUF", "-GGUF"), quant, vision) else throw e
                    }
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
            .put("thermalHeadroom", DeviceInfo.thermalHeadroom(ctx).toDouble())
            .put("batchThreads", DeviceInfo.batchThreads(ctx))
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
            .put("npuBuilt", Engine.npuBuilt(ctx)).put("npu", Prefs.npu(ctx)).put("npuDev", Engine.npuDev).put("npuNote", Prefs.npuNote(ctx))
            .put("draft", Prefs.draft(ctx))
            .put("draftInstalled", draft != null).put("draftLabel", draft?.label ?: JSONObject.NULL)
            .put("draftActive", Engine.draftId != null)
            .put("draftFits", active != null && Engine.isQwen35(active))
            .put("mtpMode", Prefs.mtpMode(ctx)).put("mtpHas", active != null && Engine.hasMtp(active))
            .put("mtpActive", active != null && Engine.mtpFor(ctx, active))
            .put("mtpFailed", active != null && Prefs.mtpBad(ctx, active.id))
            .put("safe", active != null && Prefs.safeMode(ctx, active.id))
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
        if (a.has("npu")) { Prefs.setNpu(ctx, a.optBoolean("npu")); Prefs.setNpuNote(ctx, ""); if (a.optBoolean("npu")) Prefs.setGpu(ctx, false) }
        if (a.has("draft")) Prefs.setDraft(ctx, a.optBoolean("draft"))
        if (a.has("mtp")) Prefs.setMtpMode(ctx, a.optString("mtp", "auto"))
        if (a.has("fastCpu")) { Prefs.setFastCpu(ctx, a.optBoolean("fastCpu")); Prefs.setFastNote(ctx, "") }
        if (a.has("fastMtp")) Prefs.setFastMtp(ctx, a.optBoolean("fastMtp"))
        // {safe: true|false}: the page's nonsense guard (or the Speed row) puts the loaded model in safe mode
        if (a.has("safe")) ModelStore.active(ctx)?.let { Prefs.setSafeMode(ctx, it.id, a.optBoolean("safe")) }
        val m = ModelStore.active(ctx) ?: return resolve(id, JSONObject().put("ok", true).put("speed", JSONObject(speed())))
        Engine.start(ctx, m) { ok, err ->
            announceEngine()
            val out = JSONObject().put("ok", ok).put("speed", JSONObject(speed()))
            if (ok) resolve(id, out) else reject(id, err ?: "The model could not be loaded")
        }
    }

    /** v6.41 (X2): the thread counts for the active model — {gen, batch} sets them (used from the next start), {gen: 0} clears. */
    @JavascriptInterface
    fun engineTune(json: String) {
        try { val j = JSONObject(json); val m = ModelStore.active(ctx) ?: return; Prefs.setTunedThreads(ctx, m.id, j.optInt("gen"), j.optInt("batch")) } catch (e: Throwable) { }
    }
    @JavascriptInterface
    fun engineTuned(): String = try {
        val m = ModelStore.active(ctx); val t = m?.let { Prefs.tunedThreads(ctx, it.id) }
        JSONObject().put("model", m?.id ?: "").put("gen", t?.first ?: 0).put("batch", t?.second ?: 0)
            .put("cores", DeviceInfo.cores()).put("bigCores", DeviceInfo.bigCores()).put("hot", DeviceInfo.isHot(ctx)).toString()
    } catch (e: Throwable) { "{}" }

    /** Restart the engine with the active model (e.g. after the phone cooled down). */
    @JavascriptInterface
    fun restart(id: String, unused: String) {
        val m = ModelStore.active(ctx) ?: return reject(id, "No model installed yet")
        use(id, m.id)
    }

    /** Web search: {q, provider: "duckduckgo", key? (ignored since v6.27), pages?} */
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

    /** v8.5: YouTube review videos with their transcripts {q, n} → {hits} (read like pages; only the subject leaves the phone). */
    @JavascriptInterface
    fun videoReviews(id: String, arg: String) {
        if (blockedByAirGap(id, "YouTube reviews")) return
        pool.execute {
            try { val a = JSONObject(arg); resolve(id, WebTools.videoReviews(a.getString("q"), a.optInt("n", 2).coerceIn(1, 4))) }
            catch (e: Exception) { reject(id, e.message ?: "YouTube reviews failed") }
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

    /** v6.14 — what the Fit & Food widget shows: {left, leftLabel, line, water}. */
    @JavascriptInterface
    fun setFitWidget(json: String): Boolean = try { FitWidget.save(ctx, json); true } catch (e: Exception) { false }

    /** Readable text of one page. */
    @JavascriptInterface
    fun fetchText(id: String, url: String) {
        if (blockedByAirGap(id, "opening a page")) return
        pool.execute {
            val t = WebTools.pageText(url, 12000)
            if (t.isEmpty()) reject(id, "Could not read that page") else resolve(id, JSONObject().put("url", url).put("text", t))
        }
    }

    /**
     * v6.12: the raw page of a conversation shared from another AI (Gemini, ChatGPT, Claude, Perplexity, Grok, Copilot,
     * DeepSeek, Poe, Meta AI) — the conversation sits in the page's scripts, which pageText removes. Only these hosts,
     * redirects followed (share.gemini.google → gemini.google.com), up to 4 MB. The page reads it (ai-import.js).
     */
    @JavascriptInterface
    fun fetchShare(id: String, url: String) {
        if (blockedByAirGap(id, "reading a shared AI conversation")) return
        pool.execute {
            try {
                val ok = Regex("^https://(share\\.gemini\\.google|gemini\\.google\\.com|g\\.co|chatgpt\\.com|chat\\.openai\\.com|claude\\.ai|(www\\.)?perplexity\\.ai|grok\\.com|x\\.com|copilot\\.microsoft\\.com|chat\\.deepseek\\.com|poe\\.com|(www\\.)?meta\\.ai)/", RegexOption.IGNORE_CASE)
                if (!ok.containsMatchIn(url)) { reject(id, "Only links shared from an AI chat can be read here"); return@execute }
                Prefs.requireOnline(url, "a shared AI conversation")
                var u = url; var html = ""; var hops = 0
                while (hops++ < 6) {
                    val c = java.net.URL(u).openConnection() as java.net.HttpURLConnection
                    c.instanceFollowRedirects = false; c.connectTimeout = 12_000; c.readTimeout = 20_000
                    c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36")
                    c.setRequestProperty("Accept-Language", "en,ar;q=0.8")
                    val code = c.responseCode
                    if (code in 300..399) { val loc = c.getHeaderField("Location") ?: break; u = java.net.URL(java.net.URL(u), loc).toString(); if (!ok.containsMatchIn(u) && !u.startsWith("https://accounts.google.com")) break; continue }
                    if (code !in 200..299) { reject(id, "The share page answered HTTP $code"); return@execute }
                    html = c.inputStream.bufferedReader(Charsets.UTF_8).use { r -> val sb = StringBuilder(); val b = CharArray(65536); var n: Int; while (r.read(b).also { n = it } > 0 && sb.length < 4_000_000) sb.append(b, 0, n); sb.toString() }
                    break
                }
                if (html.isEmpty()) reject(id, "Could not open that link") else resolve(id, JSONObject().put("url", u).put("html", html))
            } catch (e: Exception) { reject(id, e.message ?: "Could not open that link") }
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

    /**
     * v6.16: Dorar's hadith encyclopedia (الدرر السنية), searched live through its official API (dorar.net/dorar_api.json):
     * {q} → {body} (JSON whose ahadith.result is HTML; knowledge.js reads it). Only this one address; the offline lock stops it.
     */
    @JavascriptInterface
    fun dorarSearch(id: String, q: String) {
        if (blockedByAirGap(id, "Dorar (الدرر السنية)")) return
        pool.execute {
            try {
                val url = "https://dorar.net/dorar_api.json?skey=" + java.net.URLEncoder.encode(q.take(200), "UTF-8")
                Prefs.requireOnline(url, "Dorar (الدرر السنية)")
                val c = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                c.connectTimeout = 8_000; c.readTimeout = 12_000
                c.setRequestProperty("User-Agent", "Attune (Android)"); c.setRequestProperty("Accept", "application/json")
                val code = c.responseCode
                if (code !in 200..299) { reject(id, "Dorar answered HTTP $code"); return@execute }
                val body = c.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText().take(2_000_000) }
                resolve(id, JSONObject().put("body", body))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't reach Dorar") }
        }
    }

    /** v6.16: today's exchange rates against the US dollar (open.er-api.com, free, no key) → {body}; the offline lock stops it. */
    @JavascriptInterface
    fun fxRates(id: String, @Suppress("UNUSED_PARAMETER") arg: String) {
        if (blockedByAirGap(id, "exchange rates")) return
        pool.execute {
            try {
                val url = "https://open.er-api.com/v6/latest/USD"
                Prefs.requireOnline(url, "exchange rates")
                val c = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                c.connectTimeout = 6_000; c.readTimeout = 8_000
                val code = c.responseCode
                if (code !in 200..299) { reject(id, "Exchange rates answered HTTP $code"); return@execute }
                resolve(id, JSONObject().put("body", c.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText().take(200_000) }))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't get exchange rates") }
        }
    }

    /** v6.18: a file of the offline food pack → {text}. Only this app's own food-pack release can be asked. */
    @JavascriptInterface
    fun foodPackText(id: String, name: String) {
        if (blockedByAirGap(id, "the food pack")) return
        pool.execute {
            try { resolve(id, JSONObject().put("name", name).put("text", WebTools.foodPackText(name))) }
            catch (e: Throwable) { reject(id, e.message ?: "Couldn't download the food pack") }
        }
    }

    /** v6.20: a file of a Knowledge pack ({tag, name}) → {text}. Only this app's own know-* releases can be asked. */
    @JavascriptInterface
    fun knowPackText(id: String, arg: String) {
        if (blockedByAirGap(id, "the knowledge pack")) return
        pool.execute {
            try { val a = JSONObject(arg); resolve(id, JSONObject().put("name", a.optString("name")).put("text", WebTools.knowPackText(a.optString("tag"), a.optString("name")))) }
            catch (e: Throwable) { reject(id, e.message ?: "Couldn't download the knowledge pack") }
        }
    }

    /** v6.10: the photo fast path's files (FoodClip) — on the phone? {installed, bytes, files} */
    @JavascriptInterface
    fun foodClipStatus(): String = try { FoodClip.status(ctx).toString() } catch (e: Throwable) { "{\"installed\":false,\"bytes\":0}" }

    /** v6.10: downloads the photo fast path's files from this app's own release, with progress; cancel(id) stops it. */
    @JavascriptInterface
    fun foodClipInstall(id: String, arg: String) {
        if (blockedByAirGap(id, "downloading the photo model")) return
        val flag = AtomicBoolean(false); cancels[id] = flag
        pool.execute {
            try {
                // v6.19: {"update":true} = the quiet daily check (only what changed; big files wait for Wi-Fi)
                val upd = try { JSONObject(arg).optBoolean("update", false) } catch (e: Exception) { false }
                val fetched = FoodClip.install(ctx, { done, total, name ->
                    val pct = if (total > 0) ((done * 100) / total).toInt().coerceIn(0, 99) else 0
                    progress(id, pct, name, "%.0f / %.0f MB".format(done / 1e6, total / 1e6))
                }, { flag.get() }, smallOnly = upd && !unmetered())
                resolve(id, FoodClip.status(ctx).put("fetched", fetched))
            } catch (e: FoodClip.Cancelled) {
                reject(id, "Download stopped — it continues where it stopped next time.")
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't download the photo model") }
            finally { cancels.remove(id) }
        }
    }

    @JavascriptInterface
    fun foodClipRemove(): Boolean = FoodClip.remove(ctx)

    /* ---- v6.45 Recall phase 2: the meaning model (Embedder) ---- */
    @JavascriptInterface
    fun embedStatus(): String = try { Embedder.status(ctx).toString() } catch (e: Throwable) { "{\"installed\":false}" }

    /** Downloads the meaning model (438 MB, resumable), with progress; cancel(id) stops it. */
    @JavascriptInterface
    fun embedInstall(id: String, arg: String) {
        if (blockedByAirGap(id, "downloading the meaning model")) return
        val flag = AtomicBoolean(false); cancels[id] = flag
        pool.execute {
            try {
                Embedder.install(ctx, { done, total ->
                    progress(id, ((done * 100) / total).toInt().coerceIn(0, 99), "download", "%.0f / %.0f MB".format(done / 1e6, total / 1e6))
                }, { flag.get() })
                resolve(id, Embedder.status(ctx))
            } catch (e: Embedder.Cancelled) {
                reject(id, "Download stopped — it continues where it stopped next time.")
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't download the meaning model") }
            finally { cancels.remove(id) }
        }
    }

    @JavascriptInterface
    fun embedRemove(): Boolean = Embedder.remove(ctx)

    /** {"texts":[…]} → {"vecs":[[…1024 numbers]…]} on the phone; nothing leaves it. */
    @JavascriptInterface
    fun embed(id: String, arg: String) {
        embedPool.execute {
            try { resolve(id, JSONObject().put("vecs", Embedder.embed(ctx, JSONObject(arg).optJSONArray("texts") ?: org.json.JSONArray()))) }
            catch (e: Throwable) { reject(id, e.message ?: "The meaning model failed") }
        }
    }
    private val embedPool = java.util.concurrent.Executors.newSingleThreadExecutor()

    /* ---- v6.16: the public Knowledge packs as search databases (KnowPacks) ---- */
    @JavascriptInterface
    fun knowPacks(): String = try { JSONObject().put("packs", KnowPacks.list(ctx)).toString() } catch (e: Throwable) { "{\"packs\":[]}" }

    @JavascriptInterface
    fun knowRemote(id: String, arg: String) {
        if (blockedByAirGap(id, "checking the Knowledge packs")) return
        pool.execute { try { resolve(id, KnowPacks.remote(JSONObject(arg).getString("id"))) } catch (e: Throwable) { reject(id, e.message ?: "Couldn't check the pack") } }
    }

    /** pack id → the page's calls waiting for it. One download per pack: the quiet auto-download and a tap on Download
     *  for the same pack used to run side by side on the same files and spoil each other ("it keeps loading only"). */
    private val knowJobs = HashMap<String, MutableList<String>>()
    private val knowFlags = ConcurrentHashMap<String, AtomicBoolean>()   // a Stop from any waiting call stops the one download

    @JavascriptInterface
    fun knowInstall(id: String, arg: String) {
        if (blockedByAirGap(id, "downloading a Knowledge pack")) return
        val pack = try { JSONObject(arg).getString("id") } catch (e: Exception) { reject(id, "Unknown pack"); return }
        synchronized(knowJobs) {
            val running = knowJobs[pack]
            if (running != null) { running.add(id); knowFlags[pack]?.let { cancels[id] = it }; progress(id, 0, "", ""); return }   // join the download already running
            knowJobs[pack] = mutableListOf(id)
        }
        val flag = AtomicBoolean(false); cancels[id] = flag; knowFlags[pack] = flag
        fun waiting(): List<String> = synchronized(knowJobs) { knowJobs[pack]?.toList() ?: listOf(id) }
        pool.execute {
            try {
                val man = KnowPacks.install(ctx, pack, { done, total, name ->
                    val pct = if (total > 0) ((done * 100) / total).toInt().coerceIn(0, 99) else 0
                    val detail = "%.1f / %.1f MB".format(done / 1e6, total / 1e6)
                    for (c in waiting()) progress(c, pct, name, detail)
                }, { flag.get() })
                val all = synchronized(knowJobs) { knowJobs.remove(pack) ?: mutableListOf(id) }
                for (c in all) resolve(c, man)
            } catch (e: Throwable) {
                val all = synchronized(knowJobs) { knowJobs.remove(pack) ?: mutableListOf(id) }
                for (c in all) reject(c, e.message ?: "Couldn't download the pack")
            }
            finally { knowFlags.remove(pack); cancels.entries.removeIf { it.value === flag } }
        }
    }

    @JavascriptInterface
    fun knowRemove(packId: String): Boolean = KnowPacks.remove(ctx, packId)

    /** v6.16: on Wi-Fi (or another unmetered network)? Big downloads wait for it. */
    @JavascriptInterface
    fun unmetered(): Boolean {
        return try {
            val cm = ctx.getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
            cm.isActiveNetworkMetered.not()
        } catch (e: Throwable) { false }
    }

    /** v6.32 packs → courses: {pack} → {sections: [{title, n}]} in book order; {pack, title} → {passages: [{text, url}]} */
    @JavascriptInterface
    fun knowToc(id: String, arg: String) {
        pool.execute { try { resolve(id, JSONObject().put("sections", KnowPacks.toc(ctx, JSONObject(arg).getString("pack")))) } catch (e: Throwable) { reject(id, e.message ?: "Couldn't read the pack") } }
    }

    // (v6.32's placeholder driveSync is replaced by the real one at the top — v6.37, GoogleDrive.kt)

    @JavascriptInterface
    fun knowSection(id: String, arg: String) {
        pool.execute {
            try { val a = JSONObject(arg); resolve(id, JSONObject().put("passages", KnowPacks.section(ctx, a.getString("pack"), a.getString("title"), a.optInt("max", 14)))) }
            catch (e: Throwable) { reject(id, e.message ?: "Couldn't read the pack") }
        }
    }

    /** Search the installed packs ({q, k}) → {passages: [...]} — fast (SQLite FTS), so Chat calls it on every lookup. */
    @JavascriptInterface
    fun knowSearch(id: String, arg: String) {
        pool.execute { try { resolve(id, KnowPacks.search(ctx, arg)) } catch (e: Throwable) { reject(id, e.message ?: "Couldn't search") } }
    }

    /* ---- v6.15: whole-country offline maps (MapPacks) ---- */
    /** The packs on the phone → {packs: [...], assets: bool} */
    @JavascriptInterface
    fun mapPacks(): String = try { JSONObject().put("packs", MapPacks.list(ctx)).put("assets", MapPacks.assetsInstalled(ctx)).toString() } catch (e: Throwable) { "{\"packs\":[]}" }

    /** v6.27 "Money tracks itself": payment notifications read on the phone (PayListener). */
    /** Is the payment-notification reader in this build? (Only the Play Store build has it.) */
    @JavascriptInterface
    fun payAvailable(): Boolean = try {
        ctx.packageManager.queryIntentServices(android.content.Intent("android.service.notification.NotificationListenerService").setPackage(ctx.packageName), 0).isNotEmpty()
    } catch (e: Throwable) { false }
    @JavascriptInterface
    fun payAccess(): Boolean = try { PayLog.enabled(ctx) } catch (e: Throwable) { false }
    @JavascriptInterface
    fun openPayAccess() { PayLog.openSettings(ctx) }
    /** v6.34: Attune's App info — where "Allow restricted settings" is (⋮), for an APK not installed from Google Play. */
    @JavascriptInterface
    fun openAppInfo() {
        try { ctx.startActivity(android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, android.net.Uri.parse("package:" + ctx.packageName)).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) {}
    }
    @JavascriptInterface
    fun payQueue(): String = try { PayLog.list(ctx) } catch (e: Throwable) { "[]" }

    /** v6.40 Message alerts: the rules (JSON array), saved as {rules, lang}; the last alerts. Checked by PayListener. */
    @JavascriptInterface
    fun watchRules(): String = try { MessageWatch.rules(ctx) } catch (e: Throwable) { "[]" }
    @JavascriptInterface
    fun watchSave(json: String) { try { MessageWatch.save(ctx, json) } catch (e: Throwable) { } }
    @JavascriptInterface
    fun watchHits(): String = try { MessageWatch.hits(ctx) } catch (e: Throwable) { "[]" }
    /** v6.43 (Ali: "the business apps on their own"): pin a whole part of Attune (Business) to the home screen as its own app
        icon — tapping it opens Attune straight on that part. Android asks the person first. */
    @JavascriptInterface
    fun pinTool(mode: String, label: String): Boolean = try {
        val sm = ctx.getSystemService(android.content.pm.ShortcutManager::class.java)
        if (sm == null || !sm.isRequestPinShortcutSupported || !Regex("^[a-z]{2,20}$").matches(mode)) false else {
            val i = android.content.Intent(ctx, MainActivity::class.java).setAction(android.content.Intent.ACTION_VIEW)
                .putExtra(EXTRA_OPEN_PAGE, mode).addFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val info = android.content.pm.ShortcutInfo.Builder(ctx, "tool-" + mode)
                .setShortLabel(label.ifBlank { "Attune" }.take(24)).setLongLabel(label.ifBlank { "Attune" }.take(60))
                .setIcon(android.graphics.drawable.Icon.createWithResource(ctx, if (mode == "business") R.drawable.ic_shortcut_business else R.mipmap.ic_launcher)).setIntent(i).build()
            sm.requestPinShortcut(info, null)
        }
    } catch (e: Throwable) { false }

    /** v6.40 (C5): pin a saved page (an artifact made in Chat: a tracker, a checklist) to the home screen as its own icon.
        Tapping it opens Attune straight on that page. Android asks the person first; false when the launcher can't pin. */
    @JavascriptInterface
    fun pinPage(artifactId: String, label: String): Boolean = try {
        val sm = ctx.getSystemService(android.content.pm.ShortcutManager::class.java)
        if (sm == null || !sm.isRequestPinShortcutSupported) false else {
            val i = android.content.Intent(ctx, MainActivity::class.java).setAction(android.content.Intent.ACTION_VIEW)
                .putExtra(EXTRA_OPEN_ARTIFACT, artifactId).addFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP)
            val info = android.content.pm.ShortcutInfo.Builder(ctx, "page-" + artifactId.take(40))
                .setShortLabel(label.ifBlank { "Attune" }.take(24)).setLongLabel(label.ifBlank { "Attune" }.take(60))
                .setIcon(android.graphics.drawable.Icon.createWithResource(ctx, R.mipmap.ic_launcher)).setIntent(i).build()
            sm.requestPinShortcut(info, null)
        }
    } catch (e: Throwable) { false }
    /** v6.41 C3: the automations — save {rules, lang}; read them; take the fired events (the queue empties). */
    @JavascriptInterface
    fun autoSave(json: String) { try { AutoRules.save(ctx, json) } catch (e: Throwable) { } }
    @JavascriptInterface
    fun autoRules(): String = try { AutoRules.rules(ctx) } catch (e: Throwable) { "[]" }
    @JavascriptInterface
    fun autoTake(): String = try { AutoRules.take(ctx) } catch (e: Throwable) { "[]" }

    /** v6.40 Recall: keep notifications for 30 days (on/off — off forgets them), read them, forget some. */
    @JavascriptInterface
    fun recallNotesOn(on: Boolean) { try { RecallLog.setOn(ctx, on) } catch (e: Throwable) { } }
    @JavascriptInterface
    fun recallNotesIsOn(): Boolean = try { RecallLog.isOn(ctx) } catch (e: Throwable) { false }
    @JavascriptInterface
    fun recallNotes(): String = try { RecallLog.items(ctx) } catch (e: Throwable) { "[]" }
    @JavascriptInterface
    fun recallForget(idsJson: String) { try { RecallLog.forget(ctx, idsJson) } catch (e: Throwable) { } }
    // v8.7 (Ali: "messages in Recall stay forever, with backups like WhatsApp"): older ones by words, everything for the backup
    @JavascriptInterface
    fun recallFind(termsJson: String, limit: Int): String = try { RecallLog.find(ctx, termsJson, limit) } catch (e: Throwable) { "[]" }
    @JavascriptInterface
    fun recallCount(): Long = try { RecallLog.count(ctx) } catch (e: Throwable) { 0L }
    @JavascriptInterface
    fun recallExport(): String = try { RecallLog.exportAll(ctx) } catch (e: Throwable) { "[]" }
    @JavascriptInterface
    fun recallImport(json: String): Int = try { RecallLog.importAll(ctx, json) } catch (e: Throwable) { 0 }
    @JavascriptInterface
    fun recallForgetAll() { try { RecallLog.forgetAll(ctx) } catch (e: Throwable) { } }
    @JavascriptInterface
    fun payForget(idsJson: String) { try { PayLog.remove(ctx, idsJson) } catch (e: Throwable) { } }

    /** v6.27: a piece of a published map file, read online ({code, name, offset, length}) → {b64}. */
    @JavascriptInterface
    fun mapRange(id: String, arg: String) {
        if (blockedByAirGap(id, "showing the online map")) return
        pool.execute { try { resolve(id, MapPacks.range(arg)) } catch (e: Throwable) { reject(id, e.message ?: "Couldn't read the online map") } }
    }

    /** v6.27: the map fonts and icons only (a few MB, once) — before a country is shown online. */
    @JavascriptInterface
    fun mapAssets(id: String, arg: String) {
        if (blockedByAirGap(id, "downloading the map fonts")) return
        pool.execute { try { resolve(id, MapPacks.ensureAssets(ctx) { false }) } catch (e: Throwable) { reject(id, e.message ?: "Couldn't download the map fonts") } }
    }

    /** The published manifest of a country ({code}) — to offer a download or an update. */
    @JavascriptInterface
    fun mapRemote(id: String, arg: String) {
        if (blockedByAirGap(id, "checking for map updates")) return
        pool.execute { try { resolve(id, MapPacks.remote(JSONObject(arg).getString("code"))) } catch (e: Throwable) { reject(id, e.message ?: "Couldn't check the map") } }
    }

    /** Downloads or updates a country ({code}), with progress; cancel(id) stops it (it continues next time). */
    @JavascriptInterface
    fun mapInstall(id: String, arg: String) {
        if (blockedByAirGap(id, "downloading a map")) return
        val flag = AtomicBoolean(false); cancels[id] = flag
        pool.execute {
            try {
                val a = JSONObject(arg); val code = a.getString("code")
                val prog = { done: Long, total: Long, name: String ->
                    val pct = if (total > 0) ((done * 100) / total).toInt().coerceIn(0, 99) else 0
                    progress(id, pct, name, "%.0f / %.0f MB".format(done / 1e6, total / 1e6))
                }
                // v6.20: {code, routesOnly: true} = the offline directions of an installed country; {code, routes: true} = map + directions
                val man = if (a.optBoolean("routesOnly")) MapPacks.installRoutes(ctx, code, prog, { flag.get() })
                    else MapPacks.install(ctx, code, prog, { flag.get() }, a.optBoolean("routes"))
                resolve(id, man)
            } catch (e: MapPacks.Cancelled) {
                reject(id, "Download paused — it continues where it stopped next time.")
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't download the map") }
            finally { cancels.remove(id) }
        }
    }

    @JavascriptInterface
    fun mapRemove(code: String): Boolean = MapPacks.remove(ctx, code)

    /** Bytes of a map file for the page ({path, offset, length}) → base64 ("" when missing). Called often: kept synchronous. */
    @JavascriptInterface
    fun mapRead(arg: String): String = try { MapPacks.read(ctx, arg) } catch (e: Throwable) { "" }

    /** Offline place search in the installed packs ({q, limit, lat, lon}) → {places: [...]} */
    @JavascriptInterface
    fun mapSearch(id: String, arg: String) {
        pool.execute { try { resolve(id, JSONObject().put("places", MapPacks.search(ctx, arg))) } catch (e: Throwable) { reject(id, e.message ?: "Couldn't search the map") } }
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

    /** v6.43: scan a barcode LIVE — Google's camera screen opens, aim at the code, it closes by itself → {codes: [..]}.
     *  "Cancelled" when the person backs out; any other failure (no Google Play services) → the page offers a photo instead. */
    @JavascriptInterface
    fun scanLive(id: String, arg: String) {
        try {
            val opts = com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(com.google.mlkit.vision.barcode.common.Barcode.FORMAT_EAN_13,
                    com.google.mlkit.vision.barcode.common.Barcode.FORMAT_EAN_8, com.google.mlkit.vision.barcode.common.Barcode.FORMAT_UPC_A,
                    com.google.mlkit.vision.barcode.common.Barcode.FORMAT_UPC_E, com.google.mlkit.vision.barcode.common.Barcode.FORMAT_CODE_128,
                    com.google.mlkit.vision.barcode.common.Barcode.FORMAT_QR_CODE)
                .enableAutoZoom().build()
            com.google.mlkit.vision.codescanner.GmsBarcodeScanning.getClient(ctx, opts).startScan()
                .addOnSuccessListener { b -> resolve(id, JSONObject().put("codes", org.json.JSONArray().apply { b.rawValue?.let { if (it.isNotBlank()) put(it) } })) }
                .addOnCanceledListener { reject(id, "Cancelled") }
                .addOnFailureListener { e -> reject(id, e.message ?: "The camera scanner isn't available on this phone") }
        } catch (e: Throwable) { reject(id, e.message ?: "The camera scanner isn't available on this phone") }
    }

    /** v6.16c: the text in a photo ({b64}), read on the phone by ML Kit (Latin) → {text, lines: [{text, h, y}]} — h = the
     *  line's height in pixels (the biggest line is usually the dish's name), y = its top. */
    @JavascriptInterface
    fun readText(id: String, arg: String) {
        pool.execute {
            try {
                val bytes = android.util.Base64.decode(JSONObject(arg).getString("b64"), android.util.Base64.DEFAULT)
                val bmp = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: throw Exception("Couldn't open that picture")
                val client = com.google.mlkit.vision.text.TextRecognition.getClient(com.google.mlkit.vision.text.latin.TextRecognizerOptions.DEFAULT_OPTIONS)
                val found = com.google.android.gms.tasks.Tasks.await(client.process(com.google.mlkit.vision.common.InputImage.fromBitmap(bmp, 0)), 20, java.util.concurrent.TimeUnit.SECONDS)
                val lines = org.json.JSONArray()
                for (block in found.textBlocks) for (line in block.lines) {
                    val b = line.boundingBox
                    lines.put(JSONObject().put("text", line.text).put("h", b?.height() ?: 0).put("y", b?.top ?: 0)
                        .put("x", b?.left ?: 0).put("w", b?.width() ?: 0))   // v6.27: where the line is, to draw its translation over it
                }
                val bw = bmp.width; val bh = bmp.height
                client.close(); bmp.recycle()
                resolve(id, JSONObject().put("text", found.text).put("lines", lines).put("width", bw).put("height", bh))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't read the text in that picture") }
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

    /** v6.38 Studio eraser: {file | photo (data URL), mask (PNG data URL, painted = remove)} → a new picture. */
    @JavascriptInterface
    fun eraseImage(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                val b64 = { k: String -> a.optString(k).takeIf { it.isNotEmpty() }?.let { android.util.Base64.decode(it.substringAfter(","), android.util.Base64.DEFAULT) } }
                val mk = b64("mask") ?: throw IllegalStateException("Paint over what to remove first.")
                // v6.43: Eraser HD (LaMa) when it is on the phone and the page asks for it
                resolve(id, imageResult(if (a.optBoolean("hd") && Eraser.hdReady(ctx)) Eraser.eraseHD(ctx, a.optString("file"), b64("photo"), mk) else Eraser.erase(ctx, a.optString("file"), b64("photo"), mk)))
            } catch (e: OutOfMemoryError) { reject(id, "The photo is too big for the eraser — try a smaller one") }
            catch (e: Throwable) { reject(id, e.message ?: "The eraser failed") }
        }
    }

    /** v6.43: the people and things in a photo, each as its own shape (PhotoSmart.kt): {file | photo} → {w, h, subjects}. */
    @JavascriptInterface
    fun findSubjects(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                val photo = a.optString("photo").takeIf { it.isNotEmpty() }?.let { android.util.Base64.decode(it.substringAfter(","), android.util.Base64.DEFAULT) }
                resolve(id, PhotoSmart.subjects(ctx, a.optString("file"), photo))
            } catch (e: OutOfMemoryError) { reject(id, "The photo is too big — try a smaller one") }
            catch (e: Throwable) { reject(id, e.message ?: "Couldn't find what is in the photo") }
        }
    }

    /** v6.41 (C2): a picture made on the page (an edit kept only where it was painted) → Studio's gallery: {b64} → the picture. */
    @JavascriptInterface
    fun savePicture(id: String, arg: String) {
        pool.execute {
            try {
                val bytes = android.util.Base64.decode(JSONObject(arg).getString("b64").substringAfter(","), android.util.Base64.DEFAULT)
                val f = java.io.File(ImageEngine.studioDir(ctx), "img-" + System.currentTimeMillis().toString(36) + "-area.png")
                f.writeBytes(bytes)
                resolve(id, imageResult(ImageEngine.Result(f, "page", 0, false)))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't keep the picture") }
        }
    }

    /** v6.38: Studio was left — the eraser's model goes back to the phone's memory. */
    @JavascriptInterface
    fun eraserRelease() { pool.execute { Eraser.release() } }

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
                resolve(id, DocTools.pdfText(ctx, android.util.Base64.decode(a.getString("b64"), android.util.Base64.DEFAULT), textOnly = a.optBoolean("textOnly", false), maxPages = a.optInt("max", 400), from = a.optInt("from", 1)))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't read that PDF") }
        }
    }

    /** v6.20 — word boxes of some pages (the reader's highlights and text selection). arg = {b64, pages} */
    @JavascriptInterface
    fun pdfWords(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                val pages = a.optJSONArray("pages")?.let { p -> (0 until p.length()).map { p.getInt(it) } } ?: listOf(1)
                resolve(id, DocTools.pdfWords(ctx, android.util.Base64.decode(a.getString("b64"), android.util.Base64.DEFAULT), pages))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't read that PDF") }
        }
    }

    /** v6.20 — the PDF's table of contents. arg = {b64} -> {items:[{title, page, level}]} */
    @JavascriptInterface
    fun pdfOutline(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                resolve(id, JSONObject().put("items", DocTools.pdfOutline(ctx, android.util.Base64.decode(a.getString("b64"), android.util.Base64.DEFAULT))))
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
        try { val a = JSONObject(arg); if (if (a.has("uri")) MediaTools.openUri(ctx, a.getString("uri"), a.optString("type", "video/*")) else MediaTools.openFile(ctx, a.getLong("id"))) resolve(id, JSONObject().put("ok", true)) else reject(id, "The file was moved or deleted") }
        catch (e: Throwable) { reject(id, e.message ?: "Couldn't open the video") }
    }

    /** v6.45 (W6): can this phone make subtitles (Android 13+ with an on-device speech recogniser)? */
    @JavascriptInterface
    fun subtitlesAvailable(): Boolean = try { Subtitles.available(ctx) } catch (e: Throwable) { false }

    /** {id (download), lang} → {cues: [{start, end, text}]} with progress; cancel(id) stops it. Nothing leaves the phone. */
    @JavascriptInterface
    fun videoSubtitles(id: String, arg: String) {
        val act = ctx as? android.app.Activity ?: return reject(id, "Subtitles need the app's window")
        val flag = AtomicBoolean(false); cancels[id] = flag
        pool.execute {
            try {
                val a = JSONObject(arg)
                val cues = Subtitles.make(act, a.getLong("id"), a.optString("lang", "ar-EG"), { done, all ->
                    progress(id, if (all > 0) (done * 100 / all).coerceIn(0, 99) else 0, "listening", "$done / $all")
                }, { flag.get() })
                resolve(id, JSONObject().put("cues", cues))
            } catch (e: Subtitles.Cancelled) { reject(id, "Stopped") }
            catch (e: Throwable) { reject(id, e.message ?: "Couldn't make the subtitles") }
            finally { cancels.remove(id) }
        }
    }

    /** v6.48 (CHAT_RUNS_APP.md S8/S9): a file attached on Home (a video or a recording) reaches the app in pieces of base64 —
     *  { name, b64, first } → appended to cache/media-in/<name>; → { path, bytes }. Only that folder is ever written. */
    @JavascriptInterface
    fun cacheAppend(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                val dir = java.io.File(ctx.cacheDir, "media-in"); dir.mkdirs()
                val name = a.optString("name", "media").replace(Regex("[^A-Za-z0-9._-]"), "_").take(80).ifEmpty { "media" }
                val f = java.io.File(dir, name)
                if (a.optBoolean("first")) { dir.listFiles()?.filter { it.name != name && System.currentTimeMillis() - it.lastModified() > 6 * 3600_000L }?.forEach { it.delete() }; f.delete() }
                java.io.FileOutputStream(f, true).use { it.write(android.util.Base64.decode(a.optString("b64", ""), android.util.Base64.DEFAULT)) }
                resolve(id, JSONObject().put("path", f.name).put("bytes", f.length()))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't keep the file") }
        }
    }

    /** v6.48: words said in a video or recording sent with cacheAppend → [{start, end, text}] (the same offline reader as Subtitles). */
    @JavascriptInterface
    fun subtitlesFile(id: String, arg: String) {
        val act = ctx as? android.app.Activity ?: return reject(id, "Subtitles need the app's window")
        val flag = AtomicBoolean(false); cancels[id] = flag
        pool.execute {
            val a = JSONObject(arg)
            val f = java.io.File(java.io.File(ctx.cacheDir, "media-in"), a.optString("path", "").replace(Regex("[^A-Za-z0-9._-]"), "_"))
            try {
                if (!f.exists()) throw IllegalStateException("The file is not here any more — attach it again")
                val cues = Subtitles.make(act, android.net.Uri.fromFile(f), a.optString("lang", "ar-EG"), { done, all ->
                    progress(id, if (all > 0) (done * 100 / all).coerceIn(0, 99) else 0, "listening", "$done / $all")
                }, { flag.get() })
                resolve(id, JSONObject().put("cues", cues))
            } catch (e: Subtitles.Cancelled) { reject(id, "Stopped") }
            catch (e: Throwable) { reject(id, e.message ?: "Couldn't read what is said") }
            finally { cancels.remove(id); if (a.optBoolean("drop", true)) f.delete() }
        }
    }

    @JavascriptInterface
    fun videoClip(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                resolve(id, MediaTools.clip(ctx, a.getLong("id"), a.optLong("start", 0), a.optLong("end", 0), a.optBoolean("audio"), a.optString("name", "clip")))
            } catch (e: Throwable) { reject(id, e.message ?: "Couldn't cut the video") }
        }
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

    /** Share a file the page made (an invoice PDF, a statement) to WhatsApp, Gmail… arg = {name, mime, b64, text?}. */
    @JavascriptInterface
    fun shareFile(id: String, arg: String) {
        pool.execute {
            try {
                val a = JSONObject(arg)
                val name = java.io.File(a.optString("name", "document")).name.ifBlank { "document" }
                val dir = java.io.File(ctx.filesDir, "shared").apply { mkdirs() }
                dir.listFiles()?.forEach { if (System.currentTimeMillis() - it.lastModified() > 3_600_000L) it.delete() }   // nothing is kept long
                val f = java.io.File(dir, name)
                f.writeBytes(android.util.Base64.decode(a.getString("b64"), android.util.Base64.DEFAULT))
                web.post {
                    try {
                        val uri = androidx.core.content.FileProvider.getUriForFile(ctx, ctx.packageName + ".files", f)
                        val send = android.content.Intent(android.content.Intent.ACTION_SEND).setType(a.optString("mime", "application/pdf"))
                            .putExtra(android.content.Intent.EXTRA_STREAM, uri).addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        val t = a.optString("text", "")
                        if (t.isNotEmpty()) send.putExtra(android.content.Intent.EXTRA_TEXT, t)
                        ctx.startActivity(android.content.Intent.createChooser(send, null).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
                        resolve(id, JSONObject().put("ok", true))
                    } catch (e: Exception) { reject(id, e.message ?: "Could not share the file") }
                }
            } catch (e: Exception) { reject(id, e.message ?: "Could not share the file") }
        }
    }

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
