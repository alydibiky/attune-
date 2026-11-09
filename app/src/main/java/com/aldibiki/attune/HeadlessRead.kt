package com.aldibiki.attune

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

/**
 * v9.9.4 (Ali, 10 Nov 2026: "I have been following it for 2 weeks and it didn't change"): Booking and other big sites only show
 * prices after their own JavaScript runs, so the background check (Jsoup, no JavaScript) never saw a price — "12 checks in the
 * background didn't show prices". This reads such a page the way "Check now" does, but with no screen: an invisible WebView loads
 * it, runs the same agent-kit.js the agent's browser uses, and returns its "best" reading ({offers, price, currency, top}). It never
 * signs in, fills, books or pays; images are not loaded; it gives up after the time limit. Called from a background thread only.
 */
object HeadlessRead {
    private const val UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"
    /** Sites whose prices appear only after their scripts run. */
    fun needsScripts(url: String): Boolean = Regex("(?i)(^|\\.)(booking|agoda|expedia|hotels|airbnb|trivago|kayak|skyscanner|almosafer|wego|tripadvisor)\\.").containsMatchIn(android.net.Uri.parse(url).host ?: "")

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    fun best(ctx: Context, url: String, rules: String = "{}", limitMs: Long = 24000L): JSONObject? {
        if (Looper.myLooper() == Looper.getMainLooper()) return null
        val kit = try { ctx.assets.open("www/agent-kit.js").bufferedReader(Charsets.UTF_8).use { it.readText() } } catch (e: Exception) { "" }
        if (kit.isEmpty()) return null
        val main = Handler(Looper.getMainLooper())
        val out = java.util.concurrent.atomic.AtomicReference<JSONObject?>(null)
        val web = java.util.concurrent.atomic.AtomicReference<WebView?>(null)
        val failed = java.util.concurrent.atomic.AtomicBoolean(false)
        val read = "(function(){try{window.__attuneAgent&&window.__attuneAgent.best(" + (if (rules.isBlank()) "{}" else rules) + ",true)}catch(e){}})()"
        main.post {
            try {
                val w = WebView(ctx.applicationContext); web.set(w)
                w.settings.javaScriptEnabled = true
                w.settings.domStorageEnabled = true
                w.settings.userAgentString = UA
                w.settings.blockNetworkImage = true
                w.settings.loadsImagesAutomatically = false
                // a real size, so the page lays out its result cards like on a phone
                w.measure(View.MeasureSpec.makeMeasureSpec(1080, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(2400, View.MeasureSpec.EXACTLY))
                w.layout(0, 0, 1080, 2400)
                w.addJavascriptInterface(object {
                    @JavascriptInterface fun report(json: String) {
                        val o = try { JSONObject(json) } catch (e: Exception) { return }
                        if (o.optString("kind") == "best" && o.optInt("offers") > 0) out.set(o)
                    }
                }, "AttuneAgentHost")
                w.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(v: WebView, u: String?) {
                        v.evaluateJavascript(kit, null)
                        for (ms in longArrayOf(3000L, 6000L, 10000L, 15000L, 21000L)) v.postDelayed({ try { v.evaluateJavascript(kit, null); v.evaluateJavascript(read, null) } catch (e: Exception) {} }, ms)
                    }
                }
                w.loadUrl(url)
            } catch (e: Throwable) { failed.set(true) }
        }
        // the reading is kept once the number of offers stops changing (the page loads its results in steps)
        val end = System.currentTimeMillis() + limitMs
        var lastN = -1; var stable = 0
        while (System.currentTimeMillis() < end && !failed.get()) {
            try { Thread.sleep(1000L) } catch (e: InterruptedException) { break }
            val o = out.get() ?: continue
            val n = o.optInt("offers")
            if (n == lastN) { if (++stable >= 5) break } else { stable = 0; lastN = n }
        }
        main.post { try { web.get()?.stopLoading(); web.get()?.destroy() } catch (e: Throwable) {} }
        return out.get()
    }
}
