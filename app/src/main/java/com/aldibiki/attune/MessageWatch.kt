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
 * v6.40 — Message alerts: the rules the page saves ("tell me when Ahmed messages me", «لو جالي إيميل من البنك قولي»), checked
 * by PayListener against every new notification (Notification access, the same switch Money uses). A match posts Attune's own
 * alert on a loud channel — "Ahmed messaged you on WhatsApp" with the message — and a tap opens the message itself. All on
 * the phone: the rules, the check and the short log of hits stay in the app's private preferences. Matching: WatchMatch.kt.
 */
object MessageWatch {
    private const val PREFS = "attune.watch"
    const val CHANNEL = "watch"
    private val recent = HashMap<String, Long>()     // the same chat updating its notification: one alert per 2 minutes

    fun rules(ctx: Context): String = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("rules", "[]") ?: "[]"
    /** {rules:[{id, who:[], app, words:[], once, on, label}], lang} from the page. */
    fun save(ctx: Context, json: String) {
        val j = try { JSONObject(json) } catch (e: Exception) { return }
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("rules", (j.optJSONArray("rules") ?: JSONArray()).toString()).putString("lang", j.optString("lang", "en")).apply()
    }
    fun hits(ctx: Context): String = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("hits", "[]") ?: "[]"

    private fun list(a: JSONArray?): List<String> = if (a == null) emptyList() else (0 until a.length()).map { a.optString(it) }.filter { it.isNotBlank() }
    private fun parse(o: JSONObject) = WatchRule(o.optString("id"), list(o.optJSONArray("who")), o.optString("app", "any"), list(o.optJSONArray("words")), o.optBoolean("once"), o.optBoolean("on", true))

    fun check(ctx: Context, sbn: StatusBarNotification, title: String, text: String) {
        val n = sbn.notification ?: return
        if ((n.flags and android.app.Notification.FLAG_GROUP_SUMMARY) != 0) return   // "3 new messages" summaries: the message itself comes too
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = try { JSONArray(p.getString("rules", "[]")) } catch (e: Exception) { return }
        if (arr.length() == 0) return
        val sub = n.extras?.getCharSequence("android.subText")?.toString().orEmpty()
        var changed = false
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val r = parse(o)
            if (!WatchMatch.matches(r, sbn.packageName, title, text, sub)) continue
            val key = r.id + "|" + sbn.packageName + "|" + title
            val now = System.currentTimeMillis()
            if ((recent[key] ?: 0L) > now - 120_000) continue
            recent[key] = now
            alert(ctx, r, o.optString("label"), sbn, title, text, p.getString("lang", "en") == "ar")
            if (r.once) { o.put("on", false); changed = true }
        }
        if (changed) p.edit().putString("rules", arr.toString()).apply()
    }

    private fun alert(ctx: Context, r: WatchRule, label: String, sbn: StatusBarNotification, title: String, text: String, ar: Boolean) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            val ch = NotificationChannel(CHANNEL, if (ar) "رسائل طلبت تتنبه لها" else "Messages you asked about", NotificationManager.IMPORTANCE_HIGH)
            ch.enableVibration(true); nm.createNotificationChannel(ch)
        }
        val app = WatchMatch.appName(sbn.packageName).ifEmpty { try { ctx.packageManager.getApplicationLabel(ctx.packageManager.getApplicationInfo(sbn.packageName, 0)).toString() } catch (e: Exception) { sbn.packageName } }
        val who = title.substringBefore(" @ ").substringBefore(":").trim().ifEmpty { r.who.firstOrNull() ?: "" }
        // v8.0 Agents: a delivery agent's alert names the order ("📦 Amazon order — AirPods case"), not a sender
        val head = if (r.id.startsWith("agent-")) "📦 " + label.ifBlank { app } else if (ar) "📩 $who بعتلك على $app" else "📩 $who messaged you on $app"
        // the tap opens the message itself (the app's own intent), else that app
        val open: PendingIntent? = sbn.notification?.contentIntent ?: ctx.packageManager.getLaunchIntentForPackage(sbn.packageName)?.let {
            PendingIntent.getActivity(ctx, sbn.packageName.hashCode(), it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE) }
        val body = text.take(400) + if (label.isNotBlank() && !r.id.startsWith("agent-")) "\n— " + label else ""
        val b = (if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") android.app.Notification.Builder(ctx))
            .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(head).setContentText(text.take(120))
            .setStyle(android.app.Notification.BigTextStyle().bigText(body)).setAutoCancel(true)
            .setCategory(android.app.Notification.CATEGORY_MESSAGE)
        if (open != null) b.setContentIntent(open)
        if (Build.VERSION.SDK_INT < 26) @Suppress("DEPRECATION") b.setPriority(android.app.Notification.PRIORITY_HIGH)
        try { nm.notify(("watch" + r.id + title).hashCode(), b.build()) } catch (e: SecurityException) { }
        // the page's short log (the last 50)
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val hits = try { JSONArray(p.getString("hits", "[]")) } catch (e: Exception) { JSONArray() }
        val out = JSONArray(); val start = maxOf(0, hits.length() - 49); for (i in start until hits.length()) out.put(hits.get(i))
        out.put(JSONObject().put("rule", r.id).put("who", who).put("app", app).put("text", text.take(300)).put("ts", System.currentTimeMillis()))
        p.edit().putString("hits", out.toString()).apply()
    }
}
