package com.aldibiki.attune

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/** v9.9.29 the night run of AI jobs (Ali: "Do it"): with Attune closed, a job whose time came runs while the phone is charging.
 *  The page hands over the PLAN (aijobs.js nightPlan: each run with its key, time, ready messages and the notification title);
 *  this runs the due ones once (dueNight mirror), keeps each answer for the page (mergeNight on the next open) and posts it.
 *  The model is started only for this and stopped again when it was off before. */
object AiNight {
    private const val PLAN = "ainight-plan.json"
    private const val OUT = "ainight-out.json"
    private const val PREFS = "ainight"
    private const val CHANNEL = "ainight"

    @Synchronized fun set(ctx: Context, json: String) {
        File(ctx.filesDir, PLAN).writeText(json)
        // done keys that are no longer in the plan are forgotten
        val keys = runs(ctx).let { r -> (0 until r.length()).map { r.getJSONObject(it).optString("key") }.toSet() }
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        p.edit().putStringSet("done", (p.getStringSet("done", emptySet()) ?: emptySet()).filter { it in keys }.toSet()).apply()
        schedule(ctx)
    }

    @Synchronized fun take(ctx: Context): String {
        val f = File(ctx.filesDir, OUT)
        val s = try { if (f.exists()) f.readText() else "[]" } catch (e: Exception) { "[]" }
        try { f.delete() } catch (e: Exception) {}
        return s
    }

    private fun plan(ctx: Context): JSONObject = try { JSONObject(File(ctx.filesDir, PLAN).readText()) } catch (e: Exception) { JSONObject() }
    private fun runs(ctx: Context): JSONArray = plan(ctx).optJSONArray("runs") ?: JSONArray()
    private fun done(ctx: Context): Set<String> = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet("done", emptySet()) ?: emptySet()

    /** = aijobs.js dueNight: due, not done, the newest one per job, oldest first. */
    fun due(runs: JSONArray, done: Set<String>, now: Long): List<JSONObject> {
        val latest = LinkedHashMap<String, JSONObject>()
        for (i in 0 until runs.length()) {
            val r = runs.optJSONObject(i) ?: continue
            val at = r.optLong("at"); val job = r.optString("job")
            if (at <= now && r.optString("key") !in done && (latest[job]?.optLong("at") ?: Long.MIN_VALUE) < at) latest[job] = r
        }
        return latest.values.sortedBy { it.optLong("at") }
    }

    /** The job waits for the next run's time AND for the charger (Android runs it once both are true). */
    fun schedule(ctx: Context) {
        val js = ctx.getSystemService(android.app.job.JobScheduler::class.java) ?: return
        val r = runs(ctx); val d = done(ctx); val now = System.currentTimeMillis()
        var first = Long.MAX_VALUE
        for (i in 0 until r.length()) { val x = r.optJSONObject(i) ?: continue; if (x.optString("key") !in d && x.optLong("at") < first) first = x.optLong("at") }
        if (first == Long.MAX_VALUE) { try { js.cancel(AiNightJob.ID) } catch (e: Exception) {}; return }
        val info = android.app.job.JobInfo.Builder(AiNightJob.ID, android.content.ComponentName(ctx, AiNightJob::class.java))
            .setRequiresCharging(true).setMinimumLatency(maxOf(0L, first - now)).setPersisted(true).build()
        try { js.schedule(info) } catch (e: Exception) {}
    }

    fun run(ctx: Context, stop: AtomicBoolean) {
        val p = plan(ctx); val list = due(p.optJSONArray("runs") ?: JSONArray(), done(ctx), System.currentTimeMillis())
        if (list.isEmpty()) { schedule(ctx); return }
        if (GenService.busy()) { retryLater(ctx); return }
        val wasReady = Engine.state == Engine.State.READY
        if (!wasReady) {
            val m = ModelStore.active(ctx) ?: return
            val latch = CountDownLatch(1); var ok = false
            Engine.start(ctx, m) { good, _ -> ok = good; latch.countDown() }
            latch.await(4, TimeUnit.MINUTES)
            if (!ok || Engine.state != Engine.State.READY) { retryLater(ctx); return }
        }
        try {
            for (r in list) {
                if (stop.get()) break
                val text = try { generate(ctx, r.optJSONArray("messages") ?: JSONArray(), stop).trim() } catch (e: Exception) { "" }
                if (stop.get()) break
                if (text.isBlank()) continue
                keep(ctx, r, text)
                notify(ctx, r, text)
            }
        } finally {
            if (!wasReady) try { Engine.stop() } catch (e: Throwable) {}
        }
        schedule(ctx)
    }

