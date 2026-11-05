package com.aldibiki.attune

import android.app.NotificationManager
import android.content.Context
import android.media.AudioManager
import org.json.JSONArray
import org.json.JSONObject

/**
 * v9.7 Messages (Ali picked M3 + S3, 6 Nov 2026: "like the Auto Text app, with my interface"): auto-reply rules, answered on the phone
 * by itself through the chat notification's own Reply (the same way ChatInbox.reply sends) — no Accessibility, so it works in every
 * build, the Play one too. The idea of answering through the notification is the one Watomatic (GPL-3.0) uses; no code is copied.
 * A rule: {id, name, text, on, mode: now | silent | hours, from, to, apps, who: all | only | except, list, groups, once}
 * (the same fields and checks as web-src/msgsched.js ruleFits — tests/unit/v970messages.test.mjs).
 * Safety: never to a group unless the rule allows it, once per person per rule per day (the default), never to one-time codes
 * (ChatInbox drops them), and every reply is in the Sent log (Reminders.log).
 */
object AutoReply {
    private const val PREFS = "attune.autoreply"
    private fun p(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun rules(ctx: Context): String = p(ctx).getString("rules", "[]") ?: "[]"
    fun setRules(ctx: Context, json: String) { try { JSONArray(json); p(ctx).edit().putString("rules", json).apply() } catch (e: Exception) { } }

    private fun mins(s: String): Int? = Regex("^(\\d{1,2}):(\\d{2})$").find(s.trim())?.let { it.groupValues[1].toInt() * 60 + it.groupValues[2].toInt() }
    private fun inHours(from: String, to: String): Boolean {
        val a = mins(from) ?: return false; val b = mins(to) ?: return false
        val c = java.util.Calendar.getInstance(); val x = c.get(java.util.Calendar.HOUR_OF_DAY) * 60 + c.get(java.util.Calendar.MINUTE)
        return if (a <= b) x in a until b else x >= a || x < b
    }
    private fun silent(ctx: Context): Boolean {
        val am = ctx.getSystemService(AudioManager::class.java)
        val nm = ctx.getSystemService(NotificationManager::class.java)
        return (am != null && am.ringerMode != AudioManager.RINGER_MODE_NORMAL) ||
            (nm != null && nm.currentInterruptionFilter > NotificationManager.INTERRUPTION_FILTER_ALL)
    }
    private fun norm(s: String) = s.lowercase().replace(Regex("[أإآ]"), "ا").replace("ة", "ه").replace(Regex("\\s+"), " ").trim()

    /** A new chat message ({key, app, pkg, who, group, text}): the first rule that fits answers it. */
    @Synchronized
    fun check(ctx: Context, m: JSONObject) {
        val arr = try { JSONArray(rules(ctx)) } catch (e: Exception) { return }
        if (arr.length() == 0) return
        val key = m.optString("key"); val who = m.optString("who"); val app = m.optString("app"); val pkg = m.optString("pkg")
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
        val replied = try { JSONObject(p(ctx).getString("replied", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
        for (i in 0 until arr.length()) {
            val r = arr.optJSONObject(i) ?: continue
            if (!r.optBoolean("on", true)) continue
            val text = r.optString("text").trim(); if (text.isEmpty()) continue
            if (m.optBoolean("group") && !r.optBoolean("groups", false)) continue
            val apps = r.optJSONArray("apps")
            if (apps != null && apps.length() > 0) {
                val list = (0 until apps.length()).map { apps.optString(it) }
                val ok = app in list || (pkg == "com.whatsapp.w4b" && "wab" in list)
                if (!ok) continue
            }
            val names = r.optJSONArray("list")?.let { l -> (0 until l.length()).map { norm(l.optString(it)) }.filter { it.isNotEmpty() } } ?: emptyList()
            val w = norm(who); val inList = names.any { w == it || w.contains(it) }
            when (r.optString("who", "all")) { "only" -> if (!inList) continue; "except" -> if (inList) continue }
            when (r.optString("mode", "now")) { "silent" -> if (!silent(ctx)) continue; "hours" -> if (!inHours(r.optString("from"), r.optString("to"))) continue }
            val once = r.optString("id") + "|" + key
            if (r.optBoolean("once", true) && replied.optString(once) == today) continue
            val res = ChatInbox.reply(ctx, key, text)
            if (res.optBoolean("ok")) {
                replied.put(once, today)
                // keep the "already answered today" list small: only today's entries
                val keep = JSONObject(); for (k in replied.keys()) if (replied.optString(k) == today) keep.put(k, today)
                p(ctx).edit().putString("replied", keep.toString()).apply()
            }
            Reminders.log(ctx, JSONObject().put("id", "ar-" + r.optString("id")).put("how", if (res.optBoolean("ok")) "autoreply" else "failed")
                .put("ok", res.optBoolean("ok")).put("who", who).put("app", app).put("text", text).put("rule", r.optString("name")).put("to", m.optString("text").take(120)))
            return
        }
    }
}
