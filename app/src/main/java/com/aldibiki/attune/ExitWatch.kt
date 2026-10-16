package com.aldibiki.attune

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.io.File
import java.util.Date

/**
 * v6.29 (Ali: "the app still crashes on its own a lot"). The engine runs inside the app's own process, so a crash in the
 * native engine — or Android closing the app because the phone ran out of memory — closes the whole app with no message and
 * nothing in any log. Android (11+) remembers WHY each process ended (ApplicationExitInfo). On every start this reads the
 * endings since the last start, writes them to the Engine log (with the model that was running) and keeps the newest
 * unexpected one for the page, which tells the person once what happened. Then every crash can be fixed from facts.
 */
object ExitWatch {
    @Volatile var last: JSONObject? = null
        private set

    private fun why(r: Int, status: Int): Pair<String, Boolean> = when (r) {
        ApplicationExitInfo.REASON_CRASH -> "an app error" to true
        ApplicationExitInfo.REASON_CRASH_NATIVE -> "an engine crash (native code)" to true
        ApplicationExitInfo.REASON_LOW_MEMORY -> "the phone ran out of memory" to true
        ApplicationExitInfo.REASON_ANR -> "it stopped responding" to true
        ApplicationExitInfo.REASON_SIGNALED -> "the system stopped it (signal $status)" to true
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "it used too much of the phone (battery / CPU)" to true
        ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "it failed to start" to true
        ApplicationExitInfo.REASON_FREEZER -> "the system froze it in the background" to false
        ApplicationExitInfo.REASON_EXIT_SELF -> "it closed itself" to false
        ApplicationExitInfo.REASON_USER_REQUESTED, ApplicationExitInfo.REASON_USER_STOPPED -> "you closed it" to false
        ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "a permission changed" to false
        ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "a part it needs stopped" to true
        ApplicationExitInfo.REASON_PACKAGE_UPDATED, ApplicationExitInfo.REASON_PACKAGE_STATE_CHANGE -> "it was updated" to false
        else -> "reason $r" to false
    }

    fun clearLast() { last = null }

    fun check(ctx: Context) {
        if (Build.VERSION.SDK_INT < 30) return
        try {
            val am = ctx.getSystemService(ActivityManager::class.java) ?: return
            val prefs = ctx.getSharedPreferences("attune", Context.MODE_PRIVATE)
            val seen = prefs.getLong("exit_seen", 0L)
            val fresh = am.getHistoricalProcessExitReasons(ctx.packageName, 0, 8).filter { it.timestamp > seen }
            if (fresh.isEmpty()) return
            prefs.edit().putLong("exit_seen", fresh.maxOf { it.timestamp }).apply()
            val model = prefs.getString("model_at_exit", null) ?: Prefs.activeModel(ctx)
            val sb = StringBuilder()
            var newest: JSONObject? = null
            for (e in fresh.sortedBy { it.timestamp }) {
                val (text, unexpected) = why(e.reason, e.status)
                // (a process ended in the background while not in use is ordinary Android housekeeping, not a crash)
                val background = e.importance >= ActivityManager.RunningAppProcessInfo.IMPORTANCE_CACHED
                sb.append("\nApp ended ${Date(e.timestamp)}: $text").append(if (background) " (in the background)" else "")
                    .append(" · ${e.description ?: ""} · memory ${e.pss / 1024} MB (pss) / ${e.rss / 1024} MB (rss)")
                    .append(if (model != null) " · model: $model" else "").append("\n")
                if (e.reason == ApplicationExitInfo.REASON_ANR) try { e.traceInputStream?.use { sb.append(it.bufferedReader().readText().take(4000)).append("\n") } } catch (x: Exception) {}
                if (unexpected && !background) newest = JSONObject().put("at", e.timestamp).put("why", text).put("reason", e.reason)
                    .put("memMB", e.pss / 1024).put("model", model ?: JSONObject.NULL).put("desc", e.description ?: "")
            }
            try { File(ctx.filesDir, "engine.log").appendText(sb.toString()) } catch (e: Exception) {}
            last = newest
        } catch (e: Exception) {}
    }
}
