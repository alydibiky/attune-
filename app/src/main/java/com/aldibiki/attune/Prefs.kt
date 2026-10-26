package com.aldibiki.attune

import android.content.Context

object Prefs {
    private const val NAME = "attune"
    private fun sp(ctx: Context) = ctx.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    /** SMS (Ali picked B, 25 Oct 2026): the SMS app's notifications are read for Message alerts, "who messaged me" and voice
     *  replies ONLY when the person switches this on (off by default). Never the SMS inbox, never one-time codes. */
    fun smsNotifs(ctx: Context): Boolean = sp(ctx).getBoolean("sms_notifs", false)
    fun setSmsNotifs(ctx: Context, on: Boolean) { sp(ctx).edit().putBoolean("sms_notifs", on).apply(); WatchMatch.smsAllowed = on }

    /** Voice phase 3: «يا أتيون» heard by the phone itself (WakeService) — off by default; when = always | screen | charging;
     *  sensitivity = low | normal | high. */
    fun wake(ctx: Context): Boolean = sp(ctx).getBoolean("wake", false)
    fun setWake(ctx: Context, on: Boolean) { sp(ctx).edit().putBoolean("wake", on).apply() }
    fun wakeWhen(ctx: Context): String = sp(ctx).getString("wake_when", "always") ?: "always"
    fun wakeSensitivity(ctx: Context): String = sp(ctx).getString("wake_sens", "normal") ?: "normal"
    /** the language the quiet orb listens in (the voice screen's, e.g. ar-EG) */
    fun wakeLang(ctx: Context): String = sp(ctx).getString("wake_lang", "ar-EG") ?: "ar-EG"
    fun setWakeOpts(ctx: Context, `when`: String?, sens: String?, lang: String? = null) {
        val e = sp(ctx).edit()
        if (lang != null && Regex("^[a-z]{2,3}(-[A-Z]{2})?$").matches(lang)) e.putString("wake_lang", lang)
        if (`when` in listOf("always", "screen", "charging")) e.putString("wake_when", `when`)
        if (sens in listOf("low", "normal", "high")) e.putString("wake_sens", sens)
        e.apply()
    }

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
    // v6.34: the NPU (Snapdragon Hexagon), experimental — off unless the person turns it on; a crash at start turns it off
    fun npu(ctx: Context): Boolean = sp(ctx).getBoolean("npu", false)
    fun setNpu(ctx: Context, on: Boolean) = sp(ctx).edit().putBoolean("npu", on).commit()
    fun npuTrial(ctx: Context): Boolean = sp(ctx).getBoolean("npu_trial", false)
    fun setNpuTrial(ctx: Context, on: Boolean) = sp(ctx).edit().putBoolean("npu_trial", on).commit()
    fun npuNote(ctx: Context): String = sp(ctx).getString("npu_note", "") ?: ""
    fun setNpuNote(ctx: Context, s: String) = sp(ctx).edit().putString("npu_note", s).apply()
    fun gpuNote(ctx: Context): String = sp(ctx).getString("gpu_note", "") ?: ""
    fun setGpuNote(ctx: Context, s: String) = sp(ctx).edit().putString("gpu_note", s).apply()

    /** Speculative decoding with a small draft model (Qwen 3.5 0.8B). */
    fun draft(ctx: Context): Boolean = sp(ctx).getBoolean("draft", false)
    fun setDraft(ctx: Context, on: Boolean) = sp(ctx).edit().putBoolean("draft", on).apply()
    fun draftModel(ctx: Context): String? = sp(ctx).getString("draft_model", null)
    fun setDraftModel(ctx: Context, id: String?) = sp(ctx).edit().putString("draft_model", id).apply()

    /** Faster writing (multi-token prediction): "auto" (on when the model has it), "on" or "off". */
    fun mtpMode(ctx: Context): String = sp(ctx).getString("mtp_mode", "auto") ?: "auto"
    fun setMtpMode(ctx: Context, m: String) = sp(ctx).edit().putString("mtp_mode", if (m == "on" || m == "off") m else "auto").apply()
    /** Models whose engine failed to start with the MTP flags: they run without them from then on. */
    fun mtpBad(ctx: Context, id: String): Boolean = (sp(ctx).getStringSet("mtp_bad", emptySet()) ?: emptySet()).contains(id)
    fun setMtpBad(ctx: Context, id: String) {
        val s = HashSet(sp(ctx).getStringSet("mtp_bad", emptySet()) ?: emptySet()); s.add(id)
        sp(ctx).edit().putStringSet("mtp_bad", s).apply()
    }

    /** Models that once wrote nonsense ("0000…") on this phone: they start in safe mode (no
     *  speculation of any kind, full-precision memory) from then on. Set by the page's nonsense guard. */
    /** v6.41 (X2): the thread counts the tuner measured fastest for a model on this phone → (generation, prompt) or null. */
    fun tunedThreads(ctx: Context, id: String): Pair<Int, Int>? {
        val v = sp(ctx).getString("tuned_" + id, null) ?: return null
        val p = v.split(",").mapNotNull { it.trim().toIntOrNull() }
        return if (p.size == 2 && p[0] in 1..12 && p[1] in 1..12) Pair(p[0], p[1]) else null
    }
    fun setTunedThreads(ctx: Context, id: String, gen: Int, batch: Int) {
        val e = sp(ctx).edit(); if (gen <= 0) e.remove("tuned_" + id) else e.putString("tuned_" + id, "$gen,$batch"); e.apply()
    }
    fun safeMode(ctx: Context, id: String): Boolean = (sp(ctx).getStringSet("safe_models", emptySet()) ?: emptySet()).contains(id)
    fun setSafeMode(ctx: Context, id: String, on: Boolean) {
        val s = HashSet(sp(ctx).getStringSet("safe_models", emptySet()) ?: emptySet()); if (on) s.add(id) else s.remove(id)
        sp(ctx).edit().putStringSet("safe_models", s).apply()
    }

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
