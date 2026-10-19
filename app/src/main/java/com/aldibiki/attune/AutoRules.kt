package com.aldibiki.attune

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * v6.41 (upgrade C3) — the person's automations, on the phone. The page writes each one once as a rule
 * ({id, words, pct, fixed, pot, on, dir, lang}); PayListener calls check() on every money notification (never SMS — the same
 * Notification access as Money). A rule that fires: Attune's own alert at once ("Salary 18,000 came — 3,600 for Car fund")
 * and an event in the queue; the page puts the money in the pot the next time it opens (and dedupes by id). No AI runs here.
 */
object AutoRules {
    private const val PREFS = "attune.auto"
    private const val CHANNEL = "auto"

    fun rules(ctx: Context): String = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("rules", "[]") ?: "[]"
    fun save(ctx: Context, json: String) {
        val j = try { JSONObject(json) } catch (e: Exception) { return }
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("rules", (j.optJSONArray("rules") ?: JSONArray()).toString())
            .putString("lang", j.optString("lang", "en")).apply()
    }
    /** The events not handed to the page yet; take() empties the queue. */
    @Synchronized fun take(ctx: Context): String {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE); val q = p.getString("queue", "[]") ?: "[]"
        p.edit().putString("queue", "[]").apply(); return q
    }

    private fun list(a: JSONArray?): List<String> = if (a == null) emptyList() else (0 until a.length()).map { a.optString(it) }.filter { it.isNotBlank() }

    @Synchronized
    fun check(ctx: Context, sbn: StatusBarNotification, app: String, title: String, text: String) {
        if (WatchMatch.isSms(sbn.packageName)) return
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = try { JSONArray(p.getString("rules", "[]")) } catch (e: Exception) { return }
        if (arr.length() == 0) return
        val ar = p.getString("lang", "en") == "ar"
        val q = try { JSONArray(p.getString("queue", "[]")) } catch (e: Exception) { JSONArray() }
        val evId = sbn.packageName + ":" + sbn.postTime + ":" + (title + text).hashCode()
        for (i in 0 until q.length()) if (q.optJSONObject(i)?.optString("id")?.startsWith(evId) == true) return   // the same notification updated
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val r = AutoRule(o.optString("id"), list(o.optJSONArray("words")), o.optDouble("pct", 0.0), o.optDouble("fixed", 0.0), o.optString("pot"), o.optBoolean("on", true), o.optString("dir", "in"))
            if (!AutoMatch.matches(r, title, text)) continue
            val amount = AutoMatch.amountIn("$title $text")
            val share = AutoMatch.share(r, amount)
            q.put(JSONObject().put("id", evId + ":" + r.id).put("rule", r.id).put("pkg", sbn.packageName).put("app", app).put("title", title.take(200)).put("text", text.take(1000)).put("ts", sbn.postTime))
            if (o.optBoolean("tell", true)) alert(ctx, r, amount, share, ar)
        }
        val out = if (q.length() > 100) JSONArray().also { a -> for (k in q.length() - 100 until q.length()) a.put(q.get(k)) } else q
        p.edit().putString("queue", out.toString()).apply()
    }

    private fun fmt(v: Double) = String.format(java.util.Locale.US, "%,.0f", v)

    private fun alert(ctx: Context, r: AutoRule, amount: Double?, share: Double?, ar: Boolean) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null)
            nm.createNotificationChannel(NotificationChannel(CHANNEL, if (ar) "الأوامر التلقائية" else "Your automations", NotificationManager.IMPORTANCE_DEFAULT))
        val head = if (share != null) (if (ar) "💰 اتحط ${fmt(share)} في «${r.pot}»" else "💰 ${fmt(share)} set aside for ${r.pot}")
                   else (if (ar) "💰 الأمر التلقائي اشتغل: «${r.pot}»" else "💰 Your automation ran: ${r.pot}")
        val body = when {
            amount != null && share != null -> if (ar) "وصل ${fmt(amount)} — ${if (r.fixed > 0) "المبلغ الثابت" else "${r.pct.toInt()}%"} = ${fmt(share)}. افتح Attune يتسجل." else "${fmt(amount)} came in — ${if (r.fixed > 0) "the fixed sum" else "${r.pct.toInt()}%"} = ${fmt(share)}. Open Attune and it's recorded."
            else -> if (ar) "مقدرتش أقرا المبلغ — افتح Attune وأكّده." else "Couldn't read the amount — open Attune to confirm it."
        }
        val i = Intent(ctx, MainActivity::class.java).putExtra(EXTRA_OPEN_PAGE, "automations").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(ctx, ("auto" + r.id).hashCode(), i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val b = (if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") android.app.Notification.Builder(ctx))
            .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(head).setContentText(body)
            .setStyle(android.app.Notification.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(pi)
        try { nm.notify(("auto" + r.id + System.currentTimeMillis() / 60000).hashCode(), b.build()) } catch (e: SecurityException) { }
    }
}
