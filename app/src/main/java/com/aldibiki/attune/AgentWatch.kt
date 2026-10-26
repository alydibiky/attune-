package com.aldibiki.attune

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject
import org.jsoup.Jsoup
import java.io.File

/**
 * v8.0 Agents (Ali, 25 Oct 2026: "tell the app when hotels near Masjid al-Haram become less than 45k for 4 nights, give me a
 * notice"): the page hands over each price watch {id, title, url, below, currency}. About every 12 hours Android wakes this
 * receiver — even with Attune closed — which opens each watched page (Booking, Amazon, noon…), reads the prices written on it
 * and keeps the lowest in a file. A price at or under the person's limit → one notification. When Attune opens, the page reads
 * the file (take) and shows what was found. Some sites only show prices to a real browser: then the agent says so and the
 * person taps Check now (the page opens inside Attune's browser, which reads it). Never runs with the Offline lock on; it
 * never signs in, books or pays.
 */
object AgentWatch {
    private const val PREFS = "attune.agentwatch"
    private const val FILE = "agent-watch.json"
    private const val REQ = 0x5c0a8
    private const val UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** plan = [{id, title, url, below, currency}]; an empty plan turns the checks off. */
    fun setPlan(ctx: Context, plan: String) {
        val arr = try { JSONArray(plan) } catch (e: Exception) { JSONArray() }
        prefs(ctx).edit().putString("plan", arr.toString()).apply()
        if (arr.length() > 0) arm(ctx) else cancel(ctx)
    }

    private fun pending(ctx: Context) = PendingIntent.getBroadcast(ctx, REQ, Intent(ctx, AgentWatchReceiver::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    /** In about 12 hours (± 30 minutes, so not every phone asks at the same minute). Inexact: no special permission. */
    fun arm(ctx: Context) {
        if (prefs(ctx).getString("plan", "[]") == "[]") return
        val am = ctx.getSystemService(AlarmManager::class.java) ?: return
        val at = System.currentTimeMillis() + 12 * 3600_000L + ((Math.random() - 0.5) * 3600_000L).toLong()
        try { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(ctx)) } catch (e: Exception) {}
    }

    private fun cancel(ctx: Context) { try { ctx.getSystemService(AlarmManager::class.java)?.cancel(pending(ctx)) } catch (e: Exception) {} }

    private val CUR = "(?<![A-Za-z])(?:US\\$|C\\$|A\\$|R\\$|[$€£¥₹₺]|EGP|E£|LE|SAR|AED|KWD|QAR|USD|EUR|GBP|TRY|جنيه|ج\\.م|ريال|درهم|دينار)"
    private val NUM = "(\\d{1,3}(?:[,. ]\\d{3})+|\\d{3,7})"
    private val PRICE = Regex("$CUR\\s?$NUM|$NUM\\s?$CUR")

    /** Prices written on a page's text ("EGP 48,200", "48.200 ج.م") → numbers (whole units). Pure. */
    fun prices(text: String): List<Long> = PRICE.findAll(text).mapNotNull { m ->
        val raw = (m.groupValues[1].ifEmpty { m.groupValues[2] }).replace(Regex("[,. ]"), "")
        raw.toLongOrNull()?.takeIf { it in 50..100_000_000 }
    }.toList()

    /** Reads one page → the lowest price on it, or null when the page shows no prices to an app (a browser check is needed). */
    private fun lowest(url: String): Long? = try {
        Prefs.requireOnline(url, "an agent checking a price")
        val doc = Jsoup.connect(url).userAgent(UA).header("Accept-Language", "en-US,en;q=0.8,ar;q=0.6")
            .timeout(15_000).maxBodySize(4_000_000).followRedirects(true).get()
        doc.select("script,style,noscript").remove()
        prices(doc.body()?.text() ?: "").minOrNull()
    } catch (e: Exception) { null }

    /** One round of checks. Called on a background thread. */
    fun run(ctx: Context) {
        val plan = try { JSONArray(prefs(ctx).getString("plan", "[]")) } catch (e: Exception) { JSONArray() }
        if (plan.length() == 0) return
        arm(ctx)                                     // the next round, whatever happens in this one
        if (Prefs.airGap(ctx)) return
        val out = read(ctx)
        val hits = ArrayList<String>()
        for (i in 0 until minOf(plan.length(), 12)) {   // v8.2: a hotel window is several start days
            val w = plan.optJSONObject(i) ?: continue
            val url = w.optString("url"); if (!url.startsWith("https://")) continue
            val low = lowest(url)
            val row = JSONObject().put("at", System.currentTimeMillis())
            if (low == null) row.put("blocked", true) else row.put("price", low)
            val list = out.optJSONArray(w.optString("id")) ?: JSONArray()
            list.put(row); out.put(w.optString("id"), list)
            val below = w.optLong("below", 0L)
            if (low != null && below > 0 && low <= below) hits.add(w.optString("title") + " · " + w.optString("currency") + " " + "%,d".format(low))
        }
        try { File(ctx.filesDir, FILE).writeText(out.toString()) } catch (e: Exception) {}
        if (hits.isNotEmpty()) Reminders.schedule(ctx, JSONObject().put("id", "agent-watch").put("at", System.currentTimeMillis() + 2000)
            .put("title", "Agents · price dropped")
            .put("body", hits.take(3).joinToString("\n") + "\nOpen Attune → Agents to see it."))
    }

    private fun read(ctx: Context): JSONObject = try { JSONObject(File(ctx.filesDir, FILE).readText()) } catch (e: Exception) { JSONObject() }

    /** What the checks found since the page last looked, then forgotten. {watchId: [{at, price | blocked}]} */
    fun take(ctx: Context): String {
        val f = File(ctx.filesDir, FILE)
        val s = try { if (f.exists()) f.readText() else "{}" } catch (e: Exception) { "{}" }
        try { f.delete() } catch (e: Exception) {}
        return s
    }
}

class AgentWatchReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val done = goAsync()
        Thread {
            try { AgentWatch.run(ctx.applicationContext) } catch (e: Exception) {} finally { done.finish() }
        }.start()
    }
}
