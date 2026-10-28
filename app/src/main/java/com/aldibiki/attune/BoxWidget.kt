package com.aldibiki.attune

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * v8.7 (persona 4, idea 11 — Ali: "do all"): the Attune box as a home-screen widget. A tap opens Home with the box ready to
 * type ("lunch 150", "remind me at 9"); the mic opens the voice screen. Nothing is drawn from data — it never goes stale.
 */
class BoxWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val v = RemoteViews(ctx.packageName, R.layout.widget_box)
        v.setOnClickPendingIntent(R.id.wb_root, open(ctx, "box-widget"))
        v.setOnClickPendingIntent(R.id.wb_text, open(ctx, "box-widget"))
        v.setOnClickPendingIntent(R.id.wb_mic, open(ctx, "box-widget-voice"))
        for (id in ids) mgr.updateAppWidget(id, v)
    }

    private fun open(ctx: Context, what: String): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(Reminders.EXTRA_ID, what)
        return PendingIntent.getActivity(ctx, what.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
}
