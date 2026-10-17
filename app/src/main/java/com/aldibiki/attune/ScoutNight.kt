package com.aldibiki.attune

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Calendar

/**
 * v6.32 Scout at night: the page hands over each goal's searches (and the ads it has already seen). Once a night, around
 * 3:00, Android wakes this receiver — even with Attune closed — which runs those searches with the app's own free web
 * search and keeps the NEW results in a file. If there are any, one notification says so. When Attune opens, the page
 * reads the file and checks every ad against the goal by code, as it always does (web-src/scout.js). Nothing runs when
 * the Offline lock is on, and nothing but the searches leaves the phone.
 */
object ScoutNight {
    private const val PREFS = "attune.scoutnight"
    private const val FILE = "scout-night.json"
    private const val REQ = 0x5c0a7

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** plan = [{id, title, queries: [..], seen: [urls]}]; an empty plan turns the night run off. */
    fun setPlan(ctx: Context, plan: String) {
        val arr = try { JSONArray(plan) } catch (e: Exception) { JSONArray() }
        prefs(ctx).edit().putString("plan", arr.toString()).apply()
        if (arr.length() > 0) arm(ctx) else cancel(ctx)
    }

    private fun pending(ctx: Context) = PendingIntent.getBroadcast(ctx, REQ, Intent(ctx, ScoutNightReceiver::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    /** The next 3:00 (+ up to 40 minutes, so not every phone searches at the same minute). Inexact: no special permission. */
    fun arm(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val c = Calendar.getInstance()
        c.set(Calendar.HOUR_OF_DAY, 3); c.set(Calendar.MINUTE, (Math.random() * 40).toInt()); c.set(Calendar.SECOND, 0)
        if (c.timeInMillis <= System.currentTimeMillis() + 60_000) c.add(Calendar.DAY_OF_YEAR, 1)
        try { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, c.timeInMillis, pending(ctx)) } catch (e: Exception) {}
    }

    private fun cancel(ctx: Context) { try { ctx.getSystemService(AlarmManager::class.java)?.cancel(pending(ctx)) } catch (e: Exception) {} }

    /** The night's run. Called on a background thread. */
    fun run(ctx: Context) {
        val plan = try { JSONArray(prefs(ctx).getString("plan", "[]")) } catch (e: Exception) { JSONArray() }
        if (plan.length() == 0) return
        arm(ctx)                                     // tomorrow night again, whatever happens tonight
        if (Prefs.airGap(ctx)) return
        val out = readFound(ctx)
        var fresh = 0
        val names = ArrayList<String>()
        for (i in 0 until minOf(plan.length(), 5)) {
            val g = plan.optJSONObject(i) ?: continue
            val seen = HashSet<String>()
            g.optJSONArray("seen")?.let { s -> for (k in 0 until s.length()) seen.add(s.optString(k)) }
            val prev = out.optJSONArray(g.optString("id")) ?: JSONArray()
            for (k in 0 until prev.length()) prev.optJSONObject(k)?.optString("url")?.let { seen.add(it) }
            var n = 0
            val qs = g.optJSONArray("queries") ?: JSONArray()
            for (q in 0 until minOf(qs.length(), 6)) {
                try {
                    val hits = WebTools.search("duckduckgo", qs.optString(q), "", 6).optJSONArray("hits") ?: continue
                    for (h in 0 until hits.length()) {
                        val hit = hits.optJSONObject(h) ?: continue
                        val url = hit.optString("url"); if (url.isEmpty() || !seen.add(url)) continue
                        if (hit.has("text")) hit.put("text", hit.optString("text").take(6000))
                        prev.put(hit); n++
                    }
                } catch (e: Exception) { /* one search failing never stops the night */ }
            }
            if (n > 0) { out.put(g.optString("id"), prev); fresh += n; names.add(g.optString("title")) }
        }
        try { File(ctx.filesDir, FILE).writeText(out.toString()) } catch (e: Exception) {}
        if (fresh > 0) Reminders.schedule(ctx, JSONObject().put("id", "scout-night").put("at", System.currentTimeMillis() + 2000)
            .put("title", "Scout · " + names.take(2).joinToString(" · "))
            .put("body", "$fresh new ads tonight — open Attune to see which ones really match."))
    }

    private fun readFound(ctx: Context): JSONObject = try { JSONObject(File(ctx.filesDir, FILE).readText()) } catch (e: Exception) { JSONObject() }

    /** What the night found, for the page to check; then forgotten. {goalId: [hits]} */
    fun take(ctx: Context): String {
        val f = File(ctx.filesDir, FILE)
        val s = try { if (f.exists()) f.readText() else "{}" } catch (e: Exception) { "{}" }
        try { f.delete() } catch (e: Exception) {}
        return s
    }
}

class ScoutNightReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val done = goAsync()
        Thread {
            try { ScoutNight.run(ctx.applicationContext) } catch (e: Exception) {} finally { done.finish() }
        }.start()
    }
}
