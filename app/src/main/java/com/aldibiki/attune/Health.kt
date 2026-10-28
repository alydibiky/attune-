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
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.WeightRecord
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

    /** v8.7 (persona 4, idea 15 — Ali: "some watches measure a lot of these already"): what the watch measures about the body —
     *  blood pressure, oxygen (SpO2), sleep, resting heart rate, heart-rate variability (the stress signal), glucose, weight.
     *  Asked only from Health → "From your watch"; each one is read only when granted (most watches measure some, not all). */
    val VITAL_PERMISSIONS: Set<String> = setOf(
        HealthPermission.getReadPermission(BloodPressureRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(RestingHeartRateRecord::class),
        HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
        HealthPermission.getReadPermission(BloodGlucoseRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
    )

    /**
     * v8.7: the last `days` days of vitals → {available, granted, of, days: [{day, bp: [{sys, dia, at}], spo2, spo2Min, sleepMin,
     * restHr, hrv, glucose: [{mgdl, at}], kg}]}. A night's sleep belongs to the day it ends on. Averages are per day.
     */
    fun vitals(ctx: Context, days: Int): JSONObject {
        val out = JSONObject().put("available", availability(ctx))
        if (out.getString("available") != "ready") return out
        val have = granted(ctx)
        out.put("granted", VITAL_PERMISSIONS.count { it in have }).put("of", VITAL_PERMISSIONS.size)
        val client = HealthConnectClient.getOrCreate(ctx)
        val zone = ZoneId.systemDefault()
        val end = Instant.now(); val start = end.minusSeconds(days.coerceIn(1, 120) * 86400L)
        val range = TimeRangeFilter.between(start, end)
        val by = sortedMapOf<String, JSONObject>()
        fun dayOf(t: Instant): JSONObject { val d = t.atZone(zone).toLocalDate().toString(); return by.getOrPut(d) { JSONObject().put("day", d) } }
        fun ok(p: String) = p in have
        val avg = HashMap<String, MutableList<Double>>()   // "day|key" → values
        fun note(t: Instant, key: String, v: Double) { val d = dayOf(t).getString("day"); avg.getOrPut("$d|$key") { mutableListOf() }.add(v) }
        if (ok(HealthPermission.getReadPermission(BloodPressureRecord::class))) try {
            for (r in runBlocking { client.readRecords(ReadRecordsRequest(BloodPressureRecord::class, timeRangeFilter = range)) }.records) {
                val o = dayOf(r.time); val a = o.optJSONArray("bp") ?: JSONArray().also { o.put("bp", it) }
                a.put(JSONObject().put("sys", Math.round(r.systolic.inMillimetersOfMercury)).put("dia", Math.round(r.diastolic.inMillimetersOfMercury)).put("at", r.time.toEpochMilli()))
            }
        } catch (e: Exception) { out.put("bpError", e.message ?: "") }
        if (ok(HealthPermission.getReadPermission(OxygenSaturationRecord::class))) try {
            for (r in runBlocking { client.readRecords(ReadRecordsRequest(OxygenSaturationRecord::class, timeRangeFilter = range)) }.records) note(r.time, "spo2", r.percentage.value)
        } catch (e: Exception) { out.put("spo2Error", e.message ?: "") }
        if (ok(HealthPermission.getReadPermission(SleepSessionRecord::class))) try {
            for (r in runBlocking { client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, timeRangeFilter = range)) }.records) {
                val o = dayOf(r.endTime); o.put("sleepMin", o.optInt("sleepMin", 0) + ((r.endTime.toEpochMilli() - r.startTime.toEpochMilli()) / 60000L).toInt())
            }
        } catch (e: Exception) { out.put("sleepError", e.message ?: "") }
        if (ok(HealthPermission.getReadPermission(RestingHeartRateRecord::class))) try {
            for (r in runBlocking { client.readRecords(ReadRecordsRequest(RestingHeartRateRecord::class, timeRangeFilter = range)) }.records) note(r.time, "restHr", r.beatsPerMinute.toDouble())
        } catch (e: Exception) { out.put("restHrError", e.message ?: "") }
        if (ok(HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class))) try {
            for (r in runBlocking { client.readRecords(ReadRecordsRequest(HeartRateVariabilityRmssdRecord::class, timeRangeFilter = range)) }.records) note(r.time, "hrv", r.heartRateVariabilityMillis)
        } catch (e: Exception) { out.put("hrvError", e.message ?: "") }
        if (ok(HealthPermission.getReadPermission(BloodGlucoseRecord::class))) try {
            for (r in runBlocking { client.readRecords(ReadRecordsRequest(BloodGlucoseRecord::class, timeRangeFilter = range)) }.records) {
                val o = dayOf(r.time); val a = o.optJSONArray("glucose") ?: JSONArray().also { o.put("glucose", it) }
                a.put(JSONObject().put("mgdl", Math.round(r.level.inMilligramsPerDeciliter)).put("at", r.time.toEpochMilli()))
            }
        } catch (e: Exception) { out.put("glucoseError", e.message ?: "") }
        if (ok(HealthPermission.getReadPermission(WeightRecord::class))) try {
            for (r in runBlocking { client.readRecords(ReadRecordsRequest(WeightRecord::class, timeRangeFilter = range)) }.records) dayOf(r.time).put("kg", Math.round(r.weight.inKilograms * 10) / 10.0)
        } catch (e: Exception) { out.put("weightError", e.message ?: "") }
        for ((k, v) in avg) {
            val (d, key) = k.split("|"); val o = by[d] ?: continue
            o.put(key, Math.round(v.average() * 10) / 10.0)
            if (key == "spo2") o.put("spo2Min", v.minOrNull() ?: 0.0)
        }
        return out.put("days", JSONArray(by.values.toList()))
    }

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
                // v8.2 (Ali, 26 Oct: Attune showed 6,017 steps · 8 kcal · 0.2 km while his watch said 6,442 · 406 kcal · 5.74 km):
                // Health Connect's merged total can take the phone's own small numbers over the watch's. Each app is read on its
                // own and, per number, the app that saw the most wins (one wearer, so the biggest count is the real one)
                if (a.dataOrigins.size > 1) for (o in a.dataOrigins) try {
                    val b = client.aggregate(AggregateRequest(metrics = metrics, timeRangeFilter = range, dataOriginFilter = setOf(o)))
                    fun more(key: String, v: Long?) { if (v != null && v > out.optLong(key, -1L)) out.put(key, v) }
                    more("steps", b[StepsRecord.COUNT_TOTAL])
                    more("activeKcal", b[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let { Math.round(it.inKilocalories) })
                    more("totalKcal", b[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.let { Math.round(it.inKilocalories) })
                    more("distanceM", b[DistanceRecord.DISTANCE_TOTAL]?.let { Math.round(it.inMeters) })
                } catch (e: Exception) {}
                // when the newest steps arrived (Health Sync sends the watch's data every so often, not live)
                if (HealthPermission.getReadPermission(StepsRecord::class) in have) try {
                    val last = client.readRecords(ReadRecordsRequest(StepsRecord::class, timeRangeFilter = range, ascendingOrder = false, pageSize = 1)).records.firstOrNull()
                    if (last != null) out.put("lastAt", last.endTime.toEpochMilli())
                } catch (e: Exception) {}
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
