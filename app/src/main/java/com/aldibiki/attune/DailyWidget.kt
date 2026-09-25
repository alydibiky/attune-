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
 * The home-screen widget: today's lesson (Learn daily) and today's headline
 * (Daily news). The page decides what it says (setWidget) whenever a lesson
 * is prepared or a digest is written; Android only draws it. Tapping a row
 * opens that lesson or digest — the same path as tapping its notification.
 */
class DailyWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val v = views(ctx)
        for (id in ids) mgr.updateAppWidget(id, v)
    }

    companion object {
        private const val PREFS = "attune_widget"

        /** {lesson: {label, title, open}, news: {label, title, open}} — "open" is a daily-… id. */
        fun save(ctx: Context, json: String) {
            JSONObject(json)   // refuse anything that isn't JSON
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", json).apply()
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, DailyWidget::class.java))
            if (ids.isNotEmpty()) { val v = views(ctx); for (id in ids) mgr.updateAppWidget(id, v) }
        }

        private fun views(ctx: Context): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_daily)
            val d = try { JSONObject(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("data", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
            row(ctx, v, d.optJSONObject("lesson"), R.id.w_lesson, R.id.w_lesson_label, R.id.w_lesson_title, "daily-learn")
            row(ctx, v, d.optJSONObject("news"), R.id.w_news, R.id.w_news_label, R.id.w_news_title, "daily-news")
            return v
        }

        private fun row(ctx: Context, v: RemoteViews, o: JSONObject?, box: Int, label: Int, title: Int, fallback: String) {
            if (o != null) {
                o.optString("label").takeIf { it.isNotBlank() }?.let { v.setTextViewText(label, it.take(60)) }
                o.optString("title").takeIf { it.isNotBlank() }?.let { v.setTextViewText(title, it.take(160)) }
            }
            val open = o?.optString("open")?.takeIf { it.startsWith("daily-") } ?: fallback
            val i = Intent(ctx, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(Reminders.EXTRA_ID, open)
            v.setOnClickPendingIntent(box, PendingIntent.getActivity(ctx, ("widget-" + fallback).hashCode(), i,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
    }
}
