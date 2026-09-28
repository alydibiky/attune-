package com.aldibiki.attune

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import com.huawei.hmf.tasks.Task
import com.huawei.hms.hihealth.HuaweiHiHealth
import com.huawei.hms.hihealth.data.DataType
import com.huawei.hms.hihealth.data.SampleSet
import com.huawei.hms.hihealth.data.Scopes
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * v6.5 — Ali: "Yazio has Huawei Health, so do it". Huawei Health keeps its data in Huawei's own
 * Health Kit (it doesn't share with Health Connect), so this reads it there directly, the way
 * Yazio does: sign in with the Huawei ID once, allow steps / calories / distance / heart rate
 * (read only), then the day is read whenever Fit opens.
 *
 * Needs, on Huawei's side (done once by the app's owner, not by each user): an AppGallery Connect
 * app for com.aldibiki.attune with the signing key's SHA-256, Health Kit applied for, and its App
 * ID in gradle.properties (attune.hmsAppId) — until then `configured` is false and the app shows
 * the Health Sync route instead. On the phone: HMS Core and the Huawei Health app.
 */
object HuaweiHealth {
    const val HMS_CORE = "com.huawei.hwid"
    private const val PREFS = "attune-huawei"

    val SCOPES = arrayOf(
        Scopes.HEALTHKIT_STEP_READ,
        Scopes.HEALTHKIT_CALORIES_READ,
        Scopes.HEALTHKIT_DISTANCE_READ,
        Scopes.HEALTHKIT_HEARTRATE_READ,
    )

    /** The App ID in the manifest ("appid=123…"); empty until the AppGallery Connect app exists. */
    fun appId(ctx: Context): String = try {
        val ai = ctx.packageManager.getApplicationInfo(ctx.packageName, PackageManager.GET_META_DATA)
        (ai.metaData?.get("com.huawei.hms.client.appid")?.toString() ?: "").removePrefix("appid=").trim()
    } catch (e: Exception) { "" }

    fun configured(ctx: Context) = appId(ctx).isNotEmpty()

    fun authorized(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("ok", false)
    private fun setAuthorized(ctx: Context, ok: Boolean) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("ok", ok).apply()

    fun status(ctx: Context): JSONObject = JSONObject()
        .put("configured", configured(ctx))
        .put("hms", Health.installed(ctx, HMS_CORE))
        .put("app", Health.installed(ctx, Health.HUAWEI))
        .put("authorized", authorized(ctx))

    /** Huawei's own sign-in + permission screens (the Huawei Health app's page too). */
    fun authIntent(activity: Activity): Intent = HuaweiHiHealth.getSettingController(activity).requestAuthorizationIntent(SCOPES, true)

    /** The result of those screens → remembered; true when the user allowed it. */
    fun onAuthResult(activity: Activity, data: Intent?): Boolean {
        val ok = try { HuaweiHiHealth.getSettingController(activity).parseHealthKitAuthResultFromIntent(data)?.isSuccess == true } catch (e: Exception) { false }
        if (ok) setAuthorized(activity, true)
        return ok
    }

    private fun <T> await(t: Task<T>, secs: Long = 12): T? {
        val latch = CountDownLatch(1)
        var out: T? = null
        t.addOnSuccessListener { out = it; latch.countDown() }
        t.addOnFailureListener { latch.countDown() }
        latch.await(secs, TimeUnit.SECONDS)
        return out
    }

    /** Every numeric field of a day's summation, by field name ("steps_delta" → 8421.0 …). */
    private fun fields(set: SampleSet?): Map<String, Double> {
        val m = HashMap<String, Double>()
        if (set == null) return m
        for (p in set.samplePoints) for (f in p.dataType.fields) {
            val v = Regex("-?\\d+(\\.\\d+)?").find(p.getFieldValue(f).toString())?.value?.toDoubleOrNull() ?: continue
            m[f.name] = (m[f.name] ?: 0.0) + v
        }
        return m
    }

    /** One day (yyyy-mm-dd) in the same shape as Health.day: steps, activeKcal, distanceM, hrAvg, hrMax, sources. */
    fun day(ctx: Context, date: String): JSONObject {
        val out = JSONObject().put("available", "ready").put("via", "huawei")
        if (!configured(ctx)) return out.put("available", "none").put("error", "not configured")
        val zone = ZoneId.systemDefault()
        val d = try { LocalDate.parse(date) } catch (e: Exception) { LocalDate.now(zone) }
        val today = d == LocalDate.now(zone)
        val ymd = d.year * 10000 + d.monthValue * 100 + d.dayOfMonth
        val dc = HuaweiHiHealth.getDataController(ctx)
        fun read(t: DataType): Map<String, Double> = try {
            fields(await(if (today) dc.readTodaySummation(t) else dc.readDailySummation(t, ymd, ymd)))
        } catch (e: Exception) { emptyMap() }
        val steps = read(DataType.DT_CONTINUOUS_STEPS_DELTA)
        val cal = read(DataType.DT_CONTINUOUS_CALORIES_BURNT)
        val dist = read(DataType.DT_CONTINUOUS_DISTANCE_DELTA)
        val hr = read(DataType.DT_INSTANTANEOUS_HEART_RATE)
        steps.entries.firstOrNull { it.key.contains("step") }?.let { out.put("steps", Math.round(it.value)) }
        cal.entries.firstOrNull { it.key.contains("calorie") }?.let {
            // Health Kit gives kcal; a value only a cal count could reach is converted
            out.put("activeKcal", Math.round(if (it.value > 20000) it.value / 1000 else it.value))
        }
        dist.entries.firstOrNull { it.key.contains("distance") }?.let { out.put("distanceM", Math.round(it.value)) }
        hr.entries.firstOrNull { it.key == "avg" || it.key.contains("avg") }?.let { out.put("hrAvg", Math.round(it.value)) }
        hr.entries.firstOrNull { it.key == "max" || it.key.contains("max") }?.let { out.put("hrMax", Math.round(it.value)) }
        if (steps.isEmpty() && cal.isEmpty() && dist.isEmpty()) {
            // every read failed: most often the permission was withdrawn in Huawei Health
            if (!Health.installed(ctx, HMS_CORE)) return out.put("available", "none").put("error", "no HMS Core")
            out.put("empty", true)
        }
        return out.put("sources", JSONArray().put(Health.HUAWEI)).put("workouts", JSONArray())
    }
}
