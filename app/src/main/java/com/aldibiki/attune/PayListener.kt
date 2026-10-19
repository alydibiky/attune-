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
            // v6.40: the message alerts the person asked for ("tell me when Ahmed messages me") — before the money check
            try { MessageWatch.check(applicationContext, sbn, title, text) } catch (e: Exception) { }
            // v6.40 Recall: kept for 30 days when the person switched it on (never SMS)
            try { if (RecallLog.isOn(applicationContext)) RecallLog.add(applicationContext, sbn, try { packageManager.getApplicationLabel(packageManager.getApplicationInfo(sbn.packageName, 0)).toString() } catch (e: Exception) { sbn.packageName }, title, text) } catch (e: Exception) { }
            if (!PayLog.looksLikeMoney(all)) return
            val label = try { packageManager.getApplicationLabel(packageManager.getApplicationInfo(sbn.packageName, 0)).toString() } catch (e: Exception) { sbn.packageName }
            try { AutoRules.check(applicationContext, sbn, label, title, text) } catch (e: Exception) { }   // v6.41 C3: the person's automations
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

    // an amount next to a currency, or a money word next to a number — v6.27 worldwide: any 3-letter currency code
    // (USD, EUR, INR…) or currency sign, and the money words of the common banking languages; plus the words of free
    // trials and renewals ("your trial ends", "renews on") for the Deadline Radar
    private val CUR = Regex("(\\d[\\d,٬.٫' ]*\\s*([A-Z]{3}\\b|LE\\b|L\\.E|le\\b|l\\.e|[\$€£¥₹₺₽₩₦₱฿₫৳₪₴₵]|R\\$|zł|Kč|kr\\b|Rp|RM|Rs\\.?|Ksh|جنيه|ج\\.م|جم|ريال|درهم|دينار|دولار|يورو|руб|грн|元|円|원))|(([A-Z]{3}|[\$€£¥₹₺₽₩₦₱฿₫৳₪₴₵]|R\\$|Rp|RM|Rs\\.?|Ksh|جنيه|ج\\.م)\\s*\\d)")
    private val WORD = Regex("(?i)(debited|credited|purchase|payment|paid|received|transfer|withdraw|deposit|spent|charged|refund|instapay|upi|pix|trial|renew|subscription|billing|invoice|receipt|warranty|expires|débit|crédit|paiement|achat|virement|prélèvement|remboursement|essai|abonnement|cargo|abono|pago|compra|transferencia|reembolso|prueba|suscripci|pagamento|compra|transferência|estorno|assinatura|zahlung|gutschrift|überweisung|lastschrift|abbuchung|probe|abo|kündig|addebito|accredito|bonifico|rimborso|prova|abbonamento|ödeme|harcama|havale|iade|deneme|abonelik|pembayaran|transfer|langganan|uji coba|списан|зачислен|оплата|перевод|подписк|支付|付款|收到|订阅|결제|입금|구독|支払|入金|خصم|إيداع|ايداع|تحويل|سحب|شراء|استلام|دفع|مدفوعات|رصيد|اشتراك|تجربة|تجديد)")
    private val NUM = Regex("[\\d٠-٩]{2,}")

    // v6.29 (privacy policy + Play review): one-time codes are never kept, even when the message also names an amount
    private val OTP = Regex("""(?i)\b(otp|one[- ]time (pass(word|code)?|code)|verification code|security code|passcode|auth(entication)? code|2fa)\b|رمز التحقق|كود التحقق|رمز التفعيل|كلمة المرور لمرة واحدة|الرمز السري|كود التفعيل|رقم سري""")
    fun looksLikeMoney(s: String): Boolean = s.length in 8..2000 && !OTP.containsMatchIn(s) && (CUR.containsMatchIn(s) || (WORD.containsMatchIn(s) && NUM.containsMatchIn(s)))

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
