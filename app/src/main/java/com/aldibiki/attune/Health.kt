package com.aldibiki.attune

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalBodyTemperatureRecord
import androidx.health.connect.client.records.SkinTemperatureRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * v6.3 — Ali: "make it connected to watches for steps, calories burned etc."
 * Android's Health Connect is where the watch apps put their data (Samsung Health for Galaxy
 * Watch, Fitbit / Pixel Watch, Garmin Connect, Mi Fitness, Withings, Oura, Google Fit…). Attune
 * READS from it only: steps, active and total calories burned, distance, heart rate and the
 * workouts of a day. Nothing is written and nothing leaves the phone.
 */
object Health {
    private const val PROVIDER = "com.google.android.apps.healthdata"

    val PERMISSIONS: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
    )

    /** v6.41 (F4): asked only from Cycle — the watch's night skin temperature, or a basal temperature typed into another app. */
    val TEMP_PERMISSIONS: Set<String> = setOf(
        HealthPermission.getReadPermission(SkinTemperatureRecord::class),
        HealthPermission.getReadPermission(BasalBodyTemperatureRecord::class),
    )

    /**
     * v6.41 (F4): one number a night for the last `days` days → {available, granted, nights: [{day, t, kind}]}.
     * kind "skin" = the watch's average change from its own baseline that night (°C); "basal" = a measured basal temperature.
     * The night belongs to the day it ends on (local). Skin wins when a night has both.
     */
    fun nights(ctx: Context, days: Int): JSONObject {
        val out = JSONObject().put("available", availability(ctx))
        if (out.getString("available") != "ready") return out
        val have = granted(ctx)
        out.put("granted", TEMP_PERMISSIONS.count { it in have })
        val client = HealthConnectClient.getOrCreate(ctx)
        val zone = ZoneId.systemDefault()
        val end = Instant.now(); val start = end.minusSeconds(days.coerceIn(1, 400) * 86400L)
        val range = TimeRangeFilter.between(start, end)
        val by = LinkedHashMap<String, JSONObject>()
        if (HealthPermission.getReadPermission(BasalBodyTemperatureRecord::class) in have) try {
            for (r in runBlocking { client.readRecords(ReadRecordsRequest(BasalBodyTemperatureRecord::class, timeRangeFilter = range)) }.records) {
                val d = r.time.atZone(zone).toLocalDate().toString()
                by[d] = JSONObject().put("day", d).put("t", r.temperature.inCelsius).put("kind", "basal")
            }
        } catch (e: Exception) { out.put("basalError", e.message ?: "") }
        if (HealthPermission.getReadPermission(SkinTemperatureRecord::class) in have) try {
            for (r in runBlocking { client.readRecords(ReadRecordsRequest(SkinTemperatureRecord::class, timeRangeFilter = range)) }.records) {
                if (r.deltas.isEmpty()) continue
                val avg = r.deltas.map { it.delta.inCelsius }.average()
                val d = r.endTime.atZone(zone).toLocalDate().toString()
                by[d] = JSONObject().put("day", d).put("t", Math.round(avg * 100) / 100.0).put("kind", "skin")
            }
        } catch (e: Exception) { out.put("skinError", e.message ?: "") }   // phones without the skin-temperature feature
        return out.put("nights", JSONArray(by.values.toList()))
    }

    /** "ready" (installed), "update" (Health Connect must be installed/updated), "none" (this phone can't). */
    fun availability(ctx: Context): String = when (HealthConnectClient.getSdkStatus(ctx, PROVIDER)) {
        HealthConnectClient.SDK_AVAILABLE -> "ready"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update"
        else -> "none"
    }

    // v6.4 — Ali: "I want also Huawei Health connected". Huawei Health doesn't write to Health Connect
    // itself; Health Sync (nl.appyhapps.healthsync) copies Huawei Health → Health Connect, and from
    // there it is read like every other watch. These say which of the two are on the phone.
    const val HUAWEI = "com.huawei.health"
    const val HEALTH_SYNC = "nl.appyhapps.healthsync"
    /** v6.43: watch makers' apps that share steps, calories and workouts with Health Connect (Fit's "Automatic tracking"). */
    val WATCH_APPS = listOf("com.sec.android.app.shealth", "com.garmin.android.apps.connectmobile", "com.fitbit.FitbitMobile",
        "fi.polar.polarflow", "com.xiaomi.wearable", "com.mi.health", "com.huami.watch.hmwatchmanager", "com.google.android.apps.fitness")
    fun installed(ctx: Context, pkg: String): Boolean = try {
        ctx.packageManager.getPackageInfo(pkg, 0); true
    } catch (e: Exception) { false }

    fun granted(ctx: Context): Set<String> = if (availability(ctx) != "ready") emptySet() else try {
        runBlocking { HealthConnectClient.getOrCreate(ctx).permissionController.getGrantedPermissions() }
    } catch (e: Exception) { emptySet() }

    /** {available, granted: [..], steps, activeKcal, totalKcal, distanceM, hrAvg, hrMax, workouts: [{title, type, start, end, minutes}], sources: [..]} for one day (yyyy-mm-dd, local). */
    fun day(ctx: Context, date: String): JSONObject {
        val out = JSONObject().put("available", availability(ctx))
        if (out.getString("available") != "ready") return out
        val client = HealthConnectClient.getOrCreate(ctx)
        val zone = ZoneId.systemDefault()
        val d = try { LocalDate.parse(date) } catch (e: Exception) { LocalDate.now(zone) }
        val start: Instant = d.atStartOfDay(zone).toInstant()
        val end: Instant = minOf(d.plusDays(1).atStartOfDay(zone).toInstant(), Instant.now())
        val range = TimeRangeFilter.between(start, end)
        return runBlocking {
            val have = client.permissionController.getGrantedPermissions()
            out.put("granted", JSONArray(have.filter { it in PERMISSIONS }))
            if (have.isEmpty()) return@runBlocking out
            val metrics = buildSet {
                if (HealthPermission.getReadPermission(StepsRecord::class) in have) add(StepsRecord.COUNT_TOTAL)
                if (HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class) in have) add(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)
                if (HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class) in have) add(TotalCaloriesBurnedRecord.ENERGY_TOTAL)
                if (HealthPermission.getReadPermission(DistanceRecord::class) in have) add(DistanceRecord.DISTANCE_TOTAL)
                if (HealthPermission.getReadPermission(HeartRateRecord::class) in have) { add(HeartRateRecord.BPM_AVG); add(HeartRateRecord.BPM_MAX) }
            }
            if (metrics.isNotEmpty()) {
                val a = client.aggregate(AggregateRequest(metrics = metrics, timeRangeFilter = range))
                a[StepsRecord.COUNT_TOTAL]?.let { out.put("steps", it) }
                a[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let { out.put("activeKcal", Math.round(it.inKilocalories)) }
                a[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.let { out.put("totalKcal", Math.round(it.inKilocalories)) }
                a[DistanceRecord.DISTANCE_TOTAL]?.let { out.put("distanceM", Math.round(it.inMeters)) }
                a[HeartRateRecord.BPM_AVG]?.let { out.put("hrAvg", it) }
                a[HeartRateRecord.BPM_MAX]?.let { out.put("hrMax", it) }
                out.put("sources", JSONArray(a.dataOrigins.map { it.packageName }))
            }
            if (HealthPermission.getReadPermission(ExerciseSessionRecord::class) in have) {
                val w = JSONArray()
                for (s in client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, timeRangeFilter = range)).records) {
                    w.put(JSONObject().put("title", s.title ?: "").put("type", s.exerciseType)
                        .put("start", s.startTime.toEpochMilli()).put("end", s.endTime.toEpochMilli())
                        .put("minutes", ((s.endTime.toEpochMilli() - s.startTime.toEpochMilli()) / 60000L).toInt())
                        .put("source", s.metadata.dataOrigin.packageName))
                }
                out.put("workouts", w)
            }
            out
        }
    }
}
