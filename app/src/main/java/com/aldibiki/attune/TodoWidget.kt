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
// v10.5: the two v9.3 widgets are drawn by the new engine (AttuneWidgets.kt) — the To-dos widget is now "Your day" (W1), the list
// widget the new scrolling list (A1). Same class names, so the widgets people already placed update by themselves.
class TodoWidget : W5Provider("day")
class ListWidget : W5Provider("list")
/** The v9.3 tick receiver: ticks made on an old widget before the update still reach the page (Widgets.ticks). */
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
    }

    private fun refresh(ctx: Context, which: String) { W5.refresh(ctx, if (which == TODO) "day" else "list") }

    /** Put this widget on the home screen if it isn't there: "has" | "asked" | "no". */
    fun pin(ctx: Context, which: String): String = W5.pin(ctx, if (which == TODO) "day" else "list")

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
}
