package com.aldibiki.attune

import android.content.Context
import android.content.pm.PackageManager
import android.provider.Telephony
import org.json.JSONArray
import org.json.JSONObject

/**
 * v8.7 (Ali, 29 Oct: "we agreed that it reads SMS, but not one-time codes"): the bank and wallet SMS already on the phone, read
 * ONCE when the person taps "Bring in my old bank SMS" — so Money starts with the past months, not from today. Only in the APK
 * Ali installs (the "full" build declares READ_SMS in src/full/AndroidManifest.xml); the Play build can't ask for it (Google
 * allows READ_SMS only for the default SMS app), so there the new SMS still come in through their notifications (PayListener).
 * Only texts that look like money (PayLog.looksLikeMoney) and are not one-time codes; nothing leaves the phone. The page reads
 * the list (NativeBridge.smsImport) with paytext.js, the same reader as a payment notification.
 */
object SmsInbox {
    /** This build declares READ_SMS (the full APK). */
    fun declared(ctx: Context): Boolean = try {
        val pi = ctx.packageManager.getPackageInfo(ctx.packageName, PackageManager.GET_PERMISSIONS)
        pi.requestedPermissions?.contains(android.Manifest.permission.READ_SMS) == true
    } catch (e: Exception) { false }

    fun granted(ctx: Context): Boolean = ctx.checkSelfPermission(android.Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED

    /** The money SMS of the last `days` days, newest first: [{ id, app: "SMS", who, title, text, ts }] (at most 600). */
    fun money(ctx: Context, days: Int): String {
        if (!granted(ctx)) return "[]"
        val out = JSONArray()
        val since = System.currentTimeMillis() - days.coerceIn(1, 730) * 86_400_000L
        try {
            ctx.contentResolver.query(Telephony.Sms.Inbox.CONTENT_URI, arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
                "${Telephony.Sms.DATE} >= ?", arrayOf(since.toString()), "${Telephony.Sms.DATE} DESC")?.use { c ->
                while (c.moveToNext() && out.length() < 600) {
                    val body = c.getString(2) ?: continue
                    if (PayLog.isOtp(body) || !PayLog.looksLikeMoney(body)) continue   // never a one-time code; only money
                    val who = c.getString(1) ?: ""
                    out.put(JSONObject().put("id", "sms:" + c.getLong(0)).put("pkg", "sms").put("app", "SMS").put("who", who)
                        .put("title", who).put("text", body.take(2000)).put("ts", c.getLong(3)))
                }
            }
        } catch (e: Exception) { }
        return out.toString()
    }
}
