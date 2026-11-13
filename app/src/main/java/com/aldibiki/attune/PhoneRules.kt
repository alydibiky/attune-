package com.aldibiki.attune

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * v9.9.26 phone rules (Ali picked R1-C + R2-A, combined screen OK'd 13 Nov). "When I connect to my car" fires at once — Android wakes
 * the app when a Bluetooth device connects (ACL_CONNECTED is allowed for receivers in the manifest). "When I start charging" and "when I
 * join Home Wi-Fi" are checked by Android's own background work about every 15 minutes (WorkManager) — no permanent notification.
 * decide() is EXACTLY web-src/phonerules.js decide() (10,000-case test there): the device by its address; the same rule within 60 s
 * once; charging once per charge; an unseen Wi-Fi name never fires; the rule's own hours / days. The page saves the rules with the
 * words to show (in the person's language); a fired rule shows Attune's own notification and is queued for the page to do its action.
 */
object PhoneRules {
    private const val PREFS = "attune.phonerules"
    private const val CHANNEL = "phonerules"
    private const val WORK = "attune-phonerules"

    fun save(ctx: Context, json: String) {
        val rules = try { JSONArray(json) } catch (e: Exception) { return }
        val we = rules.optJSONObject(0)?.optJSONArray("weekend")?.toString() ?: "[5,6]"   // the person's country weekend (sent by the page)
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("rules", rules.toString()).putString("weekend", we).apply()
        var needsCheck = false
        for (i in 0 until rules.length()) { val t = rules.optJSONObject(i)?.optJSONObject("when")?.optString("type") ?: ""; if ((t == "charging" || t == "wifi") && rules.optJSONObject(i)?.optBoolean("on", true) == true) needsCheck = true }
        try {
            val wm = WorkManager.getInstance(ctx)
            if (needsCheck) wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, PeriodicWorkRequestBuilder<PhoneRulesWorker>(15, TimeUnit.MINUTES).build())
            else wm.cancelUniqueWork(WORK)
        } catch (e: Throwable) { }
    }
    @Synchronized fun take(ctx: Context): String { val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE); val q = p.getString("queue", "[]") ?: "[]"; p.edit().putString("queue", "[]").apply(); return q }
    fun status(ctx: Context): String { val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE); return p.getString("state", "{}") ?: "{}" }

    fun btAllowed(ctx: Context): Boolean = Build.VERSION.SDK_INT < 31 || ctx.checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
    /** The paired devices: [{ name, address, type: car | headphones | speaker | other }] — needs "Nearby devices" (asked once by the page). */
    fun paired(ctx: Context): String {
        val out = JSONArray()
        if (!btAllowed(ctx)) return out.toString()
        try {
            val ad = (ctx.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter ?: return out.toString()
            for (d in ad.bondedDevices ?: emptySet()) {
                val c = d.bluetoothClass?.deviceClass ?: 0
                val type = when (c) { BluetoothClass.Device.AUDIO_VIDEO_CAR_AUDIO, BluetoothClass.Device.AUDIO_VIDEO_HANDSFREE -> "car"
                    BluetoothClass.Device.AUDIO_VIDEO_HEADPHONES, BluetoothClass.Device.AUDIO_VIDEO_WEARABLE_HEADSET -> "headphones"
                    BluetoothClass.Device.AUDIO_VIDEO_LOUDSPEAKER, BluetoothClass.Device.AUDIO_VIDEO_PORTABLE_AUDIO -> "speaker"; else -> "other" }
                out.put(JSONObject().put("name", d.name ?: d.address).put("address", d.address).put("type", type))
            }
        } catch (e: SecurityException) { }
        return out.toString()
    }
    /** The Wi-Fi network's name now ("" when Android doesn't show it — location off or not allowed). */
    @Suppress("DEPRECATION")
    fun wifiNow(ctx: Context): String = try {
        val s = (ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as android.net.wifi.WifiManager).connectionInfo?.ssid ?: ""
        val t = s.trim().removePrefix("\"").removeSuffix("\""); if (t == "<unknown ssid>") "" else t
    } catch (e: Throwable) { "" }

    // ---- the same decision as web-src/phonerules.js -------------------------------------------------------------------------------
    private fun mins(at: JSONObject?): Int? = if (at == null) null else at.optInt("h") * 60 + at.optInt("m")
    private fun allowedNow(ifs: JSONArray?, now: Long, weekend: Set<Int>): Boolean {
        val c = Calendar.getInstance().apply { timeInMillis = now }; val m = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE)
        val we = weekend.contains(c.get(Calendar.DAY_OF_WEEK) - 1)
        var a: Int? = null; var b: Int? = null
        if (ifs != null) for (i in 0 until ifs.length()) { val x = ifs.optJSONObject(i) ?: continue
            when (x.optString("type")) { "weekdays" -> if (we) return false; "weekend" -> if (!we) return false; "more", "less" -> return false
                "after" -> a = mins(x.optJSONObject("at")); "before" -> b = mins(x.optJSONObject("at")) } }
        val A = a; val B = b
        if (A != null && B != null) return if (A <= B) m >= A && m < B else m >= A || m < B
        if (A != null) return m >= A; if (B != null) return m < B
        return true
    }
    /** ev: { kind: "bt", address, name } | { kind: "power", on, since } | { kind: "wifi", ssid } → the fired rule ids; state updated. */
    fun decide(rules: JSONArray, ev: JSONObject, st: JSONObject, now: Long, weekend: Set<Int>): List<JSONObject> {
        val last = st.optJSONObject("last") ?: JSONObject().also { st.put("last", it) }
        val fire = ArrayList<JSONObject>()
        fun go(r: JSONObject) { if (!allowedNow(r.optJSONArray("if"), now, weekend)) return; val l = last.optLong(r.optString("id"), 0L); if (l > 0 && now - l < 60000) return; last.put(r.optString("id"), now); fire.add(r) }
        val live = (0 until rules.length()).mapNotNull { rules.optJSONObject(it) }.filter { it.optBoolean("on", true) && it.optJSONObject("when") != null }
        when (ev.optString("kind")) {
            "bt" -> for (r in live) { val w = r.optJSONObject("when")!!; if (w.optString("type") != "bluetooth") continue; val d = w.optJSONObject("device") ?: continue
                val hit = if (d.optString("address").isNotBlank()) d.optString("address").trim().equals(ev.optString("address").trim(), true) else d.optString("name").isNotBlank() && d.optString("name").trim().equals(ev.optString("name").trim(), true)
                if (hit) go(r) }
            "power" -> if (!ev.optBoolean("on")) { st.put("charging", false); st.put("chargeFired", false) }
                else if (!st.optBoolean("chargeFired") && now - ev.optLong("since", now) >= 60000) { st.put("charging", true); st.put("chargeFired", true); for (r in live) if (r.optJSONObject("when")!!.optString("type") == "charging") go(r) }
            "wifi" -> { val ssid = ev.optString("ssid").trim().removePrefix("\"").removeSuffix("\"")
                if (ssid.isBlank() || ssid == "<unknown ssid>") { st.put("blind", true) }
                else { st.put("blind", false); if (ssid != st.optString("ssid")) { st.put("ssid", ssid); for (r in live) { val w = r.optJSONObject("when")!!; if (w.optString("type") == "wifi" && w.optString("ssid").trim() == ssid) go(r) } } } }
        }
        return fire
    }

    @Synchronized fun onEvent(ctx: Context, ev: JSONObject) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val rules = try { JSONArray(p.getString("rules", "[]")) } catch (e: Exception) { return }; if (rules.length() == 0) return
        val st = try { JSONObject(p.getString("state", "{}")) } catch (e: Exception) { JSONObject() }
        val we = try { val a = JSONArray(p.getString("weekend", "[5,6]")); (0 until a.length()).map { a.optInt(it) }.toSet() } catch (e: Exception) { setOf(5, 6) }
        val now = System.currentTimeMillis()
        val fired = decide(rules, ev, st, now, we)
        val q = try { JSONArray(p.getString("queue", "[]")) } catch (e: Exception) { JSONArray() }
        for (r in fired) { r.optJSONObject("when")?.let { st.put("fired_" + r.optString("id"), now) }
            q.put(JSONObject().put("rule", r.optString("id")).put("at", now).put("kind", ev.optString("kind"))); notify(ctx, r) }
        p.edit().putString("state", st.toString()).putString("queue", q.toString()).apply()
    }
    private fun notify(ctx: Context, r: JSONObject) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null)
            nm.createNotificationChannel(NotificationChannel(CHANNEL, r.optString("channel", "Your rules"), NotificationManager.IMPORTANCE_DEFAULT))
        val i = Intent(ctx, MainActivity::class.java).putExtra(EXTRA_OPEN_PAGE, "automations").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pi = PendingIntent.getActivity(ctx, ("pr" + r.optString("id")).hashCode(), i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val b = (if (Build.VERSION.SDK_INT >= 26) android.app.Notification.Builder(ctx, CHANNEL) else @Suppress("DEPRECATION") android.app.Notification.Builder(ctx))
            .setSmallIcon(R.drawable.ic_stat_reminder).setContentTitle(r.optString("title", "Attune")).setContentText(r.optString("body", ""))
            .setStyle(android.app.Notification.BigTextStyle().bigText(r.optString("body", ""))).setAutoCancel(true).setContentIntent(pi)
        try { nm.notify(("pr" + r.optString("id") + System.currentTimeMillis() / 60000).hashCode(), b.build()) } catch (e: SecurityException) { }
    }
}

