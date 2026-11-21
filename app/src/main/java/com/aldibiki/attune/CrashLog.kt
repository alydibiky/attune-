package com.aldibiki.attune

import android.content.Context
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * v10.8 (launch, Ali picked CR3 + "I don't want users to see the problem — they just send it"). Problems are kept quietly on the
 * phone (the newest 30): Android's reason when Attune closed by itself (ExitWatch), a crash on the screen thread with its lines,
 * and errors on a page. The person never sees them: only "Attune closed by itself last time" on Home (after a real close, once)
 * and "Send a problem report" in Settings. Send opens the share sheet with the report — nothing is ever sent by itself.
 * The report: version, phone, Android, the problems, and the battery log's last day. No messages, money, names or files.
 */
object CrashLog {
    private fun sp(ctx: Context) = ctx.getSharedPreferences("attune_crash", Context.MODE_PRIVATE)

    fun add(ctx: Context, kind: String, text: String, page: String = "", pending: Boolean = false) {
        try {
            val p = sp(ctx); val a = try { JSONArray(p.getString("log", "[]")) } catch (e: Exception) { JSONArray() }
            a.put(JSONObject().put("t", System.currentTimeMillis()).put("kind", kind).put("page", page).put("text", text.take(3000)))
            val out = JSONArray(); val from = maxOf(0, a.length() - 30); for (k in from until a.length()) out.put(a.get(k))
            val e = p.edit().putString("log", out.toString()); if (pending) e.putBoolean("pending", true); e.commit()   // commit: the app may be closing
        } catch (e: Exception) {}
    }
    fun count(ctx: Context): Int = try { JSONArray(sp(ctx).getString("log", "[]")).length() } catch (e: Exception) { 0 }
    fun pending(ctx: Context): Boolean = sp(ctx).getBoolean("pending", false)
    fun dismiss(ctx: Context) { sp(ctx).edit().putBoolean("pending", false).apply() }
    fun clear(ctx: Context) { sp(ctx).edit().remove("log").putBoolean("pending", false).apply() }
    fun setPage(ctx: Context, page: String) { try { sp(ctx).edit().putString("page", page.take(40)).apply() } catch (e: Exception) {} }
    fun page(ctx: Context): String = sp(ctx).getString("page", "") ?: ""

    fun report(ctx: Context): String {
        val f = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)
        val ver = try { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName } catch (e: Exception) { "?" }
        val sb = StringBuilder("Attune problem report\n")
        sb.append("Attune $ver · ${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})\n\n")
        val a = try { JSONArray(sp(ctx).getString("log", "[]")) } catch (e: Exception) { JSONArray() }
        for (i in a.length() - 1 downTo 0) { val o = a.optJSONObject(i) ?: continue
            sb.append("— ${f.format(Date(o.optLong("t")))} · ${o.optString("kind")}").append(if (o.optString("page").isNotEmpty()) " · on ${o.optString("page")}" else "").append("\n")
            sb.append(o.optString("text")).append("\n\n") }
        try { val b = JSONArray(BatteryGuard.json(ctx)); val since = System.currentTimeMillis() - 24 * 3600_000L
            // v10.8 (Ali's report came with an empty battery part): the level now, and a line when nothing ran in the background
            sb.append("Battery, last 24 h (now ${BatteryGuard.level(ctx)} %" + (if (BatteryGuard.charging(ctx)) ", charging" else "") + (if (BatteryGuard.saver(ctx)) ", battery saver" else "") + "):\n")
            var lines = 0
            for (i in 0 until b.length()) { val o = b.optJSONObject(i) ?: continue; if (o.optLong("t") < since) continue; lines++
                sb.append("  ${f.format(Date(o.optLong("t")))} ${o.optString("what")} · ${o.optInt("pct")} %").append(if (o.optBoolean("chg")) " charging" else "").append(if (o.optBoolean("saver")) " · saver" else "").append("\n") }
            if (lines == 0) sb.append("  nothing of Attune's ran in the background\n")
        } catch (e: Exception) {}
        return sb.toString().take(60_000)
    }
}
