package com.aldibiki.attune

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.AlarmClock
import android.provider.CalendarContract
import org.json.JSONObject

/**
 * Hands a confirmed action to the app that does it best, already filled in:
 * the Clock app for alarms and timers, the Calendar for appointments,
 * WhatsApp for a message, the dialer for a call. The person still taps
 * Save / Send / Call there — Attune never sends or calls on its own, and needs
 * no permission to read contacts, calendars or messages.
 */
object PhoneActions {

    /** a = {kind, hour, minute, days[], title, at, minutes, place, note, phone, message, seconds} */
    fun open(ctx: Context, a: JSONObject): JSONObject {
        val kind = a.optString("kind")
        val intent: Intent = when (kind) {
            "alarm" -> Intent(AlarmClock.ACTION_SET_ALARM)
                .putExtra(AlarmClock.EXTRA_HOUR, a.optInt("hour"))
                .putExtra(AlarmClock.EXTRA_MINUTES, a.optInt("minute"))
                .putExtra(AlarmClock.EXTRA_MESSAGE, a.optString("title").take(60))
                .putExtra(AlarmClock.EXTRA_SKIP_UI, false)
                .apply {
                    val d = a.optJSONArray("days")
                    if (d != null && d.length() > 0) putIntegerArrayListExtra(AlarmClock.EXTRA_DAYS,
                        ArrayList((0 until d.length()).map { d.optInt(it) }))   // Calendar.SUNDAY = 1 … SATURDAY = 7
                }
            "timer" -> Intent(AlarmClock.ACTION_SET_TIMER)
                .putExtra(AlarmClock.EXTRA_LENGTH, a.optInt("seconds").coerceIn(1, 24 * 3600))
                .putExtra(AlarmClock.EXTRA_MESSAGE, a.optString("title").take(60))
                .putExtra(AlarmClock.EXTRA_SKIP_UI, false)
            "calendar" -> {
                val begin = a.optLong("at")
                val end = begin + a.optInt("minutes", 60).coerceIn(5, 24 * 60) * 60_000L
                Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
                    .putExtra(CalendarContract.Events.TITLE, a.optString("title"))
                    .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, begin)
                    .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end)
                    .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, a.optBoolean("allDay", false))
                    .putExtra(CalendarContract.Events.EVENT_LOCATION, a.optString("place"))
                    .putExtra(CalendarContract.Events.DESCRIPTION, a.optString("note"))
            }
            "whatsapp" -> {
                val phone = a.optString("phone").filter { it.isDigit() }
                val msg = a.optString("message")
                if (phone.length >= 8) {
                    // wa.me opens the chat with that number, message typed in, not sent.
                    Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$phone?text=" + Uri.encode(msg)))
                        .setPackage(whatsappPackage(ctx))
                } else {
                    // No number: WhatsApp's own "send to…" list, with the message ready.
                    Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, msg)
                        .setPackage(whatsappPackage(ctx))
                }
            }
            "call" -> Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + a.optString("phone").filter { it.isDigit() || it == '+' }))
            "sms" -> Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + a.optString("phone").filter { it.isDigit() || it == '+' }))
                .putExtra("sms_body", a.optString("message"))
            else -> return JSONObject().put("ok", false).put("error", "Unknown action")
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            ctx.startActivity(intent)
            JSONObject().put("ok", true)
        } catch (e: ActivityNotFoundException) {
            // WhatsApp not installed (or a clock app without timers): fall back
            // to the share sheet / the plain link instead of failing.
            if (kind == "whatsapp") try {
                ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain")
                    .putExtra(Intent.EXTRA_TEXT, a.optString("message")), null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return JSONObject().put("ok", true).put("note", "WhatsApp isn't installed — opened the share sheet instead.")
            } catch (e2: Exception) {}
            JSONObject().put("ok", false).put("error", "No app on this phone can do that.")
        } catch (e: Exception) {
            JSONObject().put("ok", false).put("error", e.message ?: "Could not open it")
        }
    }

    /** WhatsApp, or WhatsApp Business if that is the one installed; null lets Android choose. */
    private fun whatsappPackage(ctx: Context): String? {
        val pm = ctx.packageManager
        for (p in listOf("com.whatsapp", "com.whatsapp.w4b")) {
            try { pm.getPackageInfo(p, 0); return p } catch (e: Exception) {}
        }
        return null
    }
}
