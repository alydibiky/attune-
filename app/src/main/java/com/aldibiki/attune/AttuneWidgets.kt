package com.aldibiki.attune

import android.app.Activity
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.SpannableString
import android.text.Spanned
import android.text.style.StrikethroughSpan
import android.view.Gravity
import android.view.View
import android.webkit.WebView
import android.widget.LinearLayout
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * v10.5 — the interactive widgets (Ali, 18 Nov 2026: "widgets for most things in the app in a smart way and they must be interactive …
 * so I can do things without opening the app"; he OK'd OK-A1 OK-W1 OK-W2 OK-W3 OK-W5 OK-W6 OK-W7 OK-S, docs/mockups/widgets-combined.html).
 *
 * The page works out what every widget shows (web-src/widgets2.js) and hands it over with NativeBridge.setWidgets; this file only DRAWS
 * the cards and keeps the TAPS. A tap changes the widget at once (the row leaves, the box ticks) and is kept as an action
 * {w, a, id, at}; the page applies each action exactly once (widgets2.js applyActs) — at once when Attune is running (the page is pinged),
 * else the next time it opens. What needs typing (Tell Attune, + Add, I spent / I got) opens QuickBoxActivity: a small box over the home
 * screen that runs Attune's own reader. "Open ↗" opens the exact listing in the phone's browser; a tap on a line opens that page.
 *   list   ListWidget  (A1)  scrolls (ListView), tick / untick, ‹ › switches list (per widget), + Add, Clear ticked
 *   day    TodoWidget  (W1)  today's next 3 with Done / +1h / Paid
 *   money  MoneyWidget (W2)  safe to spend, the bank SMS waiting (Add ✓ / ✕), − I spent / + I got, 👁 hides the amounts
 *   box    BoxWidget   (W3)  Tell Attune → the small box (BoxWidget.kt)
 *   agents AgentsWidget (W5) latest finds, Open ↗ / Pause
 *   med · papers · trip · next  (W6) four small ones
 *   stack  StackWidget (W7)  the cards as swipeable pages (StackView), the first chosen by the page's code; 📌 pins one
 * The look (OK-S): each widget follows the app's Look (Plain → Attune's colours, Glass → dark glass); long-press → the widget's settings
 * → W5LookActivity changes that one widget only. Nothing leaves the phone.
 */
object W5 {
    const val PREFS = "attune_w5"
    val KINDS = listOf("list", "day", "money", "agents", "med", "papers", "trip", "next", "stack")
    @Volatile var web: WeakReference<WebView>? = null

