package com.aldibiki.attune

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.io.ByteArrayInputStream

/**
 * v6.27 "Do it for me", level 2 — a booking / shop / delivery website opened inside Attune, with three buttons:
 *   Best offer       marks the best result by the person's rules (the person taps it),
 *   Fill my details  fills name / email / phone / birth date / passport into the fields that clearly ask for them,
 *   Done             closes and tells the page what happened.
 * The work is done by www/agent-kit.js, injected after each page load (tested on fake pages: tests/e2e_v727agentkit.py).
 * Safety: this WebView has NO access to Attune's bridge or files — only a one-way "report" of counts for the status line;
 * card / CVV / password fields are never filled; when a payment form appears it says "Payment — your turn"; the Offline
 * lock closes it; every request is in the network log.
 */
class AgentBrowser : Activity() {
    companion object {
        /** The page's pending agentOpen call — answered once, when this screen closes. */
        @Volatile var onDone: ((JSONObject) -> Unit)? = null
    }

    private lateinit var web: WebView
    private lateinit var status: TextView
    private lateinit var progress: android.widget.ProgressBar
    private var kit = ""
    private var profile = "{}"
    private var rules = "{}"
    private var labels = JSONObject()
    private val result = JSONObject().put("filled", 0).put("offers", 0).put("payment", false)
    private var closed = false
    private var watchMode = false
    private var autoClose = false
    private var autoArmed = false
    private var buyMode = false        // v8.6: the person said "Order it" — press Buy now once, then fill their details on each page
    private var buyArmed = false
    // v8.7 (Ali: "it keeps glitching when I press Check now"): a hotel window's start days are checked one after another in
    // THIS window (it used to open and close a window per day) — rounds = [{url, checkin, checkout}]
    private var rounds = org.json.JSONArray()
    private var round = 0
    private var roundArmed = -1
    // v9.1 (Ali, 3 Nov: "it keeps loading me to different dates and doesn't get the lowest price in the time span"): each day is
    // read until its prices have drawn (not a fixed 8 s), the days next to the cheapest are checked too, and at the end the window
    // stays on the cheapest day with its best offer marked — the person taps it
    private var roundStart = 0L
    private var pageRound = -1         // the day whose page is on screen now (the old day's page stays visible for a moment)
    private var roundRead: JSONObject? = null
    private var stableHits = 0
    private var committed = -1
    private var sweep = 0              // how many of the rounds are the first, evenly spread sweep
    private var refined = false
    private var finalMode = false
    private var finalMarked = false

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
    private fun L(key: String, def: String) = labels.optString(key, def).ifBlank { def }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        // Android 16 (target 36) no longer calls onBackPressed: Back comes through the back-invoked dispatcher (Android 13+)
        if (android.os.Build.VERSION.SDK_INT >= 33)
            onBackInvokedDispatcher.registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT) { goBackOrClose() }
        val url = intent.getStringExtra("url") ?: ""
        profile = intent.getStringExtra("profile") ?: "{}"
        rules = intent.getStringExtra("rules") ?: "{}"
        watchMode = intent.getBooleanExtra("watch", false)
        autoClose = intent.getBooleanExtra("autoClose", false)
        buyMode = intent.getBooleanExtra("buy", false)
        rounds = try { org.json.JSONArray(intent.getStringExtra("rounds") ?: "") } catch (e: Exception) { org.json.JSONArray() }
        labels = try { JSONObject(intent.getStringExtra("labels") ?: "{}") } catch (e: Exception) { JSONObject() }
        if (Prefs.airGapNow || !url.startsWith("https://")) { finishWith("blocked"); return }
        kit = try { assets.open("www/agent-kit.js").bufferedReader(Charsets.UTF_8).use { it.readText() } } catch (e: Exception) { "" }

        val bg = Color.parseColor("#111416"); val ink = Color.parseColor("#E7EAEA"); val mut = Color.parseColor("#9AA3A5"); val acc = Color.parseColor("#4FC2AF")
        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setBackgroundColor(bg) }

        val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(14), dp(10), dp(10), dp(10)) }
        val title = TextView(this).apply { text = intent.getStringExtra("title") ?: "Attune"; setTextColor(ink); textSize = 15f; maxLines = 1 }
        top.addView(title, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        val close = TextView(this).apply { text = "✕"; setTextColor(mut); textSize = 18f; setPadding(dp(12), dp(4), dp(8), dp(4)); setOnClickListener { finishWith("closed") } }
        top.addView(close)
        root.addView(top)

        // v8.7 (Ali: "Check now glitches", a hotels page stayed white): a loading line, so a slow site never looks broken
        progress = android.widget.ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; progress = 5; isIndeterminate = false }
        root.addView(progress, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(3)))
        web = WebView(this)
        root.addView(web, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

        status = TextView(this).apply { setTextColor(mut); textSize = 12.5f; setPadding(dp(14), dp(8), dp(14), dp(2)); text = L("hint", "Attune marks the best offer and fills your details. You choose and pay.") }
        root.addView(status)
        sweep = rounds.length()
        rounds.optJSONObject(0)?.let { if (rounds.length() > 1) status.text = L("checking", "Checking {i} of {n}: {d}").replace("{i}", "1").replace("{n}", rounds.length().toString()).replace("{d}", dayLine(it)) }

        val bar = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(dp(10), dp(6), dp(10), dp(12)) }
        fun btn(label: String, primary: Boolean, onTap: () -> Unit) = TextView(this).apply {
            text = label; textSize = 14f; gravity = Gravity.CENTER; setPadding(dp(8), dp(11), dp(8), dp(11))
            setTextColor(if (primary) Color.parseColor("#0B1A17") else ink)
            background = GradientDrawable().apply { cornerRadius = dp(10).toFloat(); setColor(if (primary) acc else Color.parseColor("#1F2528")) }
            setOnClickListener { onTap() }
        }
        val lp = { LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { setMargins(dp(4), 0, dp(4), 0) } }
        if (intent.getBooleanExtra("search", true)) bar.addView(btn(L("best", "Best offer"), false) { run("window.__attuneAgent&&window.__attuneAgent.best($rules)") }, lp())
        bar.addView(btn(L("fill", "Fill my details"), false) {
            if (profile == "{}" || profile.isBlank()) status.text = L("noProfile", "Add your details first: Profile → Booking details.")
            else run("window.__attuneAgent&&window.__attuneAgent.fill($profile)")
        }, lp())
        bar.addView(btn(L("done", "Done"), true) { finishWith("done") }, lp())
        root.addView(bar)
        setContentView(root)
        // v8.7: the title sat under the phone's status bar (Android 15+ draws apps edge to edge) — keep clear of the system bars
        if (android.os.Build.VERSION.SDK_INT >= 30) root.setOnApplyWindowInsetsListener { v, ins ->
            val b = ins.getInsets(android.view.WindowInsets.Type.systemBars() or android.view.WindowInsets.Type.ime()); v.setPadding(0, b.top, 0, b.bottom); ins }

        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.setSupportMultipleWindows(false)
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false
        // v8.7: sites like Booking.com send an in-app browser a blank page or a jump to their own app — present as the phone's
        // normal browser (Chrome on Android), so the real mobile site loads
        try { web.settings.userAgentString = android.webkit.WebSettings.getDefaultUserAgent(this).replace("; wv", "").replace(Regex("Version/\\d+(\\.\\d+)* "), "") } catch (e: Exception) { }
        web.webChromeClient = object : android.webkit.WebChromeClient() {
            override fun onProgressChanged(v: WebView, p: Int) { progress.progress = p; progress.visibility = if (p >= 100) android.view.View.INVISIBLE else android.view.View.VISIBLE }
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)   // the person's own sign-in on that site
        web.addJavascriptInterface(Host(), "AttuneAgentHost")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView, req: WebResourceRequest): WebResourceResponse? {
                if (Prefs.airGapNow) {
                    NetLog.add(req.url.toString(), "agent page", blocked = true)
                    return WebResourceResponse("text/plain", "utf-8", 403, "Offline lock", emptyMap(), ByteArrayInputStream(ByteArray(0)))
                }
                NetLog.add(req.url.toString(), "agent page")
                return null
            }
            override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {
                val u = req.url
                if (u.scheme == "https" || u.scheme == "http") return false
                // v8.7: a site that tries to jump to its own app (intent://…) stays here, on its web page (browser_fallback_url) —
                // the white page Ali saw on the hotels check
                if (u.scheme == "intent") {
                    val fb = try { Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME).getStringExtra("browser_fallback_url") } catch (e: Exception) { null }
                    if (fb != null && fb.startsWith("https://")) { v.loadUrl(fb); return true }
                    if (watchMode || buyMode) return true
                }
                if (watchMode && u.scheme != "tel" && u.scheme != "mailto") return true   // a price check never leaves for another app
                // an app link (market://, whatsapp://, tel:): hand it to Android
                return try { startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true } catch (e: Exception) { true }
            }
            override fun onReceivedError(v: WebView, req: WebResourceRequest, err: android.webkit.WebResourceError) {
                if (req.isForMainFrame) status.text = L("loadFail", "This page didn't load — check the internet, or tap Done.")
            }
            override fun onPageCommitVisible(v: WebView, u: String) { pageRound = round }
            override fun onPageFinished(v: WebView, u: String) {
                pageRound = round
                if (kit.isNotEmpty()) v.evaluateJavascript(kit, null)
                // v8.0 Agents "Check now": a price watch reads the cheapest offer by itself once the results have drawn
                if (watchMode && rounds.length() == 0) for (ms in longArrayOf(2500L, 6000L)) v.postDelayed({ if (!closed) run("window.__attuneAgent&&window.__attuneAgent.best($rules)") }, ms)
                // v8.2: a hotel window checks several start days in a row — each page closes itself once its prices are read
                if (watchMode && autoClose && !autoArmed && rounds.length() == 0) { autoArmed = true; v.postDelayed({ if (!closed) finishWith("done") }, 11000L) }
                // v9.1: read this start day again and again until its prices stand still, then the next one (v8.7 waited a fixed 8 s:
                // a slow Booking page moved on before its prices showed)
                // (armed by armRound() when the day's page is asked for, so a page that never finishes loading can't stop the check)
                // the end: the cheapest day's page — its best offer is marked once (not again on the hotel page the person taps)
                if (finalMode && !finalMarked) { finalMarked = true; for (ms in longArrayOf(3000L, 7000L)) v.postDelayed({ if (!closed) run("window.__attuneAgent&&window.__attuneAgent.best($rules)") }, ms) }
                // v8.6 buy agent, after the person's "Order it": Buy now (or Add to cart) on the product page, once; then the
                // checkout pages get the person's details — the payment itself stays the person's (the kit never touches it)
                if (buyMode) {
                    if (!buyArmed) { buyArmed = true; v.postDelayed({ if (!closed) run("window.__attuneAgent&&window.__attuneAgent.buy()") }, 2500L) }
                    else v.postDelayed({ if (!closed) run("window.__attuneAgent&&window.__attuneAgent.fill($profile)") }, 2000L)
                }
            }
        }
        web.loadUrl(url)
        if (watchMode) armRound()
    }

    private fun armRound() {
        if (rounds.length() == 0 || finalMode || roundArmed == round) return
        roundArmed = round; roundStart = System.currentTimeMillis(); roundRead = null; stableHits = 0
        val mine = round; web.postDelayed({ tick(mine) }, 3000L)
    }
    private fun tick(mine: Int) {
        if (closed || finalMode || round != mine) return
        if (System.currentTimeMillis() - roundStart > 25000L) { commitRound(); nextRound(); return }   // a page that never shows prices
        if (pageRound == round) {   // only this day's own page — never the last day's prices still on screen
            if (kit.isNotEmpty()) web.evaluateJavascript(kit, null)   // the kit, if the page hasn't finished loading yet (it runs once per page)
            run("window.__attuneAgent&&window.__attuneAgent.best($rules,true)")
        }
        web.postDelayed({ tick(mine) }, 2000L)
    }
    private fun dayLine(r: JSONObject) = r.optString("checkin") + (if (r.optString("checkout").isNotEmpty()) " → " + r.optString("checkout") else "")
    private fun money(p: Double, c: String) = (c + " " + (if (p % 1.0 == 0.0) p.toLong().toString() else p.toString())).trim()

    /** This start day's last reading becomes its result (once). */
    private fun commitRound() {
        if (committed == round) return
        committed = round
        val o = roundRead ?: return; val ri = roundInfo() ?: return
        val n = o.optInt("offers"); if (n <= 0) return
        result.put("offers", result.optInt("offers") + n)
        val all = result.optJSONArray("top") ?: org.json.JSONArray()
        o.optJSONArray("top")?.let { top -> for (k in 0 until top.length()) top.optJSONObject(k)?.let { all.put(it.put("checkin", ri.optString("checkin")).put("checkout", ri.optString("checkout")).put("url", ri.optString("url"))) } }
        result.put("top", all)
        val p = o.optDouble("price", 0.0)
        if (p > 0) {
            if (!result.has("price") || p < result.optDouble("price")) result.put("price", p).put("currency", o.optString("currency")).put("checkin", ri.optString("checkin")).put("checkout", ri.optString("checkout")).put("bestRound", round)
        }
    }

    private fun nextRound() {
        round++
        if (round >= rounds.length() && !refined) { refined = true; addNeighbours() }
        if (round >= rounds.length()) { showBest(); return }
        val r = rounds.optJSONObject(round)
        if (r == null) { showBest(); return }
        var line = L("checking", "Checking {i} of {n}: {d}").replace("{i}", (round + 1).toString()).replace("{n}", rounds.length().toString()).replace("{d}", dayLine(r))
        if (result.has("price")) line += "\n" + L("soFar", "Cheapest so far: {p} ({d})").replace("{p}", money(result.optDouble("price"), result.optString("currency"))).replace("{d}", result.optString("checkin") + " → " + result.optString("checkout"))
        status.text = line
        pageRound = -1
        web.loadUrl(r.optString("url"))
        armRound()
    }

    /** After the first sweep (up to 6 days spread over the window), the days between the cheapest one and its neighbours —
     *  so the lowest price in the whole window isn't missed because it fell between two checked days. */
    private fun addNeighbours() {
        if (sweep < 2 || !result.has("bestRound")) return
        val c = result.optInt("bestRound"); if (c >= sweep) return
        val day = 86400000L
        fun ms(iso: String) = try { java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.parse(iso)!!.time } catch (e: Exception) { -1L }
        fun iso(t: Long) = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(java.util.Date(t))
        val have = HashSet<String>(); for (i in 0 until rounds.length()) rounds.optJSONObject(i)?.let { have.add(it.optString("checkin")) }
        val me = rounds.optJSONObject(c) ?: return
        val ci = ms(me.optString("checkin")); val co = ms(me.optString("checkout")); if (ci < 0 || co <= ci) return
        val nights = (co - ci) / day
        for (j in intArrayOf(c - 1, c + 1)) {
            val nb = rounds.optJSONObject(j) ?: continue; if (j >= sweep) continue
            val t = ms(nb.optString("checkin")); if (t < 0) continue
            val gap = Math.abs(t - ci) / day; if (gap < 2) continue
            val mid = ci + (if (t > ci) 1 else -1) * (gap / 2) * day
            val nci = iso(mid); if (!have.add(nci)) continue
            val nco = iso(mid + nights * day)
            val u = me.optString("url").replace("checkin=" + me.optString("checkin"), "checkin=$nci").replace("checkout=" + me.optString("checkout"), "checkout=$nco")
            if (u == me.optString("url")) continue
            rounds.put(JSONObject().put("checkin", nci).put("checkout", nco).put("url", u))
        }
    }

    /** The end: the cheapest day's page, its best offer marked; the window stays open for the person (Done closes it). */
    private fun showBest() {
        val b = result.optInt("bestRound", -1)
        val r = if (b >= 0) rounds.optJSONObject(b) else null
        if (r == null) { finishWith("done"); return }
        finalMode = true; round = b
        status.setTextColor(Color.parseColor("#4FC2AF"))
        status.text = L("cheapestAll", "Cheapest of {n} dates: {p} ({d}) — it's marked. Tap it to book.").replace("{n}", rounds.length().toString())
            .replace("{p}", money(result.optDouble("price"), result.optString("currency"))).replace("{d}", dayLine(r))
        web.loadUrl(r.optString("url"))
    }
    private fun roundInfo(): JSONObject? = if (rounds.length() > 0 && round < rounds.length()) rounds.optJSONObject(round) else null

    private fun run(code: String) { web.evaluateJavascript("(function(){try{$code}catch(e){}})()", null) }

    /** The only thing the website can call: counts for the status line (never data, never Attune's bridge). */
    inner class Host {
        @JavascriptInterface
        fun report(json: String) {
            val o = try { JSONObject(json) } catch (e: Exception) { return }
            runOnUiThread {
                when (o.optString("kind")) {
                    "best" -> if (rounds.length() > 0 && !finalMode) {
                        // v9.1: a hotel round's reading — kept until the prices stop changing (same count twice), then the next day
                        if (!o.optBoolean("quiet")) return@runOnUiThread
                        val n = o.optInt("offers")
                        stableHits = if (n > 0 && roundRead?.optInt("offers") == n && roundRead?.optDouble("price") == o.optDouble("price")) stableHits + 1 else 0
                        roundRead = o
                        if (stableHits >= 1 && System.currentTimeMillis() - roundStart >= 6000L) { val mine = round; commitRound(); web.postDelayed({ if (!closed && round == mine) nextRound() }, 300L) }
                    } else if (finalMode) {
                        // the end screen: the cheapest day's offer is marked; its line ("Cheapest of 6 dates…") stays, nothing is counted twice
                    } else {
                        val n = o.optInt("offers"); val ri = roundInfo()
                        result.put("offers", if (ri != null) result.optInt("offers") + n else n)
                        o.optJSONArray("top")?.let { top ->
                            if (top.length() > 0) {
                                if (ri == null) result.put("top", top)   // v8.2: the best 3 for the agent's card
                                else { val all = result.optJSONArray("top") ?: org.json.JSONArray(); for (k in 0 until top.length()) top.optJSONObject(k)?.let { all.put(it.put("checkin", ri.optString("checkin")).put("checkout", ri.optString("checkout")).put("url", ri.optString("url"))) }; result.put("top", all) }
                            }
                        }
                        // v8.0: the cheapest offer goes back to the page (a price watch keeps the lowest it saw)
                        if (n > 0 && o.optDouble("price", 0.0) > 0) { val p = o.optDouble("price"); if (!result.has("price") || p < result.optDouble("price")) { result.put("price", p).put("currency", o.optString("currency")); if (ri != null) result.put("checkin", ri.optString("checkin")).put("checkout", ri.optString("checkout")) } }
                        status.text = if (n == 0) L("noOffers", "No offers found on this page yet — search on the site, then tap Best offer.")
                            else L("marked", "Marked the best of {n}: {price}. Check it and tap it.").replace("{n}", n.toString())
                                .replace("{price}", (o.optString("currency") + " " + o.optDouble("price").let { if (it % 1.0 == 0.0) it.toLong().toString() else it.toString() }).trim())
                    }
                    "fill" -> {
                        result.put("filled", result.optInt("filled") + o.optInt("filled"))
                        status.text = L("filled", "Filled {n} fields — check them. Card and password fields are yours.").replace("{n}", o.optInt("filled").toString())
                        if (o.optBoolean("payment")) payment()
                    }
                    "page" -> if (o.optBoolean("payment")) payment()
                    "buy" -> {
                        val c = o.optString("clicked"); result.put("bought", c)
                        status.text = if (c.isEmpty()) L("noBuy", "No Buy now button here — tap it yourself, I'll fill your details on the next pages.")
                            else L("pressed", "Pressed “{b}” — check the order; the payment is yours.").replace("{b}", c)
                    }
                }
            }
        }
    }

    private fun payment() {
        result.put("payment", true)
        status.setTextColor(Color.parseColor("#E3A44A"))
        status.text = L("paying", "Payment — your turn. Attune never pays or reads card details.")
    }

    private fun goBackOrClose() { if (::web.isInitialized && web.canGoBack()) web.goBack() else finishWith("closed") }
    @Deprecated("Back")
    override fun onBackPressed() { goBackOrClose() }   // Android 12 and older

    private fun finishWith(reason: String) {
        if (closed) return
        closed = true
        try { result.put("reason", reason) } catch (e: Exception) {}
        val cb = onDone; onDone = null
        try { cb?.invoke(result) } catch (e: Exception) {}
        finish()
    }

    override fun onDestroy() {
        if (!closed) { closed = true; val cb = onDone; onDone = null; try { cb?.invoke(result.put("reason", "closed")) } catch (e: Exception) {} }
        if (::web.isInitialized) try { web.destroy() } catch (e: Exception) {}
        super.onDestroy()
    }
}
