package com.aldibiki.attune

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.ByteArrayInputStream

/**
 * Hosts the Attune page and connects it to the phone.
 *
 * 1. The page is served from a real origin (appassets), so its storage — the
 *    ledger, memory, corrections — persists between launches.
 * 2. window.AttuneNative (NativeBridge) lets the page install models, search
 *    the web natively, read device facts and toggle the offline lock.
 * 3. window.ATTUNE_BACKEND tells the page where the on-device model server is
 *    and the per-launch key it must present. Set before the page's scripts run.
 * 4. Every request the page makes to the internet passes through
 *    shouldInterceptRequest: logged, and refused outright when the offline
 *    lock is on.
 * 5. Back goes back inside the app; text shared or selected in any other app
 *    arrives in Attune.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView
    private lateinit var bridge: NativeBridge
    private var pendingShare: JSONObject? = null

    // <input type="file"> in the page (photos to read, a backup to import).
    // A WebView shows no picker unless the app opens one itself.
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        val cb = fileCallback
        fileCallback = null
        cb?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res.resultCode, res.data))
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Prefs.airGap(this) // prime the lock before anything can reach the network

        // The page is served under /app/. Earlier builds served it under
        // /assets/, where a service worker could keep an old copy alive across
        // updates; /app/ is outside that worker's reach, while the origin —
        // and so all saved data — stays the same.
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/app/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        // Any service-worker request for the app's own files is answered from
        // the APK, never from the network (where this address does not exist).
        try {
            android.webkit.ServiceWorkerController.getInstance().setServiceWorkerClient(
                object : android.webkit.ServiceWorkerClient() {
                    override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? =
                        if (request.url.host == "appassets.androidplatform.net") loader.shouldInterceptRequest(request.url) else null
                })
        } catch (e: Exception) { }

        web = WebView(this)
        setContentView(web)

        // targetSdk 35 draws edge-to-edge; keep the page out from under the
        // status bar, the navigation bar and the keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(web) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = false
            loadWithOverviewMode = false
            textZoom = 100
            allowFileAccess = false
            allowContentAccess = false
            // The page is https (appassets); the model server is http on
            // 127.0.0.1. That one request never leaves the phone.
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        WebView.setWebContentsDebuggingEnabled(isDebuggable)

        bridge = NativeBridge(this, web)
        web.addJavascriptInterface(bridge, "AttuneNative")

        val backendJs = "window.ATTUNE_NATIVE=true;window.ATTUNE_BACKEND={localUrl:${JSONObject.quote(Engine.baseUrl)}," +
            "apiKey:${JSONObject.quote(Engine.apiKey)},native:true};"
        val docStart = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        if (docStart) {
            WebViewCompat.addDocumentStartJavaScript(web, backendJs, setOf("https://appassets.androidplatform.net"))
        }

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView, req: WebResourceRequest): WebResourceResponse? {
                val url = req.url
                val host = url.host ?: ""
                if (host == "appassets.androidplatform.net") return loader.shouldInterceptRequest(url)
                if (host == "127.0.0.1" || host == "localhost") return null   // the on-device model
                if (url.scheme == "data" || url.scheme == "blob") return null
                if (Prefs.airGapNow) {
                    NetLog.add(url.toString(), "page request", blocked = true)
                    return WebResourceResponse("text/plain", "utf-8", 403, "Offline lock",
                        mapOf("Access-Control-Allow-Origin" to "*"), ByteArrayInputStream(ByteArray(0)))
                }
                NetLog.add(url.toString(), "page request")
                return null
            }

            override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {
                val url = req.url
                if (url.host == "appassets.androidplatform.net") return false
                // Anything else — a source link, a map hand-off — opens outside the app.
                return try { startActivity(Intent(Intent.ACTION_VIEW, url)); true } catch (e: Exception) { true }
            }

            override fun onPageFinished(v: WebView, url: String) {
                if (!docStart) web.evaluateJavascript(backendJs, null)
                pendingShare?.let { deliverShare(it); pendingShare = null }
                bridge.announceEngine()
            }
        }

        // File pickers and the page's confirm() dialogs. Without a chrome
        // client both silently do nothing in a WebView.
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams,
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    pickFiles.launch(params.createIntent())
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    false
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // The page decides first: close a panel or return to the home tab.
                web.evaluateJavascript("(window.__attuneBack && window.__attuneBack()) ? true : false") { r ->
                    if (r != "true") { if (web.canGoBack()) web.goBack() else finish() }
                }
            }
        })

        web.loadUrl("https://appassets.androidplatform.net/app/www/index.html")
        handleShare(intent)

        // Bring back the model that was in use last time.
        if (Engine.state == Engine.State.IDLE) {
            ModelStore.active(this)?.let { m -> Engine.start(this, m) { _, _ -> bridge.announceEngine() } }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleShare(intent)
    }

    override fun onDestroy() {
        // Leaving the app hands the model's memory (gigabytes) back to the phone.
        if (isFinishing) Engine.stop()
        super.onDestroy()
    }

    /** Text shared from another app, or selected anywhere and sent with "Attune". */
    private fun handleShare(intent: Intent?) {
        val text: String
        val kind: String
        when (intent?.action) {
            Intent.ACTION_SEND -> {
                text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
                kind = "share"
            }
            Intent.ACTION_PROCESS_TEXT -> {
                text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString() ?: return
                kind = "selection"
            }
            else -> return
        }
        val payload = JSONObject().put("text", text).put("kind", kind)
        if (::web.isInitialized && web.progress == 100) deliverShare(payload) else pendingShare = payload
    }

    private fun deliverShare(payload: JSONObject) {
        // As a JSON literal, so quotes, newlines and Arabic all survive.
        web.evaluateJavascript("window.dispatchEvent(new MessageEvent('attune-share',{data:$payload}));", null)
    }

    private val isDebuggable: Boolean
        get() = 0 != (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)
}
