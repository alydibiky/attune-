package com.aldibiki.attune

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * v9.9.28 T4 place reminders (Ali picked P-2: in the APK he installs himself first; the Play build doesn't even declare background
 * location and shows "Coming soon"). Android's own proximity alerts (no extra library): "arrive" at 150 m, "leave" at 200 m; whether a
 * reminder rings is decided by PlaceRing — EXACTLY web-src/placering.js placeRing (10,000-case test there): once per visit (back within
 * 10 minutes = the same visit, so GPS bounces and around-the-block don't ring twice), "leave" only after 3+ minutes inside.
 * The location never leaves the phone.
 */
object PlaceGeo {
    private const val PREFS = "attune.places"
    private const val CHANNEL = "places"
    fun isPlay(ctx: Context): Boolean = try { ctx.resources.getBoolean(R.bool.attune_play) } catch (e: Throwable) { false }
    fun supported(ctx: Context): Boolean = !isPlay(ctx)
    fun allowed(ctx: Context): Boolean {
        val fine = ctx.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val bg = Build.VERSION.SDK_INT < 29 || ctx.checkSelfPermission("android.permission.ACCESS_BACKGROUND_LOCATION") == PackageManager.PERMISSION_GRANTED
        return fine && bg
    }
    /** { reminders: [{ id, title, place, on: arrive|leave, done }], places: [{ id, name, lat, lng }] } → saved + the alerts set again. */
    fun save(ctx: Context, json: String) { ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", json).apply(); arm(ctx) }
    private fun pi(ctx: Context, id: String, kind: String, flags: Int): PendingIntent? =
        PendingIntent.getBroadcast(ctx, ("geo$kind$id").hashCode(), Intent(ctx, PlaceReceiver::class.java).putExtra("id", id).putExtra("kind", kind), flags or PendingIntent.FLAG_IMMUTABLE)
    fun arm(ctx: Context) {
        if (!supported(ctx)) return
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        // the old alerts away first
        val old = try { JSONArray(p.getString("armed", "[]")) } catch (e: Exception) { JSONArray() }
        for (i in 0 until old.length()) { val k = old.optString(i); val (id, kind) = k.split("|").let { it[0] to it.getOrElse(1) { "arrive" } }
            pi(ctx, id, kind, PendingIntent.FLAG_NO_CREATE)?.let { try { lm.removeProximityAlert(it) } catch (e: Throwable) {} } }
        val armed = JSONArray()
        if (!allowed(ctx)) { p.edit().putString("armed", armed.toString()).apply(); return }
        val d = try { JSONObject(p.getString("data", "{}")) } catch (e: Exception) { JSONObject() }
        val places = d.optJSONArray("places") ?: JSONArray(); val rems = d.optJSONArray("reminders") ?: JSONArray()
        for (i in 0 until rems.length()) { val r = rems.optJSONObject(i) ?: continue; if (r.optBoolean("done")) continue
            val pl = (0 until places.length()).mapNotNull { places.optJSONObject(it) }.firstOrNull { it.optString("id") == r.optString("place") } ?: continue
            val kind = if (r.optString("on") == "leave") "leave" else "arrive"
            val intent = pi(ctx, r.optString("id"), kind, PendingIntent.FLAG_UPDATE_CURRENT) ?: continue
            try { lm.addProximityAlert(pl.optDouble("lat"), pl.optDouble("lng"), if (kind == "leave") 200f else 150f, -1, intent); armed.put(r.optString("id") + "|" + kind) } catch (e: SecurityException) { }
        }
        p.edit().putString("armed", armed.toString()).apply()
    }

    // ---- the same decision as web-src/placering.js ----------------------------------------------------------------------------------
    private const val AWAY = 10 * 60000L; private const val STAY = 3 * 60000L
    fun ring(on: String, done: Boolean, entering: Boolean, st: JSONObject, now: Long): Boolean {
        if (done) return false
        if (entering) {
            if (st.optBoolean("inside")) return false
            st.put("inside", true)
            val sameVisit = st.has("leftAt") && now - st.optLong("leftAt") < AWAY
            if (!sameVisit) { st.put("visitAt", now); st.put("rung", false) }
            if (on != "leave" && !st.optBoolean("rung")) { st.put("rung", true); return true }
            return false
        }
        if (!st.optBoolean("inside")) return false
        st.put("inside", false); st.put("leftAt", now)
        if (on == "leave" && !st.optBoolean("rung") && st.has("visitAt") && now - st.optLong("visitAt") >= STAY) { st.put("rung", true); return true }
        return false
    }
    @Synchronized fun onAlert(ctx: Context, id: String, entering: Boolean) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val d = try { JSONObject(p.getString("data", "{}")) } catch (e: Exception) { return }
        val rems = d.optJSONArray("reminders") ?: return
        val r = (0 until rems.length()).mapNotNull { rems.optJSONObject(it) }.firstOrNull { it.optString("id") == id } ?: return
        val places = d.optJSONArray("places") ?: JSONArray()
        val pl = (0 until places.length()).mapNotNull { places.optJSONObject(it) }.firstOrNull { it.optString("id") == r.optString("place") }
        val all = try { JSONObject(p.getString("state", "{}")) } catch (e: Exception) { JSONObject() }
        val st = all.optJSONObject(id) ?: JSONObject()
        val rang = ring(r.optString("on", "arrive"), r.optBoolean("done"), entering, st, System.currentTimeMillis())
        all.put(id, st); p.edit().putString("state", all.toString()).apply()
        if (rang) notify(ctx, r, pl?.optString("name") ?: "", d.optString("lang", "en"))
    }
    private fun notify(ctx: Context, r: JSONObject, place: String, lang: String) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val ar = lang == "ar" || lang == "arb"
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null)
            nm.createNotificationChannel(NotificationChannel(CHANNEL, if (ar) "تذكير الأماكن" else "Place reminders", NotificationManager.IMPORTANCE_HIGH))
        val head = r.optString(if (r.optString("on") == "leave") "headLeave" else "headArrive").ifBlank { place }
        val i = Intent(ctx, MainActivity::class.java).putExtra(EXTRA_OPEN_PAGE, "reminders").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(ctx, ("place" + r.optString("id")).hashCode(), i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val b = (if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") android.app.Notification.Builder(ctx))
            .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(head).setContentText(r.optString("title"))
            .setStyle(android.app.Notification.BigTextStyle().bigText(r.optString("title"))).setAutoCancel(true).setContentIntent(pi)
        try { nm.notify(("place" + r.optString("id") + System.currentTimeMillis() / 60000).hashCode(), b.build()) } catch (e: SecurityException) { }
    }
}

/** Android says the phone entered / left one of the places. */
class PlaceReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val id = intent.getStringExtra("id") ?: return
        if (!intent.hasExtra(LocationManager.KEY_PROXIMITY_ENTERING)) return
        PlaceGeo.onAlert(ctx, id, intent.getBooleanExtra(LocationManager.KEY_PROXIMITY_ENTERING, false))
    }
}
