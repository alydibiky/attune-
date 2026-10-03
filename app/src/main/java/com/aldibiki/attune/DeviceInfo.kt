package com.aldibiki.attune

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.os.StatFs
import org.json.JSONObject
import java.io.File

/**
 * What the phone can actually do. The web view can only see a rounded,
 * capped RAM figure (Chrome reports at most 8 GB), so a 12, 16 or 24 GB phone
 * was never offered the models it can run. This reads the real numbers.
 */
object DeviceInfo {

    fun totalRamBytes(ctx: Context): Long {
        val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        return mi.totalMem
    }

    fun availRamBytes(ctx: Context): Long {
        val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        return mi.availMem
    }

    /** Marketing GB (a "12 GB" phone reports ~11.2 GiB usable). */
    fun ramGB(ctx: Context): Int {
        val gib = totalRamBytes(ctx) / (1024.0 * 1024.0 * 1024.0)
        val steps = intArrayOf(2, 3, 4, 6, 8, 10, 12, 16, 18, 20, 24, 32, 48, 64)
        for (s in steps) if (gib <= s * 0.98) return s
        return Math.round(gib).toInt()
    }

    fun cores(): Int = Runtime.getRuntime().availableProcessors()

    /** Max frequency (kHz) of each core, from sysfs. Empty if unreadable. */
    private fun coreMaxFreqs(): List<Long> {
        val out = ArrayList<Long>()
        for (i in 0 until cores()) {
            val f = File("/sys/devices/system/cpu/cpu$i/cpufreq/cpuinfo_max_freq")
            val v = try { f.readText().trim().toLong() } catch (e: Exception) { -1L }
            out.add(v)
        }
        return out
    }

    /** Kernel capacity of each core (little ~200-400, big ~700-1024). -1 where unreadable. */
    private fun coreCapacities(): List<Long> {
        val out = ArrayList<Long>()
        for (i in 0 until cores()) {
            val f = File("/sys/devices/system/cpu/cpu$i/cpu_capacity")
            out.add(try { f.readText().trim().toLong() } catch (e: Exception) { -1L })
        }
        return out
    }

    /**
     * Performance cores: the "prime" and "big" clusters. Token generation is
     * memory-bound and runs best on these alone; the little cores only slow
     * the others down by making them wait at every sync point.
     */
    fun bigCores(): Int {
        // cpu_capacity (0..1024, set by the kernel's energy model) tells the
        // clusters apart even when a "mid" cluster clocks close to the prime one.
        val cap = coreCapacities().filter { it > 0 }
        if (cap.size == cores() && cap.size >= 2) {
            val top = cap.maxOrNull() ?: 0L
            if (top > 0) return cap.count { it >= top * 0.6 }.coerceAtLeast(2)
        }
        val f = coreMaxFreqs().filter { it > 0 }
        if (f.isEmpty()) return (cores() / 2).coerceAtLeast(2)
        val top = f.maxOrNull() ?: return 2
        return f.count { it >= top * 0.7 }.coerceAtLeast(2)
    }

    /** dotprod (asimddp) is required by the engine build (armv8.2+dotprod). */
    fun hasDotprod(): Boolean = try {
        File("/proc/cpuinfo").readText().contains("asimddp")
    } catch (e: Exception) { true }  // unreadable: assume modern and let the engine try

    fun hasI8mm(): Boolean = try {
        File("/proc/cpuinfo").readText().contains("i8mm")
    } catch (e: Exception) { false }

    /** 0 = none ... 6 = shutdown, per PowerManager.THERMAL_STATUS_*. */
    fun thermalStatus(ctx: Context): Int {
        if (Build.VERSION.SDK_INT < 29) return 0
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        return pm.currentThermalStatus
    }

    /**
     * How close the phone is to throttling: 0.0 cool, 1.0 = it starts slowing
     * down (forecast 10 s ahead). -1 when the phone cannot tell (Android < 11
     * or no thermal HAL support).
     */
    fun thermalHeadroom(ctx: Context): Float {
        if (Build.VERSION.SDK_INT < 30) return -1f
        return try {
            val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
            val h = pm.getThermalHeadroom(10)
            if (h.isNaN()) -1f else h
        } catch (e: Exception) { -1f }
    }

