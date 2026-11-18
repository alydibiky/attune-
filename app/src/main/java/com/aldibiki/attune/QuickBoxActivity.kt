package com.aldibiki.attune

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

/**
 * v10.5 — the small box over the home screen (Ali OK'd OK-W3, OK-A1 "+ Add", OK-W2 "− I spent / + I got"): a see-through window that
 * runs Attune's own page in its quick mode (web-src/quickbox-ui.jsx: index.html?quick=say|voice|list|spend|got&list=<id>). The page
 * reads the sentence with the same reader as the Home box, saves each part with its own Undo and refreshes the widgets; a question
 * opens Chat. Same origin as the app (appassets), so it uses the same stores. Attune itself does not open.
 */
class QuickBoxActivity : Activity() {
    private var web: WebView? = null

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        @Suppress("DEPRECATION") window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE)
        val w = WebView(this); web = w
        w.setBackgroundColor(Color.TRANSPARENT)
        w.settings.javaScriptEnabled = true
        w.settings.domStorageEnabled = true
        w.settings.mediaPlaybackRequiresUserGesture = false
        val loader = WebViewAssetLoader.Builder().addPathHandler("/app/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        w.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView, req: WebResourceRequest): WebResourceResponse? {
                if (req.url.host != "appassets.androidplatform.net") return null
                val r = loader.shouldInterceptRequest(req.url) ?: return null
                val p = req.url.path ?: ""
                if (p.endsWith(".js") || p.endsWith(".mjs")) r.mimeType = "text/javascript" else if (p.endsWith(".json")) r.mimeType = "application/json"
                return r
            }
            override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean = req.url.host != "appassets.androidplatform.net"
            override fun onPageFinished(v: WebView, url: String?) { loaded = true; pendingHeard?.let { t -> pendingHeard = null; v.postDelayed({ heard(t) }, 600) } }
        }
        w.addJavascriptInterface(NativeBridge(this, w), "AttuneNative")
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
            WebViewCompat.addDocumentStartJavaScript(w, "window.ATTUNE_NATIVE=true;window.ATTUNE_QUICK=true;window.ATTUNE_BACKEND={localUrl:${JSONObject.quote(Engine.baseUrl)},native:true};", setOf("https://appassets.androidplatform.net"))
        setContentView(w)
        val mode = intent.getStringExtra("mode") ?: "say"
        val list = intent.getStringExtra("list") ?: ""
        w.loadUrl("https://appassets.androidplatform.net/app/www/index.html?quick=" + Uri.encode(mode) + "&list=" + Uri.encode(list))
        if (mode == "voice" && b == null) listen()
    }

    /** 🎤 on the box widget: Android's own speech box first; the words go into the page's box (window.__quickHeard). */
    private fun listen() {
        try {
            val i = android.content.Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            @Suppress("DEPRECATION") startActivityForResult(i, 41)
        } catch (e: Exception) { heard("") }
    }
    @Deprecated("Deprecated in Java")
    override fun onActivityResult(req: Int, res: Int, data: android.content.Intent?) {
        @Suppress("DEPRECATION") super.onActivityResult(req, res, data)
        if (req == 41) heard(data?.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS)?.firstOrNull() ?: "")
    }
    private var pendingHeard: String? = null
    private var loaded = false
    private fun heard(t: String) { if (loaded) web?.evaluateJavascript("window.__quickHeard&&window.__quickHeard(" + JSONObject.quote(t) + ")", null) else pendingHeard = t }
    fun openApp(mode: String, text: String) {
        runOnUiThread {
            try { startActivity(android.content.Intent(this, MainActivity::class.java).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(EXTRA_OPEN_PAGE, mode.ifBlank { "chat" }).putExtra(WakeService.EXTRA_VOICE_TEXT, text.take(500))) } catch (e: Exception) { }
            finish()
        }
    }

    /** The page's ✕ / Done, and the phone's back. */
    fun close() { runOnUiThread { try { W5.refreshAll(this) } catch (e: Exception) { }; finish() } }
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { close() }
    override fun onDestroy() { try { web?.destroy() } catch (e: Exception) { }; web = null; super.onDestroy() }
}
