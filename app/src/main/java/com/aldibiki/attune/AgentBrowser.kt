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

        web = WebView(this)
        root.addView(web, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

        status = TextView(this).apply { setTextColor(mut); textSize = 12.5f; setPadding(dp(14), dp(8), dp(14), dp(2)); text = L("hint", "Attune marks the best offer and fills your details. You choose and pay.") }
        root.addView(status)

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

        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.setSupportMultipleWindows(false)
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false
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
                // an app link (intent://, market://, whatsapp://, tel:): hand it to Android
                return try { startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); true } catch (e: Exception) { true }
            }
            override fun onPageFinished(v: WebView, u: String) {
                if (kit.isNotEmpty()) v.evaluateJavascript(kit, null)
                // v8.0 Agents "Check now": a price watch reads the cheapest offer by itself once the results have drawn
                if (watchMode) for (ms in longArrayOf(2500L, 6000L)) v.postDelayed({ if (!closed) run("window.__attuneAgent&&window.__attuneAgent.best($rules)") }, ms)
                // v8.2: a hotel window checks several start days in a row — each page closes itself once its prices are read
                if (watchMode && autoClose && !autoArmed) { autoArmed = true; v.postDelayed({ if (!closed) finishWith("done") }, 11000L) }
                // v8.6 buy agent, after the person's "Order it": Buy now (or Add to cart) on the product page, once; then the
                // checkout pages get the person's details — the payment itself stays the person's (the kit never touches it)
                if (buyMode) {
                    if (!buyArmed) { buyArmed = true; v.postDelayed({ if (!closed) run("window.__attuneAgent&&window.__attuneAgent.buy()") }, 2500L) }
                    else v.postDelayed({ if (!closed) run("window.__attuneAgent&&window.__attuneAgent.fill($profile)") }, 2000L)
                }
            }
        }
        web.loadUrl(url)
    }

    private fun run(code: String) { web.evaluateJavascript("(function(){try{$code}catch(e){}})()", null) }

    /** The only thing the website can call: counts for the status line (never data, never Attune's bridge). */
    inner class Host {
        @JavascriptInterface
        fun report(json: String) {
            val o = try { JSONObject(json) } catch (e: Exception) { return }
            runOnUiThread {
                when (o.optString("kind")) {
                    "best" -> {
                        val n = o.optInt("offers"); result.put("offers", n)
                        o.optJSONArray("top")?.let { if (it.length() > 0) result.put("top", it) }   // v8.2: the best 3 for the agent's card
                        // v8.0: the cheapest offer goes back to the page (a price watch keeps the lowest it saw)
                        if (n > 0 && o.optDouble("price", 0.0) > 0) { val p = o.optDouble("price"); if (!result.has("price") || p < result.optDouble("price")) result.put("price", p).put("currency", o.optString("currency")) }
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
