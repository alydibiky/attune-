package com.aldibiki.attune

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * v9.9.18 batch B1 (AUTOMATION_PLAN.md — Ali picked AU5 A+B and AU7 A+B, 11 Nov 2026).
 *
 * AU5 "Nag until done": a reminder with a level (`nag`: once | m10 | m15 | h1 | until, or `important` = m15) rings again on that
 * rhythm until Done is tapped, never inside the quiet hours (`quiet`: {from, to} "HH:mm"). The rules are web-src/nag.js — keep the two
 * equal (tests/nag runs 10,000 timelines on the page's copy).
 *
 * AU7 Buttons: a payment reminder (`pay` = web-src/notifpay.js payButtons) shows Paid · Tomorrow · In 1 hour. After Paid the SAME
 * notification asks from which balance (one balance → skipped); then "✓ 320 from Cash" with Undo. Nothing is written to Money here:
 * every tap is kept with its own id (`taps`) and the page turns them into Money exactly once (notifpay.js applyTaps).
 */
object NagPay {
    private const val PREFS = "attune.nagpay"
    const val ACT = "com.aldibiki.attune.NAGPAY"
    const val EXTRA_ID = "attune.np.id"; const val EXTRA_ACT = "attune.np.act"; const val EXTRA_ACCT = "attune.np.acct"

    /** minutes between rings and the most repeats (0 = no cap) — the same table as web-src/nag.js LEVELS */
    private fun level(r: JSONObject): Pair<Int, Int> = when (r.optString("nag").ifBlank { if (r.optBoolean("important")) "m15" else "once" }) {
        "m10" -> 10 to 12; "m15" -> 15 to 16; "h1" -> 60 to 12; "until" -> 30 to 0; else -> 0 to 0
    }
    private fun hm(s: String): Int? { val m = Regex("^(\\d{1,2}):(\\d{2})$").find(s.trim()) ?: return null; return m.groupValues[1].toInt() * 60 + m.groupValues[2].toInt() }
    fun inQuiet(t: Long, q: JSONObject?): Boolean {
        val f = hm(q?.optString("from") ?: "") ?: return false; val to = hm(q?.optString("to") ?: "") ?: return false; if (f == to) return false
        val c = java.util.Calendar.getInstance().apply { timeInMillis = t }; val m = c.get(java.util.Calendar.HOUR_OF_DAY) * 60 + c.get(java.util.Calendar.MINUTE)
        return if (f < to) m in f until to else m >= f || m < to
    }
    fun quietEnd(t: Long, q: JSONObject): Long {
        val to = hm(q.optString("to")) ?: return t
        val c = java.util.Calendar.getInstance().apply { timeInMillis = t; set(java.util.Calendar.HOUR_OF_DAY, to / 60); set(java.util.Calendar.MINUTE, to % 60); set(java.util.Calendar.SECOND, 0); set(java.util.Calendar.MILLISECOND, 0) }
        if (c.timeInMillis <= t) c.add(java.util.Calendar.DAY_OF_MONTH, 1)
        return c.timeInMillis
    }
    /** After the n-th repeat rang at `last`: the next ring, or 0 to stop (web-src/nag.js nextNag). */
    fun nextNag(r: JSONObject, last: Long, n: Int): Long {
        val (every, cap) = level(r); if (every <= 0) return 0L
        if (cap > 0 && n >= cap) return 0L
        var t = last + every * 60_000L
        val q = r.optJSONObject("quiet"); if (q != null && inQuiet(t, q)) t = quietEnd(t, q)
        return t
    }

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun obj(ctx: Context, k: String): JSONObject = try { JSONObject(prefs(ctx).getString(k, "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
    private fun put(ctx: Context, k: String, o: Any) { prefs(ctx).edit().putString(k, o.toString()).apply() }

    /** Called by Reminders.fire for a reminder with `nag` / `important` / `pay`: the buttons, and the next ring armed. */
    fun onFire(ctx: Context, id: String, r: JSONObject, b: Notification.Builder) {
        val pay = r.optJSONObject("pay"); val L = r.optJSONObject("labels") ?: JSONObject()
        if (pay != null) {
            val pl = pay.optJSONObject("labels") ?: JSONObject()
            b.addAction(action(ctx, id, "paid", null, pl.optString("paid", "Paid")))
            b.addAction(action(ctx, id, "tomorrow", null, pl.optString("tomorrow", "Tomorrow")))
            b.addAction(action(ctx, id, "hour", null, pl.optString("hour", "In 1 hour")))
        } else if (level(r).first > 0) {
            b.addAction(action(ctx, id, "done", null, L.optString("done", "Done")))
            b.addAction(action(ctx, id, "hour", null, L.optString("hour", "In 1 hour")))
            b.addAction(action(ctx, id, "tomorrow", null, L.optString("tomorrow", "Tomorrow")))
        }
        // the next ring (the first ring is this one: n = 0)
        if (level(r).first > 0) { val st = obj(ctx, "nag"); st.put(id, JSONObject().put("n", 0).put("last", System.currentTimeMillis()).put("r", r)); put(ctx, "nag", st); armNag(ctx, id, nextNag(r, System.currentTimeMillis(), 0)) }
    }

    private fun action(ctx: Context, id: String, act: String, acct: String?, label: String): Notification.Action =
        Notification.Action.Builder(null, label, PendingIntent.getBroadcast(ctx, ("np-$act-$id-${acct ?: ""}").hashCode(),
            Intent(ctx, NagPayReceiver::class.java).setAction(ACT).putExtra(EXTRA_ID, id).putExtra(EXTRA_ACT, act).apply { if (acct != null) putExtra(EXTRA_ACCT, acct) },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)).build()

    private fun nagPending(ctx: Context, id: String) = PendingIntent.getBroadcast(ctx, ("nag-$id").hashCode(),
        Intent(ctx, NagPayReceiver::class.java).setAction(ACT).putExtra(EXTRA_ID, id).putExtra(EXTRA_ACT, "ring"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    private fun armNag(ctx: Context, id: String, at: Long) {
        if (at <= 0L) return
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        try { if (Reminders.canExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, nagPending(ctx, id)) else am.setWindow(AlarmManager.RTC_WAKEUP, at, 5 * 60_000L, nagPending(ctx, id)) }
        catch (e: SecurityException) { am.setWindow(AlarmManager.RTC_WAKEUP, at, 5 * 60_000L, nagPending(ctx, id)) }
    }
    private fun stopNag(ctx: Context, id: String) {
        ctx.getSystemService(AlarmManager::class.java)?.cancel(nagPending(ctx, id))
        val st = obj(ctx, "nag"); st.remove(id); put(ctx, "nag", st)
    }

    /** A tap (or a nag ring). Every tap is kept for the page with its own id. */
    fun onAction(ctx: Context, id: String, act: String, acct: String?) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (act == "ring") { ring(ctx, id); return }
        val taps = try { JSONArray(prefs(ctx).getString("taps", "[]")) } catch (e: Exception) { JSONArray() }
        taps.put(JSONObject().put("id", java.util.UUID.randomUUID().toString()).put("rid", id).put("act", if (act == "done") "done" else act).put("acct", acct ?: JSONObject.NULL).put("at", System.currentTimeMillis()))
        put(ctx, "taps", taps)
        val r = Reminders.all(ctx).let { a -> (0 until a.length()).mapNotNull { a.optJSONObject(it) }.firstOrNull { it.optString("id") == id } } ?: obj(ctx, "nag").optJSONObject(id)?.optJSONObject("r")
        val pay = r?.optJSONObject("pay")
        when (act) {
            "paid" -> {
                stopNag(ctx, id)
                val accs = pay?.optJSONArray("accounts") ?: JSONArray()
                if (pay != null && accs.length() > 1) {   // AU7 step 2: the same notification stays and asks which balance
                    val pl = pay.optJSONObject("labels") ?: JSONObject()
                    val b = builder(ctx, id, pl.optString("which", "Paid {a} — from which balance?").replace("{a}", money(pay)), "")
                    for (i in 0 until minOf(3, accs.length())) accs.optJSONObject(i)?.let { b.addAction(action(ctx, id, "acct", it.optString("id"), it.optString("name"))) }
                    notify(nm, id, b)
                } else done(ctx, nm, id, pay, accs.optJSONObject(0)?.optString("name") ?: "")
            }
            "acct" -> {
                val accs = pay?.optJSONArray("accounts") ?: JSONArray(); var name = ""
                for (i in 0 until accs.length()) accs.optJSONObject(i)?.let { if (it.optString("id") == acct) name = it.optString("name") }
                done(ctx, nm, id, pay, name)
            }
            "undo" -> try { nm?.cancel(id.hashCode()) } catch (e: Exception) { }
            "done" -> { stopNag(ctx, id); try { nm?.cancel(id.hashCode()) } catch (e: Exception) { } }
            "hour", "tomorrow" -> {
                stopNag(ctx, id); try { nm?.cancel(id.hashCode()) } catch (e: Exception) { }
                if (r != null) { val at = System.currentTimeMillis() + if (act == "hour") 3_600_000L else 86_400_000L
                    Reminders.schedule(ctx, JSONObject(r.toString()).put("id", ("snz-" + id).take(64)).put("at", at).put("repeat", "none")) }
            }
        }
    }
    private fun money(pay: JSONObject): String { val a = pay.optDouble("amount", 0.0); val s = if (a % 1.0 == 0.0) String.format("%,.0f", a) else String.format("%,.2f", a); return (s + " " + pay.optString("currency")).trim() }
    private fun done(ctx: Context, nm: NotificationManager?, id: String, pay: JSONObject?, acctName: String) {
        if (pay == null) { try { nm?.cancel(id.hashCode()) } catch (e: Exception) { }; return }
        val pl = pay.optJSONObject("labels") ?: JSONObject()
        val b = builder(ctx, id, pl.optString("done", "✓ {a} from {b}").replace("{a}", money(pay)).replace("{b}", acctName), pay.optString("note"))
        b.addAction(action(ctx, id, "undo", null, pl.optString("undo", "Undo")))
        b.setTimeoutAfter(10 * 60_000L)
        notify(nm, id, b)
    }
    /** A nag ring: the same reminder again, with "(3)" so the person sees it came before. */
    private fun ring(ctx: Context, id: String) {
        val st = obj(ctx, "nag"); val e = st.optJSONObject(id) ?: return; val r = e.optJSONObject("r") ?: return
        val n = e.optInt("n") + 1
        Reminders.ensureChannel(ctx)
        val b = builder(ctx, id, r.optString("title") + "  (" + (n + 1) + ")", r.optString("body"))
        onFireButtonsOnly(ctx, id, r, b)
        notify(ctx.getSystemService(NotificationManager::class.java), id, b)
        e.put("n", n).put("last", System.currentTimeMillis()); st.put(id, e); put(ctx, "nag", st)
        armNag(ctx, id, nextNag(r, System.currentTimeMillis(), n))
    }
    private fun onFireButtonsOnly(ctx: Context, id: String, r: JSONObject, b: Notification.Builder) {
        val pay = r.optJSONObject("pay"); val L = r.optJSONObject("labels") ?: JSONObject()
        if (pay != null) { val pl = pay.optJSONObject("labels") ?: JSONObject(); b.addAction(action(ctx, id, "paid", null, pl.optString("paid", "Paid"))); b.addAction(action(ctx, id, "tomorrow", null, pl.optString("tomorrow", "Tomorrow"))); b.addAction(action(ctx, id, "hour", null, pl.optString("hour", "In 1 hour"))) }
        else { b.addAction(action(ctx, id, "done", null, L.optString("done", "Done"))); b.addAction(action(ctx, id, "hour", null, L.optString("hour", "In 1 hour"))); b.addAction(action(ctx, id, "tomorrow", null, L.optString("tomorrow", "Tomorrow"))) }
    }
    private fun builder(ctx: Context, id: String, title: String, text: String): Notification.Builder {
        Reminders.ensureChannel(ctx)
        val open = PendingIntent.getActivity(ctx, id.hashCode(), Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra(Reminders.EXTRA_ID, id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return (if (Build.VERSION.SDK_INT >= 26) Notification.Builder(ctx, Reminders.CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(ctx))
            .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(title).setContentText(text).setStyle(Notification.BigTextStyle().bigText(text))
            .setContentIntent(open).setAutoCancel(true).setOnlyAlertOnce(false).setCategory(Notification.CATEGORY_REMINDER)
    }
    private fun notify(nm: NotificationManager?, id: String, b: Notification.Builder) { try { nm?.notify(id.hashCode(), b.build()) } catch (e: SecurityException) { } }

    /** The taps since the page last asked (then forgotten) — the page applies them once (notifpay.js applyTaps). */
    fun takeTaps(ctx: Context): String { val s = prefs(ctx).getString("taps", "[]") ?: "[]"; put(ctx, "taps", JSONArray()); return s }
    /** After a restart: arm the nags still running. */
    fun rearm(ctx: Context) { val st = obj(ctx, "nag"); for (k in st.keys()) { val e = st.optJSONObject(k) ?: continue; val r = e.optJSONObject("r") ?: continue
        val t = nextNag(r, e.optLong("last"), e.optInt("n")); if (t > 0L) armNag(ctx, k, maxOf(t, System.currentTimeMillis() + 60_000L)) } }
}

/** The buttons and the nag rings. */
class NagPayReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != NagPay.ACT) return
        val id = intent.getStringExtra(NagPay.EXTRA_ID) ?: return
        NagPay.onAction(ctx, id, intent.getStringExtra(NagPay.EXTRA_ACT) ?: return, intent.getStringExtra(NagPay.EXTRA_ACCT))
    }
}
