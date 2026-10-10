package com.aldibiki.attune

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * v6.14 — the Fit & Food home-screen widget (Yazio has one): calories left today, eaten / goal, water.
 * The page writes what it shows (setFitWidget) whenever the day changes; Android only draws it.
 * Tapping it opens Fit & Food.
 */
class FitWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val v = views(ctx)
        for (id in ids) mgr.updateAppWidget(id, v)
    }

    companion object {
        private const val PREFS = "attune_fit_widget"

        /** {left, leftLabel, line, water, day} — plain text, already in the app's language. */
        fun save(ctx: Context, json: String) {
            JSONObject(json)
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", json).apply()
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, FitWidget::class.java))
            if (ids.isNotEmpty()) { val v = views(ctx); for (id in ids) mgr.updateAppWidget(id, v) }
        }

        private fun views(ctx: Context): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_fit)
            val d = try { JSONObject(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
            d.optString("left").takeIf { it.isNotBlank() }?.let { v.setTextViewText(R.id.wf_left, it.take(8)) }
            d.optString("leftLabel").takeIf { it.isNotBlank() }?.let { v.setTextViewText(R.id.wf_left_label, it.take(30)) }
            d.optString("line").takeIf { it.isNotBlank() }?.let { v.setTextViewText(R.id.wf_line, it.take(80)) }
            d.optString("water").takeIf { it.isNotBlank() }?.let { v.setTextViewText(R.id.wf_water, it.take(40)) }
            val i = Intent(ctx, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(Reminders.EXTRA_ID, "daily-fit-widget")
            v.setOnClickPendingIntent(R.id.wf_root, PendingIntent.getActivity(ctx, "widget-fit".hashCode(), i,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            return v
        }
    }
}
