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

    // ---- speed (Engine → Speed) ------------------------------------------------
    /** Run the model on the GPU (OpenCL/Adreno) instead of the CPU. Off by default. */
    fun gpu(ctx: Context): Boolean = sp(ctx).getBoolean("gpu", false)
    fun setGpu(ctx: Context, on: Boolean) = sp(ctx).edit().putBoolean("gpu", on).commit()

    /** Set while a GPU start is in progress; still set at the next launch = that start crashed. */
    fun gpuTrial(ctx: Context): Boolean = sp(ctx).getBoolean("gpu_trial", false)
    fun setGpuTrial(ctx: Context, on: Boolean) = sp(ctx).edit().putBoolean("gpu_trial", on).commit()

    /** Why GPU was switched off automatically, shown once on the Engine screen. */
    fun gpuNote(ctx: Context): String = sp(ctx).getString("gpu_note", "") ?: ""
    fun setGpuNote(ctx: Context, s: String) = sp(ctx).edit().putString("gpu_note", s).apply()

    /** Speculative decoding with a small draft model (Qwen 3.5 0.8B). */
    fun draft(ctx: Context): Boolean = sp(ctx).getBoolean("draft", false)
    fun setDraft(ctx: Context, on: Boolean) = sp(ctx).edit().putBoolean("draft", on).apply()
    fun draftModel(ctx: Context): String? = sp(ctx).getString("draft_model", null)
    fun setDraftModel(ctx: Context, id: String?) = sp(ctx).edit().putString("draft_model", id).apply()

    // ---- the fast engine (LiteRT-LM, .litertlm models) ----------------------------
    /** Keep the fast engine on the CPU (the GPU is the default and the point of it). */
    fun fastCpu(ctx: Context): Boolean = sp(ctx).getBoolean("fast_cpu", false)
    fun setFastCpu(ctx: Context, on: Boolean) = sp(ctx).edit().putBoolean("fast_cpu", on).commit()
    /**
     * Multi-token prediction (speculative decoding) in the fast engine. OFF by
     * default since v5.17: on Ali's phone it doubled tokens — "ItIt is is",
     * "July 20205", "Lynk & Co 9000" — faster, but wrong words and wrong numbers.
     */
    fun fastMtp(ctx: Context): Boolean = sp(ctx).getBoolean("fast_mtp_v2", false)
    fun setFastMtp(ctx: Context, on: Boolean) = sp(ctx).edit().putBoolean("fast_mtp_v2", on).commit()
    /** Crash guard for the fast engine's GPU start, like gpu_trial. */
    fun fastTrial(ctx: Context): Boolean = sp(ctx).getBoolean("fast_trial", false)
    fun setFastTrial(ctx: Context, on: Boolean) = sp(ctx).edit().putBoolean("fast_trial", on).commit()
    fun fastNote(ctx: Context): String = sp(ctx).getString("fast_note", "") ?: ""
    fun setFastNote(ctx: Context, s: String) = sp(ctx).edit().putString("fast_note", s).apply()
}
