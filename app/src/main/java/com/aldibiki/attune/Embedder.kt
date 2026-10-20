package com.aldibiki.attune

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/**
 * v6.45 Recall phase 2 — the meaning model (bge-m3, BAAI, MIT licence; GGUF Q4_K_M by gpustack, pinned to one revision and
 * checked by its sha256). An optional 438 MB download into the app's private folder; it runs on the phone's CPU
 * (EmbedNative) beside the chat model and is let go after a minute without use, so its memory comes back.
 * Text in, numbers out — Recall (meaning.js) compares the numbers; nothing leaves the phone.
 */
object Embedder {
    private const val REV = "2d48f1737679ad900d5c26c5aad5410e9c70fdca"
    private val URL_ = "https://huggingface.co/gpustack/bge-m3-GGUF/resolve/$REV/bge-m3-Q4_K_M.gguf"
    const val BYTES = 437_778_496L
    private const val SHA = "6d39681b26c61279ac1f82db35a04a05009e94c415b51c858ff571489a82fc06"
    private const val NEED_FREE = 900L * 1024 * 1024     // the model + its working memory, with room to spare

    class Cancelled : Exception("Cancelled")

    private fun file(ctx: Context) = File(File(ctx.filesDir, "embed").apply { mkdirs() }, "bge-m3-Q4_K_M.gguf")
    private fun part(ctx: Context) = File(file(ctx).path + ".part")

    fun installed(ctx: Context): Boolean = file(ctx).length() == BYTES

    fun status(ctx: Context): JSONObject = JSONObject().put("installed", installed(ctx)).put("bytes", BYTES)
        .put("partial", part(ctx).length()).put("loaded", loaded)

    fun remove(ctx: Context): Boolean { release(); part(ctx).delete(); return !file(ctx).exists() || file(ctx).delete() }

    /** Downloads (resuming a stopped download from where it stopped), checks the fingerprint, then keeps the file. */
    fun install(ctx: Context, onProgress: (Long, Long) -> Unit, isCancelled: () -> Boolean) {
        if (installed(ctx)) return
        Prefs.requireOnline(URL_, "meaning model")
        NetLog.add("huggingface.co", "Recall: the meaning model (bge-m3, 438 MB)")
        val p = part(ctx)
        val have = if (p.exists() && p.length() < BYTES) p.length() else { p.delete(); 0L }
        val c = URL(URL_).openConnection() as HttpURLConnection
        c.connectTimeout = 15_000; c.readTimeout = 60_000; c.instanceFollowRedirects = true
        c.setRequestProperty("User-Agent", "Attune (Android; meaning model)")
        if (have > 0) c.setRequestProperty("Range", "bytes=$have-")
        try {
            val code = c.responseCode
            if (code !in 200..299) throw Exception("The meaning model download returned HTTP $code")
            val start = if (code == 206) have else 0L
            RandomAccessFile(p, "rw").use { out ->
                out.setLength(start); out.seek(start)
                val buf = ByteArray(256 * 1024); var got = start; var last = 0L; var n: Int
                c.inputStream.use { inp ->
                    while (inp.read(buf).also { n = it } > 0) {
                        if (isCancelled()) throw Cancelled()
                        out.write(buf, 0, n); got += n
                        if (got - last > 2_000_000) { last = got; onProgress(got, BYTES) }
                    }
                }
                onProgress(got, BYTES)
            }
        } finally { try { c.disconnect() } catch (e: Exception) {} }
        if (p.length() != BYTES) throw Exception("The download was incomplete — tap Download again to continue")
        val md = MessageDigest.getInstance("SHA-256")
        p.inputStream().use { inp -> val buf = ByteArray(1 shl 20); var n: Int; while (inp.read(buf).also { n = it } > 0) md.update(buf, 0, n) }
        val sha = md.digest().joinToString("") { "%02x".format(it) }
        if (sha != SHA) { p.delete(); throw Exception("The downloaded model didn't match its fingerprint — it was deleted; try again") }
        if (!p.renameTo(file(ctx))) throw Exception("Couldn't save the meaning model")
    }

    // ---- running it -----------------------------------------------------------------------------------------------------------
    @Volatile private var loaded = false
    private val timer = Executors.newSingleThreadScheduledExecutor()
    private var idle: ScheduledFuture<*>? = null

    /** texts → vectors (JSON arrays, 5 decimals). Loads the model when needed; frees it after 60 s without use. */
    @Synchronized fun embed(ctx: Context, texts: JSONArray): JSONArray {
        if (!installed(ctx)) throw Exception("Download the meaning model first (Recall → Search by meaning)")
        if (!loaded) {
            if (DeviceInfo.availRamBytes(ctx) < NEED_FREE) throw Exception("Not enough free memory right now — close the chat model or try again later")
            EngineNative.nPreload(ctx.applicationInfo.nativeLibraryDir)
            val threads = DeviceInfo.bigCores().coerceIn(2, 4)
            if (!EmbedNative.nLoad(file(ctx).absolutePath, threads)) throw Exception("The meaning model couldn't start on this phone")
            loaded = true
        }
        idle?.cancel(false)
        val out = JSONArray()
        for (i in 0 until texts.length()) {
            val v = EmbedNative.nEmbed(texts.optString(i).take(4000))
            val a = JSONArray(); for (x in v) a.put(Math.round(x * 100000.0) / 100000.0)
            out.put(a)
        }
        idle = timer.schedule({ release() }, 60, TimeUnit.SECONDS)
        return out
    }

    @Synchronized fun release() { if (loaded) { try { EmbedNative.nFree() } catch (e: Throwable) {}; loaded = false } }
}
