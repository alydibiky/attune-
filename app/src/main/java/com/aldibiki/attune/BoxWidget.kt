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
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) { for (id in ids) try { mgr.updateAppWidget(id, views(ctx, id)) } catch (e: Exception) { } }

    companion object {
        /** v10.5 OK-W3: a tap opens the small box over the home screen (QuickBoxActivity) — the keyboard, or listening with the mic; Attune
         *  itself doesn't open. The look follows the app's Look or this widget's own (OK-S). */
        fun views(ctx: Context, id: Int): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_box)
            val p = W5.pal(ctx, W5.lookOf(ctx, id))
            v.setInt(R.id.wb_root, "setBackgroundResource", p.bg)
            v.setTextViewText(R.id.wb_text, W5.word(ctx, "tell", ctx.getString(R.string.widget_box_hint))); v.setTextColor(R.id.wb_text, p.mut)
            v.setTextColor(R.id.wb_mic, p.acc)
            v.setOnClickPendingIntent(R.id.wb_root, W5.quick(ctx, "say"))
            v.setOnClickPendingIntent(R.id.wb_text, W5.quick(ctx, "say"))
            v.setOnClickPendingIntent(R.id.wb_mic, W5.quick(ctx, "voice"))
            return v
        }
    }
}