    /** Hot enough to run cooler: status MODERATE or worse, or headroom forecast >= 0.95. */
    fun isHot(ctx: Context): Boolean = thermalStatus(ctx) >= 2 || thermalHeadroom(ctx) >= 0.95f

    /**
     * Between answers: at SEVERE or worse, wait (up to [maxMs]) for the phone
     * to drop back before starting the next long generation. Starting while
     * it is that hot only makes the governor cut the clocks harder mid-answer.
     * Returns the milliseconds waited. [stop] ends the wait early.
     */
    fun coolDown(ctx: Context, stop: java.util.concurrent.atomic.AtomicBoolean, maxMs: Long = 20000): Long {
        val t0 = System.currentTimeMillis()
        while (!stop.get() && thermalStatus(ctx) >= 3 && System.currentTimeMillis() - t0 < maxMs) {
            try { Thread.sleep(1000) } catch (e: InterruptedException) { break }
        }
        return System.currentTimeMillis() - t0
    }

    fun powerSave(ctx: Context): Boolean {
        val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
        return pm.isPowerSaveMode
    }

    fun batteryPct(ctx: Context): Int {
        val i = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return -1
        val level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
        return if (level >= 0 && scale > 0) level * 100 / scale else -1
    }

    fun charging(ctx: Context): Boolean {
        val i = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return false
        val s = i.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        return s == BatteryManager.BATTERY_STATUS_CHARGING || s == BatteryManager.BATTERY_STATUS_FULL
    }

    fun freeStorageBytes(ctx: Context): Long = try {
        StatFs(ctx.filesDir.absolutePath).availableBytes
    } catch (e: Exception) { -1L }

    /**
     * Threads for generation. Token generation is limited by memory speed, not
     * by cores: past 4 threads a phone gets no faster, only hotter, and the
     * extra threads steal the cores the screen needs to scroll smoothly.
     * On a hot or power-saving phone it drops further to stay steady.
     */
    fun generationThreads(ctx: Context): Int {
        var t = bigCores().coerceIn(2, 4)
        val thermal = thermalStatus(ctx)
        if (thermal >= 3 /* SEVERE */) t = 2
        else if (thermal >= 2 /* MODERATE */ || thermalHeadroom(ctx) >= 0.95f) t = (t - 1).coerceAtLeast(2)
        if (powerSave(ctx) && !charging(ctx)) t = (t - 1).coerceAtLeast(2)
        return t
    }

    /**
     * Prompt reading is compute-bound and benefits from more cores, but only
     * the performance cores: a little core finishes its share last and every
     * other thread waits for it. Two cores are always left free so the app
     * itself never freezes while it reads.
     */
    fun batchThreads(ctx: Context): Int {
        var t = minOf(bigCores(), cores() - 2).coerceIn(2, 6)
        if (isHot(ctx)) t = (t - 2).coerceAtLeast(2)
        return t
    }

    fun toJson(ctx: Context): JSONObject = JSONObject()
        .put("platform", "android")
        .put("ramGB", ramGB(ctx))
        .put("totalRamBytes", totalRamBytes(ctx))
        .put("availRamBytes", availRamBytes(ctx))
        .put("cores", cores())
        .put("bigCores", bigCores())
        .put("abi", Build.SUPPORTED_ABIS.firstOrNull() ?: "")
        .put("sdk", Build.VERSION.SDK_INT)
        .put("model", Build.MANUFACTURER + " " + Build.MODEL)
        .put("soc", if (Build.VERSION.SDK_INT >= 31) Build.SOC_MODEL else "")
        .put("dotprod", hasDotprod())
        .put("i8mm", hasI8mm())
        .put("thermal", thermalStatus(ctx))
        .put("thermalHeadroom", thermalHeadroom(ctx).toDouble())
        .put("genThreads", generationThreads(ctx))
        .put("powerSave", powerSave(ctx))
        .put("battery", batteryPct(ctx))
        .put("charging", charging(ctx))
        .put("freeStorageBytes", freeStorageBytes(ctx))
}
