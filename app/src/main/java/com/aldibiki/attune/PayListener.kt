package com.aldibiki.attune

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * v6.27 — "Money tracks itself" (ROADMAP_2026-10-13.md): payment notifications from banks, InstaPay and wallets are
 * read ON THE PHONE and offered to Money, so spending is logged without typing.
 *
 * Android only lets an app read notifications after the person turns on "Notification access" for it in Settings
 * (Attune asks, and says why). Play restricts reading SMS, so SMS is never read — only the notifications other apps
 * post. Of those, only texts that look like money (an amount with a currency, or a debit / credit / transfer word)
 * are kept — the last 200, in the app's private preferences; nothing is sent anywhere. The page reads them with
 * payQueue(), reads each one with paytext.js (the same reader as a shared bank message) and lists them in Money to
 * confirm. Tests: tests/unit/v727paylog.test.mjs (the page side).
 */
class PayListener : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        try {
            if (sbn == null || sbn.packageName == packageName) return
            val ex = sbn.notification?.extras ?: return
            val title = ex.getCharSequence("android.title")?.toString().orEmpty()
            val text = (ex.getCharSequence("android.bigText") ?: ex.getCharSequence("android.text"))?.toString().orEmpty()
            val all = "$title $text"
            if (!PayLog.looksLikeMoney(all)) return
            val label = try { packageManager.getApplicationLabel(packageManager.getApplicationInfo(sbn.packageName, 0)).toString() } catch (e: Exception) { sbn.packageName }
            PayLog.add(applicationContext, JSONObject()
                .put("id", sbn.packageName + ":" + sbn.postTime + ":" + all.hashCode())
                .put("pkg", sbn.packageName).put("app", label)
                .put("title", title.take(200)).put("text", text.take(1000)).put("ts", sbn.postTime))
        } catch (e: Exception) { }
    }
}

object PayLog {
    private const val PREFS = "attune.paylog"
    private const val KEY = "items"
    private const val MAX = 200

    // an amount next to a currency, or a money word next to a number (English and Arabic)
    private val CUR = Regex("(?i)(\\d[\\d,٬.٫]*\\s*(egp|le|l\\.e|usd|sar|aed|kwd|qar|eur|gbp|\\$|€|£|جنيه|ج\\.م|جم|ريال|درهم|دولار|يورو))|((egp|le|usd|sar|aed|eur|gbp|\\$|€|£|جنيه|ج\\.م)\\s*\\d)")
    private val WORD = Regex("(?i)(debited|credited|purchase|payment|paid|received|transfer|withdraw|deposit|spent|charged|instapay|خصم|إيداع|ايداع|تحويل|سحب|شراء|استلام|دفع|مدفوعات|رصيد)")
    private val NUM = Regex("[\\d٠-٩]{2,}")

    fun looksLikeMoney(s: String): Boolean = s.length in 8..2000 && (CUR.containsMatchIn(s) || (WORD.containsMatchIn(s) && NUM.containsMatchIn(s)))

    @Synchronized fun add(ctx: Context, item: JSONObject) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = try { JSONArray(p.getString(KEY, "[]")) } catch (e: Exception) { JSONArray() }
        for (i in 0 until arr.length()) if (arr.optJSONObject(i)?.optString("id") == item.optString("id")) return   // the same notification, updated
        val out = JSONArray()
        val start = maxOf(0, arr.length() - (MAX - 1))
        for (i in start until arr.length()) out.put(arr.get(i))
        out.put(item)
        p.edit().putString(KEY, out.toString()).apply()
    }

    @Synchronized fun list(ctx: Context): String = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]") ?: "[]"

    /** Forget the given ids (the page has handled them: confirmed or dismissed). */
    @Synchronized fun remove(ctx: Context, idsJson: String) {
        val ids = try { JSONArray(idsJson) } catch (e: Exception) { JSONArray() }
        val drop = HashSet<String>(); for (i in 0 until ids.length()) drop.add(ids.optString(i))
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = try { JSONArray(p.getString(KEY, "[]")) } catch (e: Exception) { JSONArray() }
        val out = JSONArray()
        for (i in 0 until arr.length()) { val o = arr.optJSONObject(i) ?: continue; if (!drop.contains(o.optString("id"))) out.put(o) }
        p.edit().putString(KEY, out.toString()).apply()
    }

    /** Is Notification access on for Attune? */
    fun enabled(ctx: Context): Boolean {
        val flat = Settings.Secure.getString(ctx.contentResolver, "enabled_notification_listeners") ?: return false
        val me = ComponentName(ctx, PayListener::class.java).flattenToString()
        return flat.split(":").any { it == me }
    }

    /** Open Android's Notification access screen (the person turns Attune on there). */
    fun openSettings(ctx: Context) {
        try { ctx.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) { }
    }
}
