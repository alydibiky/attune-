package com.aldibiki.attune

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * v10.9.3 BK3 (Ali's OK-BK, 23 Nov 2026: "always know that bank messages are being read"): once an hour, while notification access was
 * ever on, Attune checks that its notification reader still works. If it stopped — access turned off, a money SMS came while the SMS
 * switch is off, or nothing at all for 6 hours while the phone is in use — ONE notification says so, with "Fix it now"; at most one a
 * day, never at night (23:00–08:00). After the fix Attune reads what is still on the screen and says "reading again ✓" (the tap opens
 * Read from your messages, where each message shows where it went).
 * The rule is web-src/readlog.js stopAlert — keep the two equal (tests/readlog/gen.mjs runs 10,000 timelines on the page's copy and
 * tests/unit/v1093readlog.test.mjs checks this file still says the same numbers). The words come from the page, in the person's
 * language (readWatchSet).
 */
object ReadWatch {
    private const val PREFS = "attune.readwatch"
    private const val CHANNEL = "readwatch"
    private const val WORK = "attune-readwatch"
    const val ACT = "com.aldibiki.attune.READWATCH"
    const val EXTRA_WHY = "attune.rw.why"
    private const val SILENT_H = 6
    private const val ALERT_GAP_H = 24
    private const val NIGHT_FROM = 23
    private const val NIGHT_TO = 8
    private const val H = 3600_000L

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** The page sends the words (translated) and switches the hourly check on. */
    fun setup(ctx: Context, words: String) {
        prefs(ctx).edit().putString("words", words.take(4000)).apply()
        if (PayLog.enabled(ctx)) prefs(ctx).edit().putBoolean("was", true).apply()
        try { WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, PeriodicWorkRequestBuilder<ReadWatchWorker>(1, TimeUnit.HOURS).build()) } catch (e: Throwable) { }
    }

    /** The same rule as readlog.js stopAlert → "" (nothing to say) · off · smsoff · silent. */
    fun decide(was: Boolean, access: Boolean, seen: Long, conn: Long, now: Long, hour: Int, interactive: Boolean, lastAlert: Long, sms: JSONArray): String {
        if (!was) return ""
        if (lastAlert > 0 && now - lastAlert < ALERT_GAP_H * H) return ""
        val night = if (NIGHT_FROM > NIGHT_TO) hour >= NIGHT_FROM || hour < NIGHT_TO else hour in NIGHT_FROM until NIGHT_TO
        if (night || !interactive) return ""
        if (!access) return "off"
        for (i in 0 until sms.length()) {
            val s = sms.optJSONObject(i) ?: continue
            val age = now - s.optLong("ts", 0L)
            if (s.has("sw") && !s.optBoolean("sw", true) && s.optBoolean("money") && !s.optBoolean("otp") && age >= 0 && age <= SILENT_H * H) return "smsoff"
        }
        val last = maxOf(seen, conn)
        if (last > 0 && now - last >= SILENT_H * H) return "silent"
        return ""
    }

    /** The hourly check. */
    fun check(ctx: Context) {
        val p = prefs(ctx); val access = PayLog.enabled(ctx)
        if (access && !p.getBoolean("was", false)) p.edit().putBoolean("was", true).apply()
        val h = try { JSONObject(PayLog.health(ctx)) } catch (e: Exception) { JSONObject() }
        val sms = try { JSONArray(SmsDiag.list(ctx)) } catch (e: Exception) { JSONArray() }
        val interactive = try { (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager).isInteractive } catch (e: Exception) { true }
        val now = System.currentTimeMillis(); val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
        val why = decide(p.getBoolean("was", false), access, h.optLong("seen"), h.optLong("conn"), now, hour, interactive, p.getLong("last", 0L), sms)
        if (why.isEmpty()) return
        p.edit().putLong("last", now).apply()
        post(ctx, why)
    }

    private fun words(ctx: Context): JSONObject = try { JSONObject(prefs(ctx).getString("words", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
    private fun channel(ctx: Context, nm: NotificationManager) {
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null)
            nm.createNotificationChannel(NotificationChannel(CHANNEL, words(ctx).optString("channel", "Bank messages"), NotificationManager.IMPORTANCE_DEFAULT))
    }
    private fun openPage(ctx: Context): PendingIntent = PendingIntent.getActivity(ctx, "rw-open".hashCode(),
        Intent(ctx, MainActivity::class.java).setAction(Intent.ACTION_VIEW).putExtra(EXTRA_OPEN_PAGE, "readlog").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    /** "Attune stopped reading bank messages" + Fix it now · Not now. */
    fun post(ctx: Context, why: String) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        channel(ctx, nm)
        val w = words(ctx); val o = w.optJSONObject(why) ?: JSONObject()
        val title = o.optString("t", "Attune stopped reading bank messages"); val body = o.optString("d", "Tap Fix it now.")
        // turning access on again needs Android's own screen: an activity, straight from the button (a receiver can't open screens)
        val fix: PendingIntent = if (why == "off") PendingIntent.getActivity(ctx, "rw-fix-off".hashCode(),
                (if (Build.VERSION.SDK_INT >= 30) Intent("android.settings.NOTIFICATION_LISTENER_DETAIL_SETTINGS").putExtra("android.provider.extra.NOTIFICATION_LISTENER_COMPONENT_NAME",
                    android.content.ComponentName(ctx, PayListener::class.java).flattenToString()) else Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            else PendingIntent.getBroadcast(ctx, "rw-fix-$why".hashCode(), Intent(ctx, ReadWatchReceiver::class.java).setAction(ACT).putExtra(EXTRA_WHY, why),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val later = PendingIntent.getBroadcast(ctx, "rw-later".hashCode(), Intent(ctx, ReadWatchReceiver::class.java).setAction(ACT).putExtra(EXTRA_WHY, "later"),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val b = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(ctx))
            .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(title).setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(openPage(ctx))
            .addAction(Notification.Action.Builder(null, w.optString("fix", "Fix it now"), fix).build())
            .addAction(Notification.Action.Builder(null, w.optString("later", "Not now"), later).build())
        try { nm.notify("readwatch".hashCode(), b.build()) } catch (e: SecurityException) { }
    }

    /** After "Fix it now": reconnect / switch SMS on, read the shade again, then "reading again ✓" when the reader is back. */
    fun fix(ctx: Context, why: String) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        try { nm?.cancel("readwatch".hashCode()) } catch (e: Exception) { }
        if (why == "later") return
        if (why == "smsoff") try { Prefs.setSmsNotifs(ctx, true) } catch (e: Exception) { }
        val l = PayListener.live
        if (l == null) try { PayLog.heal(ctx, force = true) } catch (e: Exception) { }
        Handler(Looper.getMainLooper()).postDelayed({
            val live = PayListener.live ?: return@postDelayed
            try { live.rescan() } catch (e: Exception) { }
            val w = words(ctx).optJSONObject("again") ?: JSONObject()
            if (nm == null) return@postDelayed
            channel(ctx, nm)
            val b = (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(ctx))
                .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(w.optString("t", "Attune is reading again ✓")).setContentText(w.optString("d", "Tap to see what was read and where it went."))
                .setAutoCancel(true).setContentIntent(openPage(ctx))
            try { nm.notify("readwatch-ok".hashCode(), b.build()) } catch (e: SecurityException) { }
        }, if (l == null) 8000L else 1500L)
    }
}

class ReadWatchWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result { try { ReadWatch.check(applicationContext) } catch (e: Throwable) { }; return Result.success() }
}

class ReadWatchReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != ReadWatch.ACT) return
        val pr = goAsync()
        try { ReadWatch.fix(ctx.applicationContext, intent.getStringExtra(ReadWatch.EXTRA_WHY) ?: "silent") } catch (e: Throwable) { }
        Handler(Looper.getMainLooper()).postDelayed({ try { pr.finish() } catch (e: Throwable) { } }, 9000L)
    }
}
