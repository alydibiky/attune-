package com.aldibiki.attune

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.PowerManager
import org.json.JSONArray
import org.json.JSONObject

/**
 * v10.8 (launch: battery). Two things:
 *  · when to hold back: the always-listening wake word stops while the phone's Battery saver is on or the battery is at 15 % or
 *    less and not charging; the agents' and Scout's background checks wait while the battery is that low (they run at the next
 *    round). Charging or turning Battery saver off brings everything back by itself.
 *  · a small battery log on the phone: each background job writes when it ran and the battery level then (the newest 400), so a
 *    day on a real phone shows what Attune did and what it cost. Read by the page (NativeBridge.batteryLog), never sent anywhere.
 */
object BatteryGuard {
    private const val LOW = 15

    fun level(ctx: Context): Int {
        val i = try { ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) } catch (e: Exception) { null } ?: return -1
        val l = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1); val s = i.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        return if (l >= 0 && s > 0) l * 100 / s else -1
    }
    fun charging(ctx: Context): Boolean = try { (ctx.getSystemService(Context.BATTERY_SERVICE) as BatteryManager).isCharging } catch (e: Exception) { false }
    fun saver(ctx: Context): Boolean = try { (ctx.getSystemService(Context.POWER_SERVICE) as PowerManager).isPowerSaveMode } catch (e: Exception) { false }
    /** The battery is low and not charging. */
    fun low(ctx: Context): Boolean { val l = level(ctx); return l in 0..LOW && !charging(ctx) }
    /** The always-listening mic holds back: Battery saver on, or the battery low. */
    fun holdMic(ctx: Context): Boolean = !charging(ctx) && (saver(ctx) || low(ctx))

    private fun sp(ctx: Context) = ctx.getSharedPreferences("attune_battery_log", Context.MODE_PRIVATE)
    /** One line in the log: what ran (e.g. "agents", "scout", "wake on", "wake off", "skipped: agents (low)"). */
    fun log(ctx: Context, what: String) {
        try {
            val p = sp(ctx); val a = try { JSONArray(p.getString("log", "[]")) } catch (e: Exception) { JSONArray() }
            a.put(JSONObject().put("t", System.currentTimeMillis()).put("what", what).put("pct", level(ctx)).put("chg", charging(ctx)).put("saver", saver(ctx)))
            val out = JSONArray(); val from = maxOf(0, a.length() - 400); for (k in from until a.length()) out.put(a.get(k))
            p.edit().putString("log", out.toString()).apply()
        } catch (e: Exception) {}
    }
    fun json(ctx: Context): String = sp(ctx).getString("log", "[]") ?: "[]"
    fun clear(ctx: Context) { sp(ctx).edit().remove("log").apply() }
}