    fun cls(kind: String): Class<*>? = when (kind) {
        "list" -> ListWidget::class.java; "day" -> TodoWidget::class.java; "money" -> MoneyWidget::class.java; "agents" -> AgentsWidget::class.java
        "med" -> MedWidget::class.java; "papers" -> PapersWidget::class.java; "trip" -> TripWidget::class.java; "next" -> NextWidget::class.java
        "stack" -> StackWidget::class.java; else -> null
    }
    private fun sp(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    fun data(ctx: Context, kind: String): JSONObject = try { JSONObject(sp(ctx).getString("d:$kind", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
    private fun put(ctx: Context, kind: String, o: JSONObject) { sp(ctx).edit().putString("d:$kind", o.toString()).apply() }
    fun words(ctx: Context): JSONObject = try { JSONObject(sp(ctx).getString("words", "{}") ?: "{}") } catch (e: Exception) { JSONObject() }
    fun word(ctx: Context, k: String, d: String): String = words(ctx).optString(k).ifBlank { d }

    /** The page's data: { list, day, money, agents, med, papers, trip, next, stack, words, look: "plain"|"glass" }. */
    fun saveAll(ctx: Context, json: String) {
        val o = JSONObject(json)
        val e = sp(ctx).edit()
        for (k in KINDS) o.optJSONObject(k)?.let { e.putString("d:$k", it.toString()) }
        o.optJSONObject("words")?.let { e.putString("words", it.toString()) }
        if (o.has("look")) e.putString("applook", o.optString("look"))
        e.apply()
        refreshAll(ctx)
    }

    fun ids(ctx: Context, kind: String): IntArray { val c = cls(kind) ?: return IntArray(0); return AppWidgetManager.getInstance(ctx).getAppWidgetIds(ComponentName(ctx, c)) }
    fun refreshAll(ctx: Context) {
        for (k in KINDS) refresh(ctx, k)
        try { val mgr = AppWidgetManager.getInstance(ctx); for (id in mgr.getAppWidgetIds(ComponentName(ctx, BoxWidget::class.java))) mgr.updateAppWidget(id, BoxWidget.views(ctx, id)) } catch (e: Exception) { }
    }
    fun refresh(ctx: Context, kind: String) {
        val mgr = AppWidgetManager.getInstance(ctx)
        for (id in ids(ctx, kind)) try {
            mgr.updateAppWidget(id, views(ctx, kind, id))
            if (kind == "list" || kind == "stack") @Suppress("DEPRECATION") mgr.notifyAppWidgetViewDataChanged(id, if (kind == "list") R.id.w5_list else R.id.w5_stack)
        } catch (e: Exception) { }
    }
    fun views(ctx: Context, kind: String, wid: Int): RemoteViews = when (kind) { "list" -> listViews(ctx, wid); "stack" -> stackViews(ctx, wid); else -> card(ctx, kind, wid) }

    /** "Put this widget on the home screen": "has" | "asked" | "no". */
    fun pin(ctx: Context, kind: String): String {
        val c = cls(kind) ?: return "no"
        val mgr = AppWidgetManager.getInstance(ctx)
        if (ids(ctx, kind).isNotEmpty()) { refresh(ctx, kind); return "has" }
        if (!mgr.isRequestPinAppWidgetSupported) return "no"
        return if (mgr.requestPinAppWidget(ComponentName(ctx, c), null, null)) "asked" else "no"
    }
    fun placed(ctx: Context): String { val o = JSONObject(); for (k in KINDS) o.put(k, ids(ctx, k).size); o.put("box", AppWidgetManager.getInstance(ctx).getAppWidgetIds(ComponentName(ctx, BoxWidget::class.java)).size); return o.toString() }

    // ---------------------------------------------------------------- the look (OK-S)
    class Palette(val ink: Int, val mut: Int, val acc: Int, val on: Int, val bg: Int, val pillP: Int, val pillO: Int)
    fun lookOf(ctx: Context, wid: Int): String {
        val own = sp(ctx).getString("look:$wid", "auto") ?: "auto"
        if (own == "s1" || own == "s2") return own
        return if (sp(ctx).getString("applook", "plain") == "glass") "s2" else "s1"
    }
    fun setLook(ctx: Context, wid: Int, look: String) { sp(ctx).edit().putString("look:$wid", look).apply(); refreshAll(ctx) }
    fun pal(ctx: Context, look: String): Palette =
        if (look == "s2") Palette(0xFFF2F3F7.toInt(), 0xFFB7BCCB.toInt(), 0xFFF0A8C0.toInt(), 0xFF2A1219.toInt(), R.drawable.w5_bg_s2, R.drawable.w5_pill_p2, R.drawable.w5_pill_o2)
        else Palette(ctx.getColor(R.color.w5_s1_ink), ctx.getColor(R.color.w5_s1_mut), ctx.getColor(R.color.w5_s1_acc), ctx.getColor(R.color.w5_s1_on), R.drawable.w5_bg_s1, R.drawable.w5_pill_p1, R.drawable.w5_pill_o1)
    private fun pill(v: RemoteViews, id: Int, p: Palette, primary: Boolean) {
        v.setInt(id, "setBackgroundResource", if (primary) p.pillP else p.pillO)
        v.setTextColor(id, if (primary) p.on else p.acc)
    }

    // ---------------------------------------------------------------- the taps
    /** One request code per button (the same button keeps the same PendingIntent — none pile up when a widget is drawn again). */
    private fun code(vararg s: Any?): Int = s.joinToString("|").hashCode()
    fun act(ctx: Context, w: String, a: String, id: String, wid: Int = 0, text: String = ""): PendingIntent {
        val i = Intent(ctx, W5Act::class.java).setAction("attune.w5.$w.$a").putExtra("w", w).putExtra("a", a).putExtra("id", id).putExtra("wid", wid).putExtra("text", text)
        return PendingIntent.getBroadcast(ctx, code(w, a, id, wid), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    fun openApp(ctx: Context, mode: String, text: String = ""): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra(EXTRA_OPEN_PAGE, mode.ifBlank { "home" })
        if (text.isNotBlank()) i.putExtra(WakeService.EXTRA_VOICE_TEXT, text)
        return PendingIntent.getActivity(ctx, code("open", mode, text), i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    fun openUrl(ctx: Context, url: String): PendingIntent =
        PendingIntent.getActivity(ctx, code("url", url), Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    fun quick(ctx: Context, mode: String, list: String = ""): PendingIntent =
        PendingIntent.getActivity(ctx, code("quick", mode, list), Intent(ctx, QuickBoxActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK).putExtra("mode", mode).putExtra("list", list),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    /** The PendingIntent behind one button of a row / of the card. */
    fun forButton(ctx: Context, kind: String, a: String, rowId: String, open: String, wid: Int, text: String = ""): PendingIntent = when {
        a.startsWith("url:") -> openUrl(ctx, a.removePrefix("url:"))
        a == "open" || a == "close" -> openApp(ctx, open)
        a == "spend" || a == "got" -> quick(ctx, a)
        else -> act(ctx, kind, a, rowId, wid, text)
    }

    /** Kept for the page: [{ w, a, id, at, text }] (at most 300). */
    @Synchronized fun record(ctx: Context, w: String, a: String, id: String, text: String = "") {
        val arr = try { JSONArray(sp(ctx).getString("acts", "[]")) } catch (e: Exception) { JSONArray() }
        val out = JSONArray(); val start = maxOf(0, arr.length() - 299); for (i in start until arr.length()) out.put(arr.get(i))
        out.put(JSONObject().put("w", w).put("a", a).put("id", id).put("at", System.currentTimeMillis()).put("text", text.take(120)))
        sp(ctx).edit().putString("acts", out.toString()).apply()
    }
    fun acts(ctx: Context): String = sp(ctx).getString("acts", "[]") ?: "[]"
    /** Forget the actions the page applied (their keys "w|a|id|at"). */
    @Synchronized fun clearActs(ctx: Context, keysJson: String) {
        val keys = HashSet<String>(); try { val k = JSONArray(keysJson); for (i in 0 until k.length()) keys.add(k.optString(i)) } catch (e: Exception) { }
        val arr = try { JSONArray(sp(ctx).getString("acts", "[]")) } catch (e: Exception) { JSONArray() }
        val out = JSONArray()
        for (i in 0 until arr.length()) { val o = arr.optJSONObject(i) ?: continue; if (!keys.contains(listOf(o.optString("w"), o.optString("a"), o.optString("id"), o.optLong("at")).joinToString("|"))) out.put(o) }
        sp(ctx).edit().putString("acts", out.toString()).apply()
    }

    /** A tap: the widget changes now, the action is kept, the running page is told. */
    fun handle(ctx: Context, w: String, a: String, id: String, wid: Int, text: String) {
        val p = sp(ctx)
        when {
            a == "prev" || a == "next" -> {   // the list widget: another list (this widget only)
                val lists = data(ctx, "list").optJSONArray("lists") ?: JSONArray(); if (lists.length() == 0) return
                val cur = p.getString("list:$wid", "") ?: ""
                var i = (0 until lists.length()).firstOrNull { lists.optJSONObject(it)?.optString("id") == cur } ?: 0
                i = (i + (if (a == "next") 1 else -1) + lists.length()) % lists.length()
                p.edit().putString("list:$wid", lists.optJSONObject(i)?.optString("id") ?: "").apply()
                refresh(ctx, "list"); return
            }
            a == "eye" -> { p.edit().putBoolean("hide:money", !p.getBoolean("hide:money", false)).apply(); refresh(ctx, "money"); refresh(ctx, "stack"); return }
            a == "pin" -> { p.edit().putString("pin:$wid", if (p.getString("pin:$wid", "") == id) "" else id).apply(); refresh(ctx, "stack"); return }
            w == "list" || id.startsWith("list:") -> listChange(ctx, a, id)
            else -> dropRow(ctx, id)
        }
        record(ctx, if (id.startsWith("list:")) "list" else w, a, id, text)
        refreshAll(ctx)
        ping()
    }
    private fun ping() { try { web?.get()?.let { v -> v.post { try { v.evaluateJavascript("try{window.dispatchEvent(new Event('attune-widget-acts'))}catch(e){}", null) } catch (e: Exception) { } } } } catch (e: Exception) { } }

    /** A row someone acted on leaves its card (and the stack's pages) now. */
    private fun dropRow(ctx: Context, rowId: String) {
        for (k in KINDS) {
            val d = data(ctx, k)
            if (k == "stack") {
                val pages = d.optJSONArray("pages") ?: continue
                for (i in 0 until pages.length()) pages.optJSONObject(i)?.let { pg -> pg.put("rows", without(pg.optJSONArray("rows"), rowId)) }
                put(ctx, k, d.put("pages", pages))
            } else if (d.has("rows")) put(ctx, k, d.put("rows", without(d.optJSONArray("rows"), rowId)))
        }
    }
    private fun without(rows: JSONArray?, rowId: String): JSONArray { val out = JSONArray(); if (rows != null) for (i in 0 until rows.length()) { val r = rows.optJSONObject(i) ?: continue; if (r.optString("id") != rowId) out.put(r) }; return out }
    /** "list:<list>:<item>" ticked / unticked (what is left first, the ticked ones under it); "list:<list>" cleared of its ticked ones. */
    private fun listChange(ctx: Context, a: String, id: String) {
        val parts = id.split(":"); val lid = parts.getOrNull(1) ?: return; val iid = parts.getOrNull(2) ?: ""
        val d = data(ctx, "list"); val lists = d.optJSONArray("lists") ?: return
        for (i in 0 until lists.length()) {
            val l = lists.optJSONObject(i) ?: continue; if (l.optString("id") != lid) continue
            val items = l.optJSONArray("items") ?: JSONArray(); val left = JSONArray(); val done = JSONArray()
            for (j in 0 until items.length()) {
                val it = items.optJSONObject(j) ?: continue
                if (it.optString("id") == iid && (a == "tick" || a == "untick")) it.put("done", a == "tick")
                if (a == "clear" && it.optBoolean("done")) continue
                if (it.optBoolean("done")) done.put(it) else left.put(it)
            }
            val all = JSONArray(); for (j in 0 until left.length()) all.put(left.get(j)); for (j in 0 until done.length()) all.put(done.get(j))
            l.put("items", all).put("left", left.length()).put("side", if (left.length() > 0) word(ctx, "left", "{n} left").replace("{n}", left.length().toString()) else if (all.length() > 0) word(ctx, "alldone", "All done ✓") else "")
        }
        put(ctx, "list", d.put("lists", lists))
        // the stack's list page: that item leaves it
        if (a == "tick") dropRow(ctx, id)
    }

    // ---------------------------------------------------------------- drawing a card (W1, W2, W5, W6)
    private fun card(ctx: Context, kind: String, wid: Int): RemoteViews {
        val d = data(ctx, kind); val p = pal(ctx, lookOf(ctx, wid))
        val v = RemoteViews(ctx.packageName, R.layout.w5_card)
        v.setInt(R.id.w5_root, "setBackgroundResource", p.bg)
        v.setTextViewText(R.id.w5_icon, d.optString("icon", "✦")); v.setTextColor(R.id.w5_icon, p.acc)
        v.setTextViewText(R.id.w5_title, d.optString("title").ifBlank { word(ctx, "open", "Open Attune once") }); v.setTextColor(R.id.w5_title, p.ink)
        v.setTextViewText(R.id.w5_side, d.optString("side")); v.setTextColor(R.id.w5_side, p.acc)
        val hide = kind == "money" && sp(ctx).getBoolean("hide:money", false)
        if (d.optBoolean("hideable")) { v.setViewVisibility(R.id.w5_eye, View.VISIBLE); v.setTextColor(R.id.w5_eye, p.mut); v.setOnClickPendingIntent(R.id.w5_eye, act(ctx, kind, "eye", "eye", wid)) }
        fun txt(id: Int, s: String, color: Int) { v.setViewVisibility(id, if (s.isBlank()) View.GONE else View.VISIBLE); v.setTextViewText(id, s); v.setTextColor(id, color) }
        txt(R.id.w5_biglabel, d.optString("bigLabel"), p.mut)
        txt(R.id.w5_big, if (hide && d.optString("big").isNotBlank()) "••• " + d.optString("big").substringAfterLast(' ', "") else d.optString("big"), p.ink)
        txt(R.id.w5_line, d.optString("line"), p.ink)
        val rows = d.optJSONArray("rows") ?: JSONArray()
        v.removeAllViews(R.id.w5_rows)
        val max = if (kind in listOf("med", "papers", "trip", "next")) 1 else 3
        for (i in 0 until minOf(max, rows.length())) {
            val r = rows.optJSONObject(i) ?: continue
            val rv = RemoteViews(ctx.packageName, R.layout.w5_row)
            rv.setTextViewText(R.id.w5r_text, if (hide) r.optString("text").replace(Regex("[0-9][0-9,.]*"), "•••") else r.optString("text")); rv.setTextColor(R.id.w5r_text, p.ink)
            rv.setTextViewText(R.id.w5r_sub, r.optString("sub")); rv.setTextColor(R.id.w5r_sub, if (r.optString("sub").startsWith("−")) p.acc else p.mut)
            val open = r.optString("open", d.optString("open"))
            rv.setOnClickPendingIntent(R.id.w5r_text, openApp(ctx, open))
            val btns = r.optJSONArray("btns") ?: JSONArray()
            val slots = intArrayOf(R.id.w5r_b0, R.id.w5r_b1)
            for (k in 0 until 2) {
                val b = btns.optJSONArray(k)
                if (b == null) { rv.setViewVisibility(slots[k], View.GONE); continue }
                rv.setViewVisibility(slots[k], View.VISIBLE); rv.setTextViewText(slots[k], b.optString(1)); pill(rv, slots[k], p, b.optInt(2) == 1)
                rv.setOnClickPendingIntent(slots[k], forButton(ctx, kind, b.optString(0), r.optString("id"), open, wid, r.optString("text")))
            }
            v.addView(R.id.w5_rows, rv)
        }
        txt(R.id.w5_empty, if (rows.length() == 0 && d.optString("line").isBlank()) d.optString("empty") else "", p.mut)
        v.removeAllViews(R.id.w5_btns)
        val fb = d.optJSONArray("btns") ?: JSONArray()
        for (k in 0 until minOf(3, fb.length())) {
            val b = fb.optJSONArray(k) ?: continue
            val bv = RemoteViews(ctx.packageName, R.layout.w5_btn)
            bv.setTextViewText(R.id.w5b, b.optString(1)); pill(bv, R.id.w5b, p, b.optInt(2) == 1)
            bv.setOnClickPendingIntent(R.id.w5b, forButton(ctx, kind, b.optString(0), "", d.optString("open"), wid))
            v.addView(R.id.w5_btns, bv)
        }
        v.setOnClickPendingIntent(R.id.w5_root, openApp(ctx, d.optString("open", "home")))
        return v
    }

    // ---------------------------------------------------------------- A1 the list
    /** The list this widget shows (its own choice, else the first one). */
    fun listFor(ctx: Context, wid: Int): JSONObject? {
        val lists = data(ctx, "list").optJSONArray("lists") ?: return null
        val want = sp(ctx).getString("list:$wid", "") ?: ""
        for (i in 0 until lists.length()) if (lists.optJSONObject(i)?.optString("id") == want) return lists.optJSONObject(i)
        return lists.optJSONObject(0)
    }
    private fun listViews(ctx: Context, wid: Int): RemoteViews {
        val p = pal(ctx, lookOf(ctx, wid)); val l = listFor(ctx, wid)
        val v = RemoteViews(ctx.packageName, R.layout.w5_list)
        v.setInt(R.id.w5_root, "setBackgroundResource", p.bg)
        v.setTextViewText(R.id.w5_title, l?.optString("title") ?: word(ctx, "lists", "Lists")); v.setTextColor(R.id.w5_title, p.ink)
        v.setTextViewText(R.id.w5_side, l?.optString("side") ?: ""); v.setTextColor(R.id.w5_side, p.acc)
        val many = (data(ctx, "list").optJSONArray("lists")?.length() ?: 0) > 1
        for (id in intArrayOf(R.id.w5_prev, R.id.w5_next)) { v.setViewVisibility(id, if (many) View.VISIBLE else View.GONE); v.setTextColor(id, p.acc) }
        v.setOnClickPendingIntent(R.id.w5_prev, act(ctx, "list", "prev", "nav", wid)); v.setOnClickPendingIntent(R.id.w5_next, act(ctx, "list", "next", "nav", wid))
        v.setOnClickPendingIntent(R.id.w5_title, openApp(ctx, "lists"))
        val svc = Intent(ctx, W5ListService::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid).putExtra("v", lookOf(ctx, wid))
        svc.data = Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME))
        @Suppress("DEPRECATION") v.setRemoteAdapter(R.id.w5_list, svc)
        v.setEmptyView(R.id.w5_list, R.id.w5_empty)
        v.setTextViewText(R.id.w5_empty, if (l == null) word(ctx, "nolists", "Make a list in Attune — it shows here") else word(ctx, "emptylist", "Nothing on this list — + Add")); v.setTextColor(R.id.w5_empty, p.mut)
        val tpl = Intent(ctx, W5Act::class.java).setAction("attune.w5.list.tap").putExtra("w", "list").putExtra("wid", wid)
        v.setPendingIntentTemplate(R.id.w5_list, PendingIntent.getBroadcast(ctx, code("listtpl", wid), tpl, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE))
        v.removeAllViews(R.id.w5_btns)
        if (l != null) {
            val add = RemoteViews(ctx.packageName, R.layout.w5_btn); add.setTextViewText(R.id.w5b, word(ctx, "add", "+ Add")); pill(add, R.id.w5b, p, true)
            add.setOnClickPendingIntent(R.id.w5b, quick(ctx, "list", l.optString("id"))); v.addView(R.id.w5_btns, add)
            val ticked = (l.optJSONArray("items")?.let { a -> (0 until a.length()).count { a.optJSONObject(it)?.optBoolean("done") == true } }) ?: 0
            if (ticked > 0) { val c = RemoteViews(ctx.packageName, R.layout.w5_btn); c.setTextViewText(R.id.w5b, word(ctx, "clear", "Clear {n} ticked").replace("{n}", ticked.toString())); pill(c, R.id.w5b, p, false)
                c.setOnClickPendingIntent(R.id.w5b, act(ctx, "list", "clear", "list:" + l.optString("id"), wid)); v.addView(R.id.w5_btns, c) }
        }
        return v
    }

    // ---------------------------------------------------------------- W7 the stack
    /** The stack's pages, the pinned one first. */
    fun pages(ctx: Context, wid: Int): List<JSONObject> {
        val arr = data(ctx, "stack").optJSONArray("pages") ?: JSONArray()
        val all = (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }
        val pin = sp(ctx).getString("pin:$wid", "") ?: ""
        return if (pin.isBlank()) all else all.sortedBy { if (it.optString("kind") == pin) 0 else 1 }
    }
    private fun stackViews(ctx: Context, wid: Int): RemoteViews {
        val p = pal(ctx, lookOf(ctx, wid))
        val v = RemoteViews(ctx.packageName, R.layout.w5_stack)
        val svc = Intent(ctx, W5StackService::class.java).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid).putExtra("v", lookOf(ctx, wid) + sp(ctx).getString("pin:$wid", ""))
        svc.data = Uri.parse(svc.toUri(Intent.URI_INTENT_SCHEME))
        @Suppress("DEPRECATION") v.setRemoteAdapter(R.id.w5_stack, svc)
        v.setEmptyView(R.id.w5_stack, R.id.w5_empty)
        v.setInt(R.id.w5_empty, "setBackgroundResource", p.bg); v.setTextColor(R.id.w5_empty, p.mut); v.setTextViewText(R.id.w5_empty, word(ctx, "open", "Open Attune once — then this fills itself"))
        // the pages' taps go through a tiny see-through activity: a page can open the app, a listing or the small box
        val tpl = Intent(ctx, W5Tap::class.java).putExtra("wid", wid)
        v.setPendingIntentTemplate(R.id.w5_stack, PendingIntent.getActivity(ctx, code("stacktpl", wid), tpl, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE))
        return v
    }
    fun pageView(ctx: Context, pg: JSONObject, i: Int, n: Int, wid: Int): RemoteViews {
        val p = pal(ctx, lookOf(ctx, wid)); val v = RemoteViews(ctx.packageName, R.layout.w5_page)
        val kind = pg.optString("kind"); val hide = kind == "money" && sp(ctx).getBoolean("hide:money", false)
        v.setInt(R.id.w5p_root, "setBackgroundResource", p.bg)
        v.setTextViewText(R.id.w5p_icon, pg.optString("icon", "✦")); v.setTextColor(R.id.w5p_icon, p.acc)
        v.setTextViewText(R.id.w5p_title, pg.optString("title")); v.setTextColor(R.id.w5p_title, p.ink)
        v.setTextViewText(R.id.w5p_count, "${i + 1}/$n"); v.setTextColor(R.id.w5p_count, p.mut)
        val pinned = sp(ctx).getString("pin:$wid", "") == kind
        v.setTextColor(R.id.w5p_pin, if (pinned) p.acc else p.mut); v.setTextViewText(R.id.w5p_pin, if (pinned) "📌" else "📍")
        v.setOnClickFillInIntent(R.id.w5p_pin, Intent().putExtra("w", "stack").putExtra("a", "pin").putExtra("id", kind))
        fun txt(id: Int, s: String, color: Int) { v.setViewVisibility(id, if (s.isBlank()) View.GONE else View.VISIBLE); v.setTextViewText(id, s); v.setTextColor(id, color) }
        txt(R.id.w5p_reason, pg.optString("reason"), p.acc)
        txt(R.id.w5p_big, if (hide && pg.optString("big").isNotBlank()) "•••" else pg.optString("big"), p.ink)
        txt(R.id.w5p_line, pg.optString("line").ifBlank { pg.optString("bigLabel") }, p.mut)
        val rows = pg.optJSONArray("rows") ?: JSONArray()
        val R0 = intArrayOf(R.id.w5p_r0, R.id.w5p_r1, R.id.w5p_r2); val T = intArrayOf(R.id.w5p_t0, R.id.w5p_t1, R.id.w5p_t2); val S = intArrayOf(R.id.w5p_s0, R.id.w5p_s1, R.id.w5p_s2)
        val A = intArrayOf(R.id.w5p_a0, R.id.w5p_a1, R.id.w5p_a2); val B = intArrayOf(R.id.w5p_b0, R.id.w5p_b1, R.id.w5p_b2)
        val open = pg.optString("open", "home")
        for (k in 0 until 3) {
            val r = rows.optJSONObject(k)
            if (r == null) { v.setViewVisibility(R0[k], View.GONE); continue }
            v.setViewVisibility(R0[k], View.VISIBLE)
            v.setTextViewText(T[k], if (hide) r.optString("text").replace(Regex("[0-9][0-9,.]*"), "•••") else r.optString("text")); v.setTextColor(T[k], p.ink)
            v.setTextViewText(S[k], r.optString("sub")); v.setTextColor(S[k], p.mut)
            v.setOnClickFillInIntent(T[k], Intent().putExtra("w", kind).putExtra("a", "open").putExtra("open", r.optString("open", open)))
            val btns = r.optJSONArray("btns") ?: JSONArray()
            val slots = intArrayOf(A[k], B[k])
            for (j in 0 until 2) {
                val b = btns.optJSONArray(j)
                if (b == null) { v.setViewVisibility(slots[j], View.GONE); continue }
                v.setViewVisibility(slots[j], View.VISIBLE); v.setTextViewText(slots[j], b.optString(1)); pill(v, slots[j], p, b.optInt(2) == 1)
                v.setOnClickFillInIntent(slots[j], Intent().putExtra("w", kind).putExtra("a", b.optString(0)).putExtra("id", r.optString("id")).putExtra("open", r.optString("open", open)).putExtra("text", r.optString("text")))
            }
        }
        val fb = pg.optJSONArray("btns") ?: JSONArray(); val F = intArrayOf(R.id.w5p_f0, R.id.w5p_f1)
        for (j in 0 until 2) {
            val b = fb.optJSONArray(j)
            if (b == null) { v.setViewVisibility(F[j], View.GONE); continue }
            v.setViewVisibility(F[j], View.VISIBLE); v.setTextViewText(F[j], b.optString(1)); pill(v, F[j], p, b.optInt(2) == 1)
            v.setOnClickFillInIntent(F[j], Intent().putExtra("w", kind).putExtra("a", b.optString(0)).putExtra("id", "").putExtra("open", open))
        }
        v.setOnClickFillInIntent(R.id.w5p_title, Intent().putExtra("w", kind).putExtra("a", "open").putExtra("open", open))
        return v
    }

    /** A collection tap (the stack's pages): what to start, or null when the tap is kept as an action. */
    fun tapTarget(ctx: Context, a: String, open: String, list: String = ""): Intent? = when {
        a.startsWith("url:") -> Intent(Intent.ACTION_VIEW, Uri.parse(a.removePrefix("url:")))
        a == "open" || a == "close" -> Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra(EXTRA_OPEN_PAGE, open.ifBlank { "home" })
        a == "spend" || a == "got" -> Intent(ctx, QuickBoxActivity::class.java).putExtra("mode", a).putExtra("list", list)
        else -> null
    }
}

/** The taps on the cards and on the list's rows. */
class W5Act : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        try { W5.handle(ctx, intent.getStringExtra("w") ?: "", intent.getStringExtra("a") ?: return, intent.getStringExtra("id") ?: "", intent.getIntExtra("wid", 0), intent.getStringExtra("text") ?: "") } catch (e: Exception) { }
    }
}

/** The stack's page taps: kept as an action (the page changes), or the app / a listing / the small box opened. Shows nothing itself. */
class W5Tap : Activity() {
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        try {
            val a = intent.getStringExtra("a") ?: ""; val w = intent.getStringExtra("w") ?: "stack"
            val target = W5.tapTarget(this, a, intent.getStringExtra("open") ?: "")
            if (target != null) startActivity(target.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            else if (a.isNotBlank()) W5.handle(this, w, a, intent.getStringExtra("id") ?: "", intent.getIntExtra("wid", 0), intent.getStringExtra("text") ?: "")
        } catch (e: Exception) { }
        finish()
    }
}

class W5ListService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = ListRows(applicationContext, intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0))
}
class ListRows(private val ctx: Context, private val wid: Int) : RemoteViewsService.RemoteViewsFactory {
    private var items = JSONArray(); private var lid = ""
    override fun onCreate() { }
    override fun onDataSetChanged() { val l = W5.listFor(ctx, wid); items = l?.optJSONArray("items") ?: JSONArray(); lid = l?.optString("id") ?: "" }
    override fun onDestroy() { }
    override fun getCount(): Int = items.length()
    override fun getViewAt(i: Int): RemoteViews {
        val p = W5.pal(ctx, W5.lookOf(ctx, wid)); val it = items.optJSONObject(i) ?: JSONObject(); val done = it.optBoolean("done")
        val v = RemoteViews(ctx.packageName, R.layout.w5_listrow)
        v.setTextViewText(R.id.w5l_box, if (done) "☑" else "☐"); v.setTextColor(R.id.w5l_box, if (done) p.acc else p.mut)
        val s = SpannableString(it.optString("text")); if (done) s.setSpan(StrikethroughSpan(), 0, s.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        v.setTextViewText(R.id.w5l_text, s); v.setTextColor(R.id.w5l_text, if (done) p.mut else p.ink)
        v.setOnClickFillInIntent(R.id.w5l_root, Intent().putExtra("a", if (done) "untick" else "tick").putExtra("id", "list:$lid:" + it.optString("id")).putExtra("text", it.optString("text")))
        return v
    }
    override fun getLoadingView(): RemoteViews? = null
    override fun getViewTypeCount(): Int = 1
    override fun getItemId(i: Int): Long = (lid + ":" + (items.optJSONObject(i)?.optString("id") ?: i.toString())).hashCode().toLong()
    override fun hasStableIds(): Boolean = true
}

class W5StackService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory = StackPages(applicationContext, intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0))
}
class StackPages(private val ctx: Context, private val wid: Int) : RemoteViewsService.RemoteViewsFactory {
    private var pages: List<JSONObject> = emptyList()
    override fun onCreate() { }
    override fun onDataSetChanged() { pages = W5.pages(ctx, wid) }
    override fun onDestroy() { }
    override fun getCount(): Int = pages.size
    override fun getViewAt(i: Int): RemoteViews = W5.pageView(ctx, pages.getOrNull(i) ?: JSONObject(), i, pages.size, wid)
    override fun getLoadingView(): RemoteViews? = null
    override fun getViewTypeCount(): Int = 1
    override fun getItemId(i: Int): Long = (pages.getOrNull(i)?.optString("kind") ?: i.toString()).hashCode().toLong()
    override fun hasStableIds(): Boolean = true
}

/** OK-S: long-press a widget → its settings → this widget's look (follow the app's Look · Attune's colours · dark glass). */
class W5LookActivity : Activity() {
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val wid = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        setResult(RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, wid))   // the widget stays, whatever is picked
        val night = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val ink = if (night) Color.parseColor("#F3ECEE") else Color.parseColor("#231C1E")
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(48, 40, 48, 32); setBackgroundColor(if (night) Color.parseColor("#221C1E") else Color.WHITE) }
        col.addView(TextView(this).apply { text = W5.word(this@W5LookActivity, "looktitle", "The widget's look"); textSize = 18f; setTypeface(typeface, android.graphics.Typeface.BOLD); setTextColor(ink); setPadding(0, 0, 0, 24) })
        val cur = getSharedPreferences(W5.PREFS, MODE_PRIVATE).getString("look:$wid", "auto") ?: "auto"
        for ((k, d) in listOf("auto" to "Follow Attune's Look", "s1" to "Attune's colours", "s2" to "Dark glass")) {
            col.addView(TextView(this).apply {
                text = (if (cur == k) "● " else "○ ") + W5.word(this@W5LookActivity, "look_$k", d); textSize = 16f; setTextColor(ink); setPadding(0, 28, 0, 28); gravity = Gravity.CENTER_VERTICAL
                setOnClickListener { W5.setLook(this@W5LookActivity, wid, k); finish() }
            })
        }
        setContentView(col)
    }
}

/** The widgets themselves (one class each, so each can be placed on its own). TodoWidget and ListWidget keep their old names so the
 *  widgets people already placed become Your day and the new list (TodoWidget.kt keeps the old bridge calls working). */
open class W5Provider(private val kind: String) : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) { for (id in ids) try { mgr.updateAppWidget(id, W5.views(ctx, kind, id)) } catch (e: Exception) { } }
    override fun onAppWidgetOptionsChanged(ctx: Context, mgr: AppWidgetManager, id: Int, o: Bundle?) { try { mgr.updateAppWidget(id, W5.views(ctx, kind, id)) } catch (e: Exception) { } }
}
class MoneyWidget : W5Provider("money")
class AgentsWidget : W5Provider("agents")
class MedWidget : W5Provider("med")
class PapersWidget : W5Provider("papers")
class TripWidget : W5Provider("trip")
class NextWidget : W5Provider("next")
class StackWidget : W5Provider("stack")
