package com.aldibiki.attune

import android.content.Context
import android.webkit.WebResourceResponse
import com.google.android.play.core.assetpacks.AssetPackManagerFactory
import com.google.android.play.core.assetpacks.AssetPackStateUpdateListener
import com.google.android.play.core.assetpacks.model.AssetPackStatus
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream

/**
 * v8.7 (P7, Ali agreed: "optional packs download on first use"): in the Play Store build, Python for Code (Pyodide, 26 MB) is not
 * in the first download. It is a Play "on-demand asset pack" (pypack/, Play Asset Delivery — Google's own way, Apache-2.0
 * library) that downloads the first time Python is needed. The page still asks for /app/www/py/… exactly as before: this
 * serves the file from the downloaded pack when it is there, else from the APK (the sideload APK still carries Python inside).
 */
object PyPack {
    const val NAME = "pypack"
    private fun manager(ctx: Context) = AssetPackManagerFactory.getInstance(ctx.applicationContext)

    /** The downloaded pack's py/ folder, or null. */
    fun dir(ctx: Context): File? = try {
        manager(ctx).getPackLocation(NAME)?.assetsPath()?.let { File(it, "py") }?.takeIf { it.isDirectory }
    } catch (e: Throwable) { null }

    /** Is Python on this phone? inApk = it came with the app; pack = downloaded. */
    fun status(ctx: Context): JSONObject {
        val inApk = try { ctx.assets.open("www/py/VERSION").close(); true } catch (e: Exception) { false }
        return JSONObject().put("inApk", inApk).put("pack", dir(ctx) != null).put("ready", inApk || dir(ctx) != null)
    }

    /** Download the pack (Play shows nothing; the page shows the progress). onState: {status, pct, done, error}. */
    fun fetch(ctx: Context, activity: android.app.Activity?, onState: (JSONObject) -> Unit) {
        val m = manager(ctx)
        lateinit var listener: AssetPackStateUpdateListener
        listener = AssetPackStateUpdateListener { s ->
            if (s.name() != NAME) return@AssetPackStateUpdateListener
            val total = s.totalBytesToDownload().coerceAtLeast(1)
            val o = JSONObject().put("status", s.status()).put("pct", (s.bytesDownloaded() * 100 / total).toInt())
            when (s.status()) {
                AssetPackStatus.COMPLETED -> { m.unregisterListener(listener); onState(o.put("done", true)) }
                AssetPackStatus.FAILED, AssetPackStatus.CANCELED -> { m.unregisterListener(listener); onState(o.put("error", "Python didn't download (error ${s.errorCode()}) — try again on Wi-Fi")) }
                AssetPackStatus.WAITING_FOR_WIFI, AssetPackStatus.REQUIRES_USER_CONFIRMATION -> {
                    // big downloads on mobile data need the person's OK — Play shows its own small screen for it
                    try { activity?.let { a -> m.showConfirmationDialog(a) } } catch (e: Throwable) {}
                    onState(o)
                }
                else -> onState(o)
            }
        }
        m.registerListener(listener)
        m.fetch(listOf(NAME)).addOnFailureListener { e -> m.unregisterListener(listener); onState(JSONObject().put("error", e.message ?: "Python isn't available from Google Play here")) }
    }

    /** /app/www/py/<path>: from the downloaded pack, else from the APK, else null (the next handler answers). */
    fun open(ctx: Context, path: String): WebResourceResponse? {
        val clean = path.trimStart('/'); if (clean.contains("..")) return null
        val mime = when {
            clean.endsWith(".wasm") -> "application/wasm"; clean.endsWith(".mjs") || clean.endsWith(".js") -> "text/javascript"
            clean.endsWith(".json") -> "application/json"; clean.endsWith(".whl") || clean.endsWith(".zip") -> "application/zip"
            else -> "application/octet-stream"
        }
        dir(ctx)?.let { d -> val f = File(d, clean); if (f.isFile) return WebResourceResponse(mime, null, FileInputStream(f)) }
        return try { WebResourceResponse(mime, null, ctx.assets.open("www/py/$clean")) } catch (e: Exception) { null }
    }
}