/** A Bluetooth device connected (Android wakes the app for this even when it's closed). */
class PhoneBtReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != BluetoothDevice.ACTION_ACL_CONNECTED) return
        val d: BluetoothDevice? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java) else @Suppress("DEPRECATION") intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
        if (d == null || !PhoneRules.btAllowed(ctx)) return
        try { PhoneRules.onEvent(ctx, JSONObject().put("kind", "bt").put("address", d.address).put("name", d.name ?: "")) } catch (e: SecurityException) { }
    }
}

/** About every 15 minutes (Android decides exactly): is the phone charging, which Wi-Fi is it on. */
class PhoneRulesWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        val c = applicationContext; val p = c.getSharedPreferences("attune.phonerules", Context.MODE_PRIVATE)
        val charging = try { (c.getSystemService(Context.BATTERY_SERVICE) as BatteryManager).isCharging } catch (e: Throwable) { false }
        // (a check every ~15 min can't see a 10-second bump: charging when it looks = charging for at least a minute)
        val since = if (charging) p.getLong("chargeSeen", 0L).takeIf { it > 0 } ?: (System.currentTimeMillis() - 60000).also { p.edit().putLong("chargeSeen", it).apply() } else { p.edit().remove("chargeSeen").apply(); 0L }
        PhoneRules.onEvent(c, JSONObject().put("kind", "power").put("on", charging).put("since", since))
        PhoneRules.onEvent(c, JSONObject().put("kind", "wifi").put("ssid", PhoneRules.wifiNow(c)))
        return Result.success()
    }
}
