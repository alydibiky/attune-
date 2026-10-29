package com.aldibiki.attune

import android.content.Context
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * v6.40 Recall (agent C): when the person switches it on, the notifications they get (chats, email, deliveries, banks) are
 * kept on the phone for 30 days so Recall can find them by meaning later — "the address Ahmed sent", «كود الواي فاي».
 * SMS only with the SMS switch on and never a one-time code (v8.7), never Attune's own, never ongoing ones (music, downloads, navigation), never "3 new messages"
 * summaries. Kept in the app's private storage; nothing leaves the phone. Read by the page through NativeBridge.recallNotes.
 */
object RecallLog {
    private const val PREFS = "attune.recall"
    private const val MAX = 1500
    private const val DAYS = 30L

    fun isOn(ctx: Context): Boolean = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("on", false)
    fun setOn(ctx: Context, on: Boolean) {
        val e = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("on", on)
        if (!on) e.remove("items")   // switching it off forgets what was kept
        e.apply()
    }

    @Synchronized
    fun add(ctx: Context, sbn: StatusBarNotification, app: String, title: String, text: String) {
        if (!isOn(ctx)) return
        val n = sbn.notification ?: return
        if (sbn.packageName == ctx.packageName || sbn.isOngoing) return
        // v8.7 (Ali: "it reads SMS, but not one-time codes"): SMS with the SMS switch on — a one-time code never
        if (WatchMatch.isSms(sbn.packageName) && (!WatchMatch.smsAllowed || PayLog.isOtp(title) || PayLog.isOtp(text))) return
        if ((n.flags and android.app.Notification.FLAG_GROUP_SUMMARY) != 0) return
        if (text.isBlank() || n.category == android.app.Notification.CATEGORY_PROGRESS || n.category == android.app.Notification.CATEGORY_TRANSPORT) return
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = try { JSONArray(p.getString("items", "[]")) } catch (e: Exception) { JSONArray() }
        val cut = System.currentTimeMillis() - DAYS * 86_400_000L
        val keep = JSONArray()
        val key = sbn.packageName + "|" + title + "|" + text
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            if (o.optLong("ts") < cut) continue
            if (o.optString("pkg") + "|" + o.optString("title") + "|" + o.optString("text") == key) continue   // the same message updated
            keep.put(o)
        }
        keep.put(JSONObject().put("id", sbn.packageName + ":" + sbn.postTime + ":" + key.hashCode()).put("pkg", sbn.packageName)
            .put("app", app).put("title", title.take(200)).put("text", text.take(2000)).put("ts", sbn.postTime))
        val out = if (keep.length() > MAX) JSONArray().also { a -> for (i in keep.length() - MAX until keep.length()) a.put(keep.get(i)) } else keep
        p.edit().putString("items", out.toString()).apply()
    }

    fun items(ctx: Context): String = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("items", "[]") ?: "[]"

    @Synchronized
    fun forget(ctx: Context, idsJson: String) {
        val ids = try { JSONArray(idsJson) } catch (e: Exception) { return }
        val gone = (0 until ids.length()).map { ids.optString(it) }.toSet()
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = try { JSONArray(p.getString("items", "[]")) } catch (e: Exception) { return }
        val keep = JSONArray()
        for (i in 0 until arr.length()) { val o = arr.optJSONObject(i) ?: continue; if (o.optString("id") !in gone) keep.put(o) }
        p.edit().putString("items", keep.toString()).apply()
    }
}
