package com.aldibiki.attune

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * Reminders that ring even when Attune is closed — and after the phone restarts.
 *
 * The page owns the list (it is in the backup, and it is where you edit it).
 * It hands each upcoming reminder to Reminders.schedule(); this object keeps a
 * copy in the app's private preferences so that BootReceiver can put them back
 * after a restart (Android forgets every alarm when the phone turns off), and
 * sets a system alarm that wakes ReminderReceiver at the right minute.
 *
 * Timing: with "Alarms & reminders" allowed for Attune (Android 12+ asks the
 * user in Settings), the notification comes on the minute. Without it, Android
 * only guarantees a window of about ten minutes — the page says so and offers
 * the Settings button.
 */
object Reminders {
    private const val PREFS = "attune.reminders"
    const val CHANNEL = "reminders"
    const val EXTRA_ID = "attune.reminder.id"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun all(ctx: Context): JSONArray = try { JSONArray(prefs(ctx).getString("list", "[]")) } catch (e: Exception) { JSONArray() }

    private fun save(ctx: Context, arr: JSONArray) { prefs(ctx).edit().putString("list", arr.toString()).apply() }

    fun canExact(ctx: Context): Boolean {
        if (Build.VERSION.SDK_INT < 31) return true
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return false
        return am.canScheduleExactAlarms()
    }

    /** {id, at (ms), title, body, repeat: none|daily|weekly|weekdays}. The same id replaces. */
    fun schedule(ctx: Context, r: JSONObject): Boolean {
        val id = r.optString("id").takeIf { it.isNotBlank() && it.length <= 64 } ?: return false
        val at = r.optLong("at", 0L)
        if (at <= 0L) return false
        val arr = all(ctx)
        val out = JSONArray()
        for (i in 0 until arr.length()) arr.optJSONObject(i)?.let { if (it.optString("id") != id) out.put(it) }
        out.put(JSONObject()
            .put("id", id).put("at", at)
            .put("title", r.optString("title").take(120))
            .put("body", r.optString("body").take(400))
            .put("repeat", r.optString("repeat", "none")))
        save(ctx, out)
        arm(ctx, id, at)
        return true
    }

    fun unschedule(ctx: Context, id: String): Boolean {
        val arr = all(ctx)
        val out = JSONArray()
        var found = false
        for (i in 0 until arr.length()) arr.optJSONObject(i)?.let { if (it.optString("id") == id) found = true else out.put(it) }
        save(ctx, out)
        ctx.getSystemService(AlarmManager::class.java)?.cancel(pending(ctx, id))
        return found
    }

    private fun pending(ctx: Context, id: String): PendingIntent =
        PendingIntent.getBroadcast(ctx, id.hashCode(),
            Intent(ctx, ReminderReceiver::class.java).setAction("com.aldibiki.attune.REMIND").putExtra(EXTRA_ID, id),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun arm(ctx: Context, id: String, at: Long) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val pi = pending(ctx, id)
        try {
            if (canExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
            else am.setWindow(AlarmManager.RTC_WAKEUP, at, 10 * 60_000L, pi)
        } catch (e: SecurityException) {
            am.setWindow(AlarmManager.RTC_WAKEUP, at, 10 * 60_000L, pi)
        }
    }

    /** After a restart or an app update: arm everything that is still to come. */
    fun rearmAll(ctx: Context) {
        val now = System.currentTimeMillis()
        val arr = all(ctx)
        for (i in 0 until arr.length()) {
            val r = arr.optJSONObject(i) ?: continue
            var at = r.optLong("at")
            if (at < now) {
                if (r.optString("repeat", "none") == "none") continue  // missed while off: shown by the page, not rung late
                at = next(at, r.optString("repeat"), now)
                r.put("at", at)
            }
            arm(ctx, r.optString("id"), at)
        }
        save(ctx, arr)
    }

    /** The next time a repeating reminder is due after `after` (Egypt's weekend is Friday + Saturday). */
    fun next(from: Long, repeat: String, after: Long): Long {
        val c = java.util.Calendar.getInstance().apply { timeInMillis = from }
        var guard = 0
        while (c.timeInMillis <= after && guard++ < 1000) {
            when (repeat) {
                "daily" -> c.add(java.util.Calendar.DAY_OF_MONTH, 1)
                "weekly" -> c.add(java.util.Calendar.DAY_OF_MONTH, 7)
                "weekdays" -> do { c.add(java.util.Calendar.DAY_OF_MONTH, 1) } while (
                    c.get(java.util.Calendar.DAY_OF_WEEK) == java.util.Calendar.FRIDAY ||
                    c.get(java.util.Calendar.DAY_OF_WEEK) == java.util.Calendar.SATURDAY)
                else -> return from
            }
        }
        return c.timeInMillis
    }

    fun ensureChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(CHANNEL) != null) return
        val ch = NotificationChannel(CHANNEL, ctx.getString(R.string.channel_reminders), NotificationManager.IMPORTANCE_HIGH)
        ch.description = ctx.getString(R.string.channel_reminders_desc)
        ch.enableVibration(true)
        nm.createNotificationChannel(ch)
    }

    /** Show the notification for reminder `id`; reschedule it if it repeats. */
    fun fire(ctx: Context, id: String) {
        val arr = all(ctx)
        var r: JSONObject? = null
        for (i in 0 until arr.length()) arr.optJSONObject(i)?.let { if (it.optString("id") == id) r = it }
        val rem = r ?: return
        ensureChannel(ctx)
        val open = PendingIntent.getActivity(ctx, id.hashCode(),
            Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(EXTRA_ID, id),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val b = (if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(ctx, CHANNEL)
                 else @Suppress("DEPRECATION") android.app.Notification.Builder(ctx))
            .setSmallIcon(R.drawable.ic_stat_reminder)
            .setContentTitle(rem.optString("title").ifBlank { ctx.getString(R.string.app_name) })
            .setContentText(rem.optString("body"))
            .setStyle(android.app.Notification.BigTextStyle().bigText(rem.optString("body")))
            .setContentIntent(open)
            .setAutoCancel(true)
            .setCategory(android.app.Notification.CATEGORY_REMINDER)
        if (Build.VERSION.SDK_INT < 26) @Suppress("DEPRECATION") b.setPriority(android.app.Notification.PRIORITY_HIGH)
        try {
            ctx.getSystemService(NotificationManager::class.java)?.notify(id.hashCode(), b.build())
        } catch (e: SecurityException) { /* notifications not allowed: the page shows it as missed */ }

        val repeat = rem.optString("repeat", "none")
        if (repeat != "none") {
            val nextAt = next(rem.optLong("at"), repeat, System.currentTimeMillis())
            rem.put("at", nextAt); save(ctx, arr); arm(ctx, id, nextAt)
        } else {
            unschedule(ctx, id)
        }
    }
}

/** Woken by the system alarm at the reminder's time. */
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val id = intent.getStringExtra(Reminders.EXTRA_ID) ?: return
        Reminders.fire(ctx, id)
    }
}

/** Android forgets every alarm on restart and on app update; put ours back. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED,
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" -> Reminders.rearmAll(ctx)
        }
    }
}
