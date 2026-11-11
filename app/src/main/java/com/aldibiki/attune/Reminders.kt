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

    /** {id, at (ms), title, body, repeat: none|daily|weekly|weekdays|monthly}. The same id replaces. */
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
            .put("repeat", r.optString("repeat", "none"))
            .put("until", r.optLong("until", 0L))
            .put("off", r.optJSONArray("off") ?: JSONArray().put(5).put(6))   // v9.9.18 the country's weekend for "weekdays"
            .apply {   // v9.9.18 B1: AU5 nag level + quiet hours, AU7 payment buttons, the button words (NagPay.kt)
                r.optString("nag").takeIf { it.isNotBlank() }?.let { put("nag", it.take(10)) }
                if (r.optBoolean("important")) put("important", true)
                r.optJSONObject("quiet")?.let { q -> put("quiet", JSONObject().put("from", q.optString("from").take(5)).put("to", q.optString("to").take(5))) }
                r.optJSONObject("pay")?.let { put("pay", it) }
                r.optJSONObject("labels")?.let { put("labels", it) }
            }   // v9.9.3 T1: a class reminder stops after the term's last day
            .apply {   // v9.4 G1 (Ali: "schedule a message — send this contact this message at 5 pm tomorrow, and it does that")
                r.optJSONObject("send")?.let { s0 -> put("send", JSONObject().put("key", s0.optString("key").take(200)).put("pkg", s0.optString("pkg").take(100))
                    .put("phone", s0.optString("phone").filter { it.isDigit() }.take(20)).put("text", s0.optString("text").take(2000)).put("who", s0.optString("who").take(80))
                    .put("sentTitle", s0.optString("sentTitle").take(120)).put("dueTitle", s0.optString("dueTitle").take(120))
                    // v9.7 Messages: which app, ask first, send by itself, email, the words on the ask notification
                    .put("app", s0.optString("app", "whatsapp").take(20)).put("ask", s0.optBoolean("ask")).put("auto", s0.optBoolean("auto"))
                    .put("email", s0.optString("email").take(200)).put("subject", s0.optString("subject").take(200))
                    .put("askTitle", s0.optString("askTitle").take(120)).put("sendLabel", s0.optString("sendLabel").take(30)).put("skipLabel", s0.optString("skipLabel").take(30))) }
            })
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
        purgeLegacy(ctx)
        val now = System.currentTimeMillis()
        val arr = all(ctx)
        for (i in 0 until arr.length()) {
            val r = arr.optJSONObject(i) ?: continue
            var at = r.optLong("at")
            if (at < now) {
                if (r.optString("repeat", "none") == "none") continue  // missed while off: shown by the page, not rung late
                at = next(at, r.optString("repeat"), now, offOf(r))
                r.put("at", at)
            }
            val until = r.optLong("until", 0L)
            if (until > 0L && at > until) continue   // the term is over: not armed again
            arm(ctx, r.optString("id"), at)
        }
        save(ctx, arr)
    }

    /** The next time a repeating reminder is due after `after` (Egypt's weekend is Friday + Saturday). */
    fun next(from: Long, repeat: String, after: Long, off: Set<Int> = setOf(5, 6)): Long {
        val c = java.util.Calendar.getInstance().apply { timeInMillis = from }
        var guard = 0
        while (c.timeInMillis <= after && guard++ < 1000) {
            when (repeat) {
                "daily" -> c.add(java.util.Calendar.DAY_OF_MONTH, 1)
                "weekly" -> c.add(java.util.Calendar.DAY_OF_MONTH, 7)
                // v9.9.18: the person's country's weekend (the page sends "off"; 0 = Sunday) — was Egypt's Fri + Sat everywhere
                "weekdays" -> do { c.add(java.util.Calendar.DAY_OF_MONTH, 1) } while ((c.get(java.util.Calendar.DAY_OF_WEEK) - 1) in off && off.size < 7)
                "monthly" -> c.add(java.util.Calendar.MONTH, 1)   // v6.32: the Overpaying check on the 1st
                "yearly" -> c.add(java.util.Calendar.YEAR, 1)     // v9.7 Messages: a birthday every year
                "lastday" -> {   // v9.0 "the last day of each month": next month's last day, same time of day
                    c.set(java.util.Calendar.DAY_OF_MONTH, 1); c.add(java.util.Calendar.MONTH, 1)
                    c.set(java.util.Calendar.DAY_OF_MONTH, c.getActualMaximum(java.util.Calendar.DAY_OF_MONTH))
                }
                else -> if (repeat.startsWith("last:")) {
                    // "every last Friday of the month" (0 = Sunday): next month's last such weekday, same time of day
                    val wd = repeat.removePrefix("last:").trim().toIntOrNull() ?: return from
                    c.set(java.util.Calendar.DAY_OF_MONTH, 1); c.add(java.util.Calendar.MONTH, 1)
                    c.set(java.util.Calendar.DAY_OF_MONTH, c.getActualMaximum(java.util.Calendar.DAY_OF_MONTH))
                    while (c.get(java.util.Calendar.DAY_OF_WEEK) - 1 != wd) c.add(java.util.Calendar.DAY_OF_MONTH, -1)
                } else {
                    // v8.4 "days:0,2,4" (0 = Sunday, as on the page): the next of those weekdays, same time of day
                    if (!repeat.startsWith("days:")) return from
                    val ds = repeat.removePrefix("days:").split(",").mapNotNull { it.trim().toIntOrNull() }.filter { it in 0..6 }.toSet()
                    if (ds.isEmpty()) return from
                    do { c.add(java.util.Calendar.DAY_OF_MONTH, 1) } while ((c.get(java.util.Calendar.DAY_OF_WEEK) - 1) !in ds)
                }
            }
        }
        return c.timeInMillis
    }

    fun offOf(r: JSONObject): Set<Int> { val a = r.optJSONArray("off") ?: return setOf(5, 6); val s = HashSet<Int>(); for (i in 0 until a.length()) a.optInt(i, -1).takeIf { it in 0..6 }?.let { s.add(it) }; return if (s.isEmpty()) setOf(5, 6) else s }

    fun ensureChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        if (nm.getNotificationChannel(CHANNEL) != null) return
        val ch = NotificationChannel(CHANNEL, ctx.getString(R.string.channel_reminders), NotificationManager.IMPORTANCE_HIGH)
        ch.description = ctx.getString(R.string.channel_reminders_desc)
        ch.enableVibration(true)
        nm.createNotificationChannel(ch)
    }

    /** v9.4 G1 → v9.7 Messages (Ali picked M3 + S1 + S2: "like the Auto Text app, with my interface"). A scheduled message at its time:
     *   ask = true → a notification "Send to X now?" with Send / Not now (nothing goes until the person says so);
     *   else deliver(): 1) through the chat's own Reply when Attune holds it (every build); 2) SMS sent by itself (the full build, with
     *   the person's OK for SMS); 3) WhatsApp sent by itself (the full build, Accessibility switched on, phone unlocked — AutoSend.kt);
     *   4) otherwise a notification: one tap opens the app at that person with the words written — the person presses Send.
     *   A repeating message (daily / weekly / monthly / yearly) is armed again for its next time. */
    private fun fireSend(ctx: Context, id: String, rem: JSONObject, snd: JSONObject, arr: JSONArray) {
        if (snd.optBoolean("ask")) askFirst(ctx, id, snd) else deliver(ctx, id, snd)
        val repeat = rem.optString("repeat", "none")
        if (repeat != "none") { val nextAt = next(rem.optLong("at"), repeat, System.currentTimeMillis(), offOf(rem)); rem.put("at", nextAt); save(ctx, arr); arm(ctx, id, nextAt) }
        else unschedule(ctx, id)
    }

    /** The link that opens the app at that person with the words written (the same as web-src/msgsched.js linkFor). */
    fun linkIntent(ctx: Context, snd: JSONObject): Intent? {
        val text = snd.optString("text"); val phone = snd.optString("phone").filter { it.isDigit() }; val app = snd.optString("app", "whatsapp")
        val pkg = snd.optString("pkg")
        val i = when (app) {
            "sms" -> if (phone.isNotEmpty()) Intent(Intent.ACTION_SENDTO, android.net.Uri.parse("smsto:$phone")).putExtra("sms_body", text) else null
            "email" -> snd.optString("email").takeIf { it.contains("@") }?.let { Intent(Intent.ACTION_SENDTO, android.net.Uri.parse("mailto:" + android.net.Uri.encode(it) + "?subject=" + android.net.Uri.encode(snd.optString("subject")) + "&body=" + android.net.Uri.encode(text))) }
            "telegram" -> Intent(Intent.ACTION_VIEW, android.net.Uri.parse(if (phone.isNotEmpty()) "tg://resolve?phone=$phone&text=" + android.net.Uri.encode(text) else "tg://msg?text=" + android.net.Uri.encode(text)))
            else -> if (phone.isNotEmpty()) Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://wa.me/$phone?text=" + android.net.Uri.encode(text))).apply { if (pkg.startsWith("com.whatsapp")) setPackage(pkg) }
                    else if (pkg.isNotBlank()) ctx.packageManager.getLaunchIntentForPackage(pkg) else null
        }
        return i?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    /** Sends it now, the best way this phone allows (see fireSend). → how: reply | sms | auto | opened | failed */
    fun deliver(ctx: Context, id: String, snd: JSONObject): String {
        val text = snd.optString("text"); val who = snd.optString("who"); val app = snd.optString("app", "whatsapp")
        val phone = snd.optString("phone").filter { it.isDigit() }
        var how = ""
        if (snd.optString("key").isNotBlank() && ChatInbox.reply(ctx, snd.optString("key"), text).optBoolean("ok")) how = "reply"
        if (how.isEmpty() && app == "sms" && phone.isNotEmpty() && SmsOut.allowed(ctx)) how = if (SmsOut.send(ctx, phone, text)) "sms" else ""
        if (how.isEmpty() && snd.optBoolean("auto") && (app == "whatsapp" || app == "wab") && phone.isNotEmpty() && AutoSend.ready(ctx)) {
            val go = linkIntent(ctx, snd)
            if (go != null) try { AutoSend.arm(ctx, id, snd); ctx.startActivity(go); how = "auto" } catch (e: Exception) { }
        }
        val sent = how == "reply" || how == "sms"
        if (how != "auto") {
            val go = linkIntent(ctx, snd) ?: Intent(ctx, MainActivity::class.java).putExtra(EXTRA_ID, id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (!sent) try { (ctx.getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager)?.setPrimaryClip(android.content.ClipData.newPlainText("Attune", text)) } catch (e: Exception) { }
            val tap = PendingIntent.getActivity(ctx, ("send-" + id).hashCode(), if (sent) Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) else go,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val title = if (sent) snd.optString("sentTitle").ifBlank { "Sent to $who" } else snd.optString("dueTitle").ifBlank { "Time to send to $who" }
            notifySimple(ctx, id.hashCode(), title, text, tap)
            if (!sent) how = "opened"
            log(ctx, JSONObject().put("id", id).put("how", how).put("ok", sent).put("who", who).put("app", app).put("text", text))
        }
        return how
    }

    private fun notifySimple(ctx: Context, nid: Int, title: String, text: String, tap: PendingIntent, vararg actions: android.app.Notification.Action) {
        ensureChannel(ctx)
        val b = (if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") android.app.Notification.Builder(ctx))
            .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(title).setContentText(text)
            .setStyle(android.app.Notification.BigTextStyle().bigText(text)).setContentIntent(tap).setAutoCancel(true)
            .setCategory(android.app.Notification.CATEGORY_REMINDER)
        for (a in actions) b.addAction(a)
        try { ctx.getSystemService(NotificationManager::class.java)?.notify(nid, b.build()) } catch (e: SecurityException) { }
    }

    /** "Ask me before sending": the message waits for the person's Send (MsgActionReceiver). */
    private fun askFirst(ctx: Context, id: String, snd: JSONObject) {
        val p = prefs(ctx); val asks = try { JSONObject(p.getString("asks", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
        asks.put(id, snd); p.edit().putString("asks", asks.toString()).apply()
        fun act(action: String, label: String) = android.app.Notification.Action.Builder(null, label,
            PendingIntent.getBroadcast(ctx, (action + id).hashCode(), Intent(ctx, MsgActionReceiver::class.java).setAction(action).putExtra(EXTRA_ID, id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)).build()
        val open = PendingIntent.getActivity(ctx, ("ask-" + id).hashCode(), Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        notifySimple(ctx, id.hashCode(), snd.optString("askTitle").ifBlank { "Send to " + snd.optString("who") + " now?" }, snd.optString("text"), open,
            act(MsgActionReceiver.SEND, snd.optString("sendLabel").ifBlank { "Send" }), act(MsgActionReceiver.SKIP, snd.optString("skipLabel").ifBlank { "Not now" }))
        log(ctx, JSONObject().put("id", id).put("how", "asked").put("ok", false).put("who", snd.optString("who")).put("app", snd.optString("app", "whatsapp")).put("text", snd.optString("text")))
    }
    fun answerAsk(ctx: Context, id: String, send: Boolean) {
        val p = prefs(ctx); val asks = try { JSONObject(p.getString("asks", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
        val snd = asks.optJSONObject(id); asks.remove(id); p.edit().putString("asks", asks.toString()).apply()
        try { ctx.getSystemService(NotificationManager::class.java)?.cancel(id.hashCode()) } catch (e: Exception) { }
        if (snd != null && send) deliver(ctx, id, snd)
    }

    /** v9.7 the Sent tab: every scheduled send and auto-reply (newest last, 300 kept), and the page's "what happened" list. */
    fun log(ctx: Context, o: JSONObject) {
        try {
            o.put("at", System.currentTimeMillis())
            val p = prefs(ctx)
            val all = try { JSONArray(p.getString("sent", "[]")) } catch (e: Exception) { JSONArray() }
            all.put(o); val keep = JSONArray(); for (k in maxOf(0, all.length() - 300) until all.length()) keep.put(all.get(k))
            val log = try { JSONArray(p.getString("sendlog", "[]")) } catch (e: Exception) { JSONArray() }
            if (o.optString("id").isNotBlank()) log.put(JSONObject().put("id", o.optString("id")).put("ok", o.optBoolean("ok")).put("how", o.optString("how")).put("at", o.optLong("at")))
            p.edit().putString("sent", keep.toString()).putString("sendlog", log.toString()).apply()
        } catch (e: Exception) { }
    }
    fun sentLog(ctx: Context): String = prefs(ctx).getString("sent", "[]") ?: "[]"

    /** v9.4 G1: what the scheduled messages did since the page last asked (then forgotten). */
    fun takeSendLog(ctx: Context): String { val p = prefs(ctx); val s = p.getString("sendlog", "[]") ?: "[]"; p.edit().putString("sendlog", "[]").apply(); return s }

    /** v9.5 (Ali, 5 Nov: "I still get the notification from Fit & Food to log my dinner"): the old Fit meal / water reminders an
     *  earlier version saved repeat for ever — Attune no longer makes them, so they are never rung and are taken out. */
    private val LEGACY_TITLES = Regex("^(log your (breakfast|lunch|dinner)|drink a glass of water|سجّ?ل (فطارك|غداك|عشاك)|اشرب كوب ماء)$", RegexOption.IGNORE_CASE)
    fun isLegacy(r: JSONObject): Boolean = r.optString("id").let { it == "fit-breakfast" || it == "fit-lunch" || it == "fit-dinner" || it == "fit-water" || it.startsWith("fit-meal") } ||
        LEGACY_TITLES.matches(r.optString("title").trim())
    fun purgeLegacy(ctx: Context): Int {
        val arr = all(ctx); val out = JSONArray(); var n = 0
        for (i in 0 until arr.length()) arr.optJSONObject(i)?.let { if (isLegacy(it)) { n++; ctx.getSystemService(AlarmManager::class.java)?.cancel(pending(ctx, it.optString("id"))) } else out.put(it) }
        if (n > 0) save(ctx, out)
        return n
    }

    fun fire(ctx: Context, id: String) {
        val arr = all(ctx)
        var r: JSONObject? = null
        for (i in 0 until arr.length()) arr.optJSONObject(i)?.let { if (it.optString("id") == id) r = it }
        val rem = r ?: return
        if (isLegacy(rem)) { purgeLegacy(ctx); return }
        ensureChannel(ctx)
        // v9.4 G1: a scheduled message. Sent by itself through that chat's own Reply when Attune still holds it (the person wrote
        // recently); otherwise the notification opens the chat with the message written — one tap on Send. Never through
        // Accessibility (Google Play forbids it for this), never SMS sending (only the default SMS app may).
        rem.optJSONObject("send")?.let { snd -> fireSend(ctx, id, rem, snd, arr); return }
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
        // v9.9.18 B1: Done / Paid / Tomorrow / In 1 hour buttons, and the next nag ring (NagPay.kt)
        if (rem.has("nag") || rem.optBoolean("important") || rem.has("pay")) try { NagPay.onFire(ctx, id, rem, b) } catch (e: Exception) { }
        try {
            ctx.getSystemService(NotificationManager::class.java)?.notify(id.hashCode(), b.build())
        } catch (e: SecurityException) { /* notifications not allowed: the page shows it as missed */ }

        val repeat = rem.optString("repeat", "none")
        val until = rem.optLong("until", 0L)
        val nextAt0 = if (repeat != "none") next(rem.optLong("at"), repeat, System.currentTimeMillis(), offOf(rem)) else 0L
        if (repeat != "none" && (until <= 0L || nextAt0 <= until)) {
            val nextAt = nextAt0
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
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED" -> { Reminders.rearmAll(ctx); ScoutNight.arm(ctx); AgentWatch.arm(ctx); NagPay.rearm(ctx) }
        }
    }
}

/** v9.7 "Send to X now?" → Send / Not now. */
class MsgActionReceiver : BroadcastReceiver() {
    companion object { const val SEND = "com.aldibiki.attune.MSG_SEND"; const val SKIP = "com.aldibiki.attune.MSG_SKIP" }
    override fun onReceive(ctx: Context, intent: Intent) {
        val id = intent.getStringExtra(Reminders.EXTRA_ID) ?: return
        Reminders.answerAsk(ctx, id, intent.action == SEND)
    }
}
