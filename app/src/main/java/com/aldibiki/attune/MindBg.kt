package com.aldibiki.attune

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** v9.9.36 BG-3 (Ali picked: "there is no problem when the app is closed for the model to think and filter notifications with the help of
 *  the code, even if each notification takes 30 s to 1 min"): with Attune closed, the phone's model reads the new notifications —
 *  only while charging, or with the battery above 40 % and the screen off; on battery saver it waits. The page hands over the prompt
 *  (notifmind.js mindPrompt, the day as {DATE}) and the apps code is always sure of; the raw answers are kept by notification id and
 *  merged with code's reading when Attune opens (notifmind-ui.jsx: the model decides only where code was unsure). A quiet
 *  notification shows while it reads. At most 12 a round and 40 a day. */
object MindBg {
    private const val TPL = "mindbg-tpl.json"
    private const val OUT = "mindbg-out.json"
    private const val PREFS = "mindbg"
    private const val CHANNEL = "mindbg"
    private const val NOTE_ID = 7311
    const val JOB_ID = 0x5c0b5

    fun set(ctx: Context, json: String) { try { File(ctx.filesDir, TPL).writeText(json) } catch (e: Exception) {}; schedule(ctx) }
    fun take(ctx: Context): String {
        val f = File(ctx.filesDir, OUT)
        val s = try { if (f.exists()) f.readText() else "[]" } catch (e: Exception) { "[]" }
        try { f.delete() } catch (e: Exception) {}
        return s
    }
    fun on(ctx: Context): Boolean = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("on", true)
    fun setOn(ctx: Context, v: Boolean) { ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("on", v).apply(); schedule(ctx) }
    /** {day, count, secs} — how many were read in the background today and how long each took. */
    fun stats(ctx: Context): String { val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return JSONObject().put("day", p.getString("day", "")).put("count", p.getInt("count", 0)).put("secs", p.getLong("secs", 0L)).put("on", on(ctx)).toString() }

    fun schedule(ctx: Context) {
        val js = ctx.getSystemService(android.app.job.JobScheduler::class.java) ?: return
        if (!on(ctx)) { try { js.cancel(JOB_ID) } catch (e: Exception) {}; return }
        if (js.getPendingJob(JOB_ID) != null) return
        val info = android.app.job.JobInfo.Builder(JOB_ID, android.content.ComponentName(ctx, MindBgJob::class.java))
            .setRequiresBatteryNotLow(true).setPeriodic(60 * 60_000L, 20 * 60_000L).setPersisted(true).build()
        try { js.schedule(info) } catch (e: Exception) {}
    }

    /** Charging — or above 40 % with the screen off and no battery saver. */
    fun allowedNow(ctx: Context): Boolean {
        val b = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return false
        val plugged = b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0
        if (plugged) return true
        val lvl = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1); val scale = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
        val pct = if (lvl >= 0 && scale > 0) lvl * 100 / scale else 0
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        return pct > 40 && !pm.isInteractive && !pm.isPowerSaveMode
    }

    private fun today() = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    fun run(ctx: Context, stop: AtomicBoolean) {
        if (!on(ctx) || !allowedNow(ctx)) return
        val tpl = try { JSONObject(File(ctx.filesDir, TPL).readText()) } catch (e: Exception) { return }
        val system = tpl.optString("system"); if (system.isBlank()) return
        val skip = HashSet<String>(); tpl.optJSONArray("skip")?.let { for (i in 0 until it.length()) skip.add(it.optString(i)) }
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (p.getString("day", "") != today()) p.edit().putString("day", today()).putInt("count", 0).putLong("secs", 0L).apply()
        val left = maxOf(0, tpl.optInt("max", 40) - p.getInt("count", 0)); if (left == 0) return
        val done = HashSet(p.getStringSet("done", emptySet()) ?: emptySet())
        val since = System.currentTimeMillis() - 3 * 86_400_000L
        val notes = try { JSONArray(RecallLog.items(ctx)) } catch (e: Exception) { JSONArray() }
        val todo = (0 until notes.length()).mapNotNull { notes.optJSONObject(it) }
            .filter { it.optLong("ts") >= since && it.optString("id") !in done && it.optString("pkg") !in skip && it.optString("text").isNotBlank() }
            .take(minOf(12, left))
        if (todo.isEmpty()) return
        if (GenService.busy()) return
        val wasReady = Engine.state == Engine.State.READY
        if (!wasReady) {
            val m = ModelStore.active(ctx) ?: return
            val latch = CountDownLatch(1); var ok = false
            Engine.start(ctx, m) { good, _ -> ok = good; latch.countDown() }
            latch.await(4, TimeUnit.MINUTES)
            if (!ok || Engine.state != Engine.State.READY) return
        }
        quiet(ctx, tpl.optJSONObject("words") ?: JSONObject(), todo.size)
        val out = try { JSONArray(File(ctx.filesDir, OUT).readText()) } catch (e: Exception) { JSONArray() }
        var n = 0; var secs = 0L
        try {
            for (note in todo) {
                if (stop.get() || !allowedNow(ctx)) break   // the person picked the phone up, or unplugged it low → stop at once
                val t0 = System.currentTimeMillis()
                val day = SimpleDateFormat("yyyy-MM-dd (EEE)", Locale.US).format(Date(note.optLong("ts")))
                val msgs = JSONArray().put(JSONObject().put("role", "system").put("content", system.replace("{DATE}", day)))
                    .put(JSONObject().put("role", "user").put("content", "App: " + note.optString("app").ifBlank { note.optString("pkg") }.take(60)
                        + "\nTitle: " + note.optString("title").take(120) + "\nText: " + note.optString("text").replace(Regex("\\s+"), " ").take(700)))
                val raw = try { generate(ctx, msgs, stop) } catch (e: Exception) { "" }
                if (stop.get()) break
                done.add(note.optString("id"))
                if (raw.isNotBlank()) { out.put(JSONObject().put("id", note.optString("id")).put("raw", raw.take(1200)).put("at", System.currentTimeMillis())); n++ }
                secs += (System.currentTimeMillis() - t0) / 1000
            }
        } finally {
            try { File(ctx.filesDir, OUT).writeText(out.toString()) } catch (e: Exception) {}
            p.edit().putStringSet("done", done.toList().takeLast(3000).toSet()).putInt("count", p.getInt("count", 0) + n)
                .putLong("secs", if (n > 0) (p.getLong("secs", 0L) * p.getInt("count", 0) + secs) / (p.getInt("count", 0) + n) else p.getLong("secs", 0L)).apply()
            if (!wasReady) try { Engine.stop() } catch (e: Throwable) {}
            try { (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(NOTE_ID) } catch (e: Exception) {}
        }
    }

    /** "Attune is reading 3 messages…" — quiet, while it works. */
    private fun quiet(ctx: Context, words: JSONObject, count: Int) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null)
            nm.createNotificationChannel(NotificationChannel(CHANNEL, words.optString("channel", "Background reading"), NotificationManager.IMPORTANCE_MIN))
        val b = (if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") android.app.Notification.Builder(ctx))
            .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(words.optString("title", "Attune"))
            .setContentText(words.optString("reading", "Reading {n} messages…").replace("{n}", count.toString())).setOngoing(true).setShowWhen(false)
        try { nm.notify(NOTE_ID, b.build()) } catch (e: SecurityException) { }
    }

    /** One short answer from the phone's model (as AiNight: llama-server, or the fast engine). */
    private fun generate(ctx: Context, msgs: JSONArray, stop: AtomicBoolean): String {
        val body = JSONObject().put("messages", msgs).put("temperature", 0).put("max_tokens", 220).put("stream", false)
            .put("chat_template_kwargs", JSONObject().put("enable_thinking", false))
        if (Engine.kind == "litert") return FastEngine.chat(ctx, "mindbg-" + System.currentTimeMillis(), body, stop) { _, _ -> }.optString("content")
        val c = URL(Engine.baseUrl + "/v1/chat/completions").openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 3000; c.readTimeout = 120000
        c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("Authorization", "Bearer " + Engine.apiKey)
        c.outputStream.use { it.write(body.toString().toByteArray()) }
        val code = c.responseCode
        val txt = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        c.disconnect()
        if (code !in 200..299) throw java.io.IOException("The model answered $code")
        return JSONObject(txt).optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")?.optString("content") ?: ""
    }
}

/** Android starts this about every hour when the battery is not low; MindBg checks the 40 % / screen-off / charging rule itself. */
class MindBgJob : android.app.job.JobService() {
    private val stop = AtomicBoolean(false)
    @Volatile private var worker: Thread? = null
    override fun onStartJob(params: android.app.job.JobParameters): Boolean {
        stop.set(false)
        worker = Thread { try { MindBg.run(applicationContext, stop) } catch (e: Throwable) {} finally { try { jobFinished(params, false) } catch (e: Throwable) {} } }.also { it.start() }
        return true
    }
    override fun onStopJob(params: android.app.job.JobParameters): Boolean { stop.set(true); try { worker?.interrupt() } catch (e: Throwable) {}; return true }
}
