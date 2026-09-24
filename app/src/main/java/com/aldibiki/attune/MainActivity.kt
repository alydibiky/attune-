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

    // Android's "Save to…" picker, for backups. The MIME type is given per call
    // through a tiny contract subclass, because CreateDocument fixes it at registration.
    private var saveDone: ((Uri?) -> Unit)? = null
    private var saveMime = "application/octet-stream"
    private val createDoc = registerForActivityResult(object : ActivityResultContracts.CreateDocument("application/octet-stream") {
        override fun createIntent(context: android.content.Context, input: String): Intent =
            super.createIntent(context, input).setType(saveMime)
    }) { uri ->
        val cb = saveDone
        saveDone = null
        cb?.invoke(uri)
    }

    // Android 13+: showing reminder notifications needs a yes, asked once.
    private val askNotifyPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (::web.isInitialized) web.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('attune-notify-permission',{detail:{granted:$granted}}))", null)
    }

    private lateinit var voice: Voice
    private val askMicPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        bridge.lastVoiceSink?.let { voice.onPermission(granted, it) }
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

        web = makeWebView()
        // targetSdk 35 draws edge-to-edge, so the page must be kept out from
        // under the status bar, the navigation bar and the keyboard. A WebView
        // IGNORES its own padding (its page still drew under the clock and the
        // gesture bar), so the WebView sits in a frame and the FRAME is padded.
        val frame = android.widget.FrameLayout(this).apply {
            setBackgroundColor(android.graphics.Color.parseColor("#020617"))
            addView(web, android.widget.FrameLayout.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.MATCH_PARENT))
        }
        setContentView(frame)
        ViewCompat.setOnApplyWindowInsetsListener(frame) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        // Light status-bar icons on the dark page.
        try { androidx.core.view.WindowCompat.getInsetsController(window, frame).isAppearanceLightStatusBars = false } catch (e: Exception) {}

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            useWideViewPort = false
            loadWithOverviewMode = false
            // The person's choice in More → Text size (the phone's own font
            // size setting is ignored: it made the app too big to fit).
            textZoom = getSharedPreferences("attune", MODE_PRIVATE).getInt("text_zoom", 100)
            allowFileAccess = false
            allowContentAccess = false
            // The page is https (appassets); the model server is http on
            // 127.0.0.1. That one request never leaves the phone.
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            // Draw the parts of the page just off screen ahead of time, so
            // scrolling doesn't show blank strips.
            offscreenPreRaster = true
        }
        WebView.setWebContentsDebuggingEnabled(isDebuggable)

        bridge = NativeBridge(this, web)
        voice = Voice(this)
        bridge.voice = voice
        bridge.askMic = { askMicPermission.launch(android.Manifest.permission.RECORD_AUDIO) }
        bridge.askNotify = {
            if (android.os.Build.VERSION.SDK_INT >= 33) askNotifyPermission.launch(android.Manifest.permission.POST_NOTIFICATIONS)
        }
        Reminders.ensureChannel(this)
        bridge.createDocument = { name, mime, done ->
            saveDone?.invoke(null)
            saveDone = done
            saveMime = mime
            try { createDoc.launch(name) } catch (e: Exception) { saveDone = null; done(null) }
        }
        // This screen now hears about every engine change, including one that
        // was started by a screen that has since closed.
        Engine.onChange = { bridge.announceEngine() }
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

            // If Android reclaims the page's renderer (low memory while a big
            // model is loaded), rebuild the page instead of letting the whole
            // app crash — which would also throw away the loaded model.
            override fun onRenderProcessGone(view: WebView, detail: android.webkit.RenderProcessGoneDetail): Boolean {
                recreate()
                return true
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
                    // At the top level, Back sends the app to the background
                    // (like Home) instead of closing it, so the model stays
                    // loaded and reopening is instant.
                    if (r != "true") { if (web.canGoBack()) web.goBack() else moveTaskToBack(true) }
                }
            }
        })

        web.loadUrl("https://appassets.androidplatform.net/app/www/index.html")
        handleShare(intent)

        // Bring back the model that was in use last time — on the CPU if the
        // last GPU start crashed the app.
        Engine.checkGpuCrash(this)
        if (Engine.state == Engine.State.IDLE) {
            ModelStore.active(this)?.let { m -> Engine.start(this, m) { _, _ -> } }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleShare(intent)
    }

    override fun onDestroy() {
        // The model is deliberately NOT stopped here. Stopping it on every exit
        // meant reopening the app waited for a full reload (and a reload that
        // started while the old one was still stopping never finished). The
        // model lives as long as the app's process; Android reclaims that
        // memory by itself when another app needs it.
        voice.stop()
        bridge.release()
        if (::web.isInitialized) { (web.parent as? android.view.ViewGroup)?.removeView(web); web.destroy() }
        super.onDestroy()
    }

    private fun makeWebView(): WebView = WebView(this).apply {
        // No stretch/glow at the edges: it made the whole app bounce when a
        // list inside it was scrolled to its end.
        overScrollMode = android.view.View.OVER_SCROLL_NEVER
        isVerticalScrollBarEnabled = false
        setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
    }

    /**
     * Something shared from another app: text (a bank SMS, a WhatsApp
     * message), a photo or screenshot (a payment receipt, a menu), or text
     * selected anywhere and sent with "Ask Attune".
     */
    private fun handleShare(intent: Intent?) {
        // A reminder notification was tapped: the page shows it.
        intent?.getStringExtra(Reminders.EXTRA_ID)?.let { rid ->
            val p = JSONObject().put("kind", "reminder").put("id", rid)
            if (::web.isInitialized && web.progress == 100) deliverShare(p) else pendingShare = p
            return
        }
        val payload = JSONObject()
        when (intent?.action) {
            Intent.ACTION_SEND -> {
                val type = intent.type ?: ""
                if (type.startsWith("image/")) {
                    @Suppress("DEPRECATION")
                    val uri = (if (android.os.Build.VERSION.SDK_INT >= 33)
                        intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                    else intent.getParcelableExtra(Intent.EXTRA_STREAM)) as Uri? ?: return
                    val data = readImageForPage(uri) ?: return
                    payload.put("kind", "image").put("image", data)
                        .put("text", intent.getStringExtra(Intent.EXTRA_TEXT) ?: "")
                } else {
                    val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return
                    payload.put("kind", "share").put("text", text)
                }
            }
            Intent.ACTION_PROCESS_TEXT -> {
                val text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString() ?: return
                payload.put("kind", "selection").put("text", text)
            }
            else -> return
        }
        if (::web.isInitialized && web.progress == 100) deliverShare(payload) else pendingShare = payload
    }

    /**
     * A shared image, scaled down to at most 1600 px on its long side and
     * re-encoded as JPEG: a 12 MP photo would be ~5 MB of base64, far more
     * than the model's photo reader uses anyway.
     */
    private fun readImageForPage(uri: Uri): String? = try {
        val opts = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        contentResolver.openInputStream(uri)?.use { android.graphics.BitmapFactory.decodeStream(it, null, opts) }
        var sample = 1
        while (maxOf(opts.outWidth, opts.outHeight) / (sample * 2) >= 1600) sample *= 2
        val bmp = contentResolver.openInputStream(uri)?.use {
            android.graphics.BitmapFactory.decodeStream(it, null, android.graphics.BitmapFactory.Options().apply { inSampleSize = sample })
        }
        if (bmp == null) null else {
            val out = java.io.ByteArrayOutputStream()
            bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, out)
            bmp.recycle()
            "data:image/jpeg;base64," + android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP)
        }
    } catch (e: Exception) { null }

    private fun deliverShare(payload: JSONObject) {
        // As a JSON literal, so quotes, newlines and Arabic all survive.
        web.evaluateJavascript("window.dispatchEvent(new MessageEvent('attune-share',{data:$payload}));", null)
    }

    private val isDebuggable: Boolean
        get() = 0 != (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)
}