    @Synchronized private fun keep(ctx: Context, r: JSONObject, text: String) {
        val f = File(ctx.filesDir, OUT)
        val a = try { JSONArray(f.readText()) } catch (e: Exception) { JSONArray() }
        a.put(JSONObject().put("key", r.optString("key")).put("job", r.optString("job")).put("title", r.optString("title"))
            .put("at", r.optLong("at")).put("ranAt", System.currentTimeMillis()).put("text", text).put("data", r.optString("data")))
        f.writeText(a.toString())
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        // a run done also covers the older runs of the same job (the phone was off: the newest one stands for them)
        val all = runs(ctx); val cover = (0 until all.length()).map { all.getJSONObject(it) }
            .filter { it.optString("job") == r.optString("job") && it.optLong("at") <= r.optLong("at") }.map { it.optString("key") }
        p.edit().putStringSet("done", (p.getStringSet("done", emptySet()) ?: emptySet()) + cover).apply()
    }

    private fun retryLater(ctx: Context) {
        val js = ctx.getSystemService(android.app.job.JobScheduler::class.java) ?: return
        val info = android.app.job.JobInfo.Builder(AiNightJob.ID, android.content.ComponentName(ctx, AiNightJob::class.java))
            .setRequiresCharging(true).setMinimumLatency(20 * 60_000L).setPersisted(true).build()
        try { js.schedule(info) } catch (e: Exception) {}
    }

    /** One answer from the model on this phone (llama-server, or the fast engine) — the same call as the Attune keyboard. */
    private fun generate(ctx: Context, msgs: JSONArray, stop: AtomicBoolean): String {
        val body = JSONObject().put("messages", msgs).put("temperature", 0.2).put("max_tokens", 500).put("stream", false)
            .put("chat_template_kwargs", JSONObject().put("enable_thinking", false))
        if (Engine.kind == "litert") return FastEngine.chat(ctx, "night-" + System.currentTimeMillis(), body, stop) { _, _ -> }.optString("content")
        val c = URL(Engine.baseUrl + "/v1/chat/completions").openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 3000; c.readTimeout = 240000
        c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("Authorization", "Bearer " + Engine.apiKey)
        c.outputStream.use { it.write(body.toString().toByteArray()) }
        val code = c.responseCode
        val txt = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        c.disconnect()
        if (code !in 200..299) throw java.io.IOException("The model answered $code")
        return JSONObject(txt).optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")?.optString("content") ?: ""
    }

    private fun notify(ctx: Context, r: JSONObject, text: String) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val lang = plan(ctx).optString("lang"); val ar = lang == "ar" || lang == "arb"
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null)
            nm.createNotificationChannel(NotificationChannel(CHANNEL, if (ar) "اتعمل لك" else "Made for you", NotificationManager.IMPORTANCE_DEFAULT))
        val i = Intent(ctx, MainActivity::class.java).putExtra(EXTRA_OPEN_PAGE, "home").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(ctx, ("ainight" + r.optString("key")).hashCode(), i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val b = (if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") android.app.Notification.Builder(ctx))
            .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(r.optString("head").ifBlank { r.optString("title") }).setContentText(text)
            .setStyle(android.app.Notification.BigTextStyle().bigText(text)).setAutoCancel(true).setContentIntent(pi)
        try { nm.notify(("ainight" + r.optString("key")).hashCode(), b.build()) } catch (e: SecurityException) { }
    }
}

/** Android starts this when a job's time came and the phone is charging; it may run up to 10 minutes. */
class AiNightJob : android.app.job.JobService() {
    companion object { const val ID = 0x5c0b1 }
    private val stop = AtomicBoolean(false)
    @Volatile private var worker: Thread? = null
    override fun onStartJob(params: android.app.job.JobParameters): Boolean {
        stop.set(false)
        worker = Thread {
            try { AiNight.run(applicationContext, stop) } catch (e: Throwable) {} finally { try { jobFinished(params, false) } catch (e: Throwable) {} }
        }.also { it.start() }
        return true
    }
    override fun onStopJob(params: android.app.job.JobParameters): Boolean { stop.set(true); try { worker?.interrupt() } catch (e: Throwable) {}; return true }
}
