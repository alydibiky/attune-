package com.aldibiki.attune

import android.content.Context

object Prefs {
    private const val NAME = "attune"
    private fun sp(ctx: Context) = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    /** Offline lock: when on, nothing inside the app may reach the network. */
    fun airGap(ctx: Context): Boolean = sp(ctx).getBoolean("air_gap", false).also { airGapNow = it }
    fun setAirGap(ctx: Context, on: Boolean) {
        airGapNow = on
        sp(ctx).edit().putBoolean("air_gap", on).apply()
    }

    /** Same value, readable without a Context by the network code (a second lock behind the bridge's). */
    @Volatile var airGapNow: Boolean = false
        private set

    /** Throws if the offline lock is on; logs the refusal. Call before any network access. */
    fun requireOnline(url: String, what: String) {
        if (airGapNow) {
            NetLog.add(url, what, blocked = true)
            throw java.io.IOException("Offline lock is on — $what needs the internet.")
        }
        NetLog.add(url, what)
    }

    fun activeModel(ctx: Context): String? = sp(ctx).getString("active_model", null)
    fun setActiveModel(ctx: Context, id: String?) = sp(ctx).edit().putString("active_model", id).apply()

    fun lastVersion(ctx: Context): Long = sp(ctx).getLong("last_version", -1L)
    fun setLastVersion(ctx: Context, v: Long) = sp(ctx).edit().putLong("last_version", v).apply()
}
