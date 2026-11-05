package com.aldibiki.attune

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

/**
 * v9.3 (Ali, 5 Nov 2026, D2: "do all and make people choose") — two home-screen widgets:
 *  · Attune · To-dos: today's to-dos with a tick box, the next prayer (only when prayer times are on) and "safe to spend today" (only
 *    when that is on in Settings → Your day);
 *  · Attune · A list: the list the person pinned from the app (travel, shopping…), with tick boxes.
 * The page decides what they say (NativeBridge.setTodoWidget / setListWidget, in the person's language); Android only draws it.
 * A tick on the home screen is kept here (WidgetTick) and the row leaves the widget at once; the page applies the ticks the next time
 * Attune opens (NativeBridge.widgetTicks → clearWidgetTicks). Nothing leaves the phone.
 */
class TodoWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) { for (id in ids) mgr.updateAppWidget(id, Widgets.views(ctx, Widgets.TODO)) }
}
class ListWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) { for (id in ids) mgr.updateAppWidget(id, Widgets.views(ctx, Widgets.LIST)) }
}
class WidgetTick : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val which = intent.getStringExtra("which") ?: return
        val id = intent.getStringExtra("id") ?: return
        val kind = intent.getStringExtra("kind") ?: ""
        try { Widgets.tick(ctx, which, kind, id) } catch (e: Exception) { }
    }
}

object Widgets {
    const val TODO = "todo"
    const val LIST = "list"
    private const val PREFS = "attune_widget2"

    fun save(ctx: Context, which: String, json: String) {
        JSONObject(json)   // refuse anything that isn't JSON
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(which, json).apply()
        refresh(ctx, which)
    }

    private fun refresh(ctx: Context, which: String) {
        val mgr = AppWidgetManager.getInstance(ctx)
        val cls = if (which == TODO) TodoWidget::class.java else ListWidget::class.java
        val ids = mgr.getAppWidgetIds(ComponentName(ctx, cls))
        if (ids.isNotEmpty()) { val v = views(ctx, which); for (id in ids) mgr.updateAppWidget(id, v) }
    }

    /** A tick on the home screen: kept for the page, and the row leaves the widget now. */
    @Synchronized fun tick(ctx: Context, which: String, kind: String, id: String) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val ticks = try { JSONArray(p.getString("ticks", "[]")) } catch (e: Exception) { JSONArray() }
        if (ticks.length() < 200) ticks.put(JSONObject().put("which", which).put("kind", kind).put("id", id).put("at", System.currentTimeMillis()))
        val d = try { JSONObject(p.getString(which, "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
        val rows = d.optJSONArray("rows") ?: JSONArray(); val left = JSONArray()
        for (i in 0 until rows.length()) { val r = rows.optJSONObject(i) ?: continue; if (r.optString("id") == id) { if (which == LIST) { r.put("done", true); left.put(r) } } else left.put(r) }
        d.put("rows", left)
        p.edit().putString("ticks", ticks.toString()).putString(which, d.toString()).apply()
        refresh(ctx, which)
    }

    fun ticks(ctx: Context): String = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("ticks", "[]") ?: "[]"
    fun clearTicks(ctx: Context) { ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("ticks", "[]").apply() }

    fun views(ctx: Context, which: String): RemoteViews {
        val todo = which == TODO
        val v = RemoteViews(ctx.packageName, if (todo) R.layout.widget_todo else R.layout.widget_list)
        val d = try { JSONObject(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(which, "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
        val pre = if (todo) "wt" else "wl"
        fun rid(name: String) = ctx.resources.getIdentifier(pre + "_" + name, "id", ctx.packageName)
        d.optString("title").takeIf { it.isNotBlank() }?.let { v.setTextViewText(rid("title"), it.take(60)) }
        v.setTextViewText(rid("side"), d.optString("side").take(40))
        val foot = d.optString("foot")
        v.setViewVisibility(rid("foot"), if (foot.isNotBlank()) View.VISIBLE else View.GONE); v.setTextViewText(rid("foot"), foot.take(60))
        d.optString("empty").takeIf { it.isNotBlank() }?.let { v.setTextViewText(rid("empty"), it.take(120)) }
        val rows = d.optJSONArray("rows") ?: JSONArray()
        val max = if (todo) 4 else 5
        var shown = 0
        for (i in 0 until max) {
            val row = rid("row$i"); val r = rows.optJSONObject(i)
            if (r == null) { v.setViewVisibility(row, View.GONE); continue }
            shown++
            v.setViewVisibility(row, View.VISIBLE)
            val done = r.optBoolean("done")
            v.setTextViewText(rid("box$i"), if (done) "☑" else "☐")
            v.setTextViewText(rid("text$i"), r.optString("text").take(80))
            v.setTextViewText(rid("sub$i"), r.optString("sub").take(20))
            if (!done) {
                val t = Intent(ctx, WidgetTick::class.java).putExtra("which", which).putExtra("kind", r.optString("kind")).putExtra("id", r.optString("id"))
                v.setOnClickPendingIntent(rid("box$i"), PendingIntent.getBroadcast(ctx, ("tick-$which-" + r.optString("id")).hashCode(), t, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
            }
        }
        v.setViewVisibility(rid("empty"), if (shown == 0) View.VISIBLE else View.GONE)
        // the rest of the widget opens Attune (on To-dos & lists)
        val open = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra(EXTRA_OPEN_PAGE, "lists")
        v.setOnClickPendingIntent(rid("root"), PendingIntent.getActivity(ctx, ("widget-open-$which").hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        return v
    }
}
