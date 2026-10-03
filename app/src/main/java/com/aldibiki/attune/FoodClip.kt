package com.aldibiki.attune

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * v6.10 — the photo fast path's files (Fit & Food): a small image model, its runtime and the food-name bank,
 * downloaded once from this app's own release (tools/build_food_clip_bank.py, "Build the photo fast path" job)
 * into the app's private folder. The page reads them at https://appassets.androidplatform.net/foodclip/<name>
 * (MainActivity) and runs them itself — nothing here looks at a photo.
 */
object FoodClip {
    private const val BASE = "https://github.com/alydibiky/attune-/releases/download/food-clip-v1/"
    private const val MANIFEST = "food-clip-manifest.json"
    private val NAME = Regex("^[a-z0-9._-]{1,60}$")

    class Cancelled : Exception("Cancelled")

    fun dir(ctx: Context): File = File(ctx.filesDir, "foodclip").apply { mkdirs() }

    /** {installed, bytes, files} — installed only when every file of the manifest is on the phone at its full size. */
    fun status(ctx: Context): JSONObject {
        val d = dir(ctx)
        val man = File(d, MANIFEST)
        val out = JSONObject().put("installed", false).put("bytes", 0L)
        if (!man.exists()) return out
        return try {
            val files = JSONObject(man.readText()).getJSONArray("files")
            var all = true; var bytes = 0L
            for (i in 0 until files.length()) {
                val f = files.getJSONObject(i)
                val local = File(d, f.getString("name"))
                if (!local.exists() || local.length() != f.getLong("bytes")) all = false else bytes += local.length()
            }
            out.put("installed", all).put("bytes", bytes).put("files", files.length())
        } catch (e: Exception) { out }
    }

    fun remove(ctx: Context): Boolean = try { dir(ctx).deleteRecursively(); true } catch (e: Exception) { false }

    /** Downloads what is missing; a file already complete is kept, so a stopped download resumes file by file. */
    fun install(ctx: Context, onProgress: (Long, Long, String) -> Unit, isCancelled: () -> Boolean) {
        val d = dir(ctx)
        val manText = String(get(BASE + MANIFEST, null, isCancelled), Charsets.UTF_8)
        val files: JSONArray = JSONObject(manText).getJSONArray("files")
        var total = 0L
        for (i in 0 until files.length()) total += files.getJSONObject(i).getLong("bytes")
        var done = 0L
        for (i in 0 until files.length()) {
            val f = files.getJSONObject(i)
            val name = f.getString("name"); val size = f.getLong("bytes")
            if (!NAME.matches(name)) throw Exception("Unexpected file in the photo model: $name")
            val local = File(d, name)
            if (local.exists() && local.length() == size) { done += size; onProgress(done, total, name); continue }
            val part = File(d, "$name.part")
            val base = done
            get(BASE + name, part, isCancelled) { got -> onProgress(base + got, total, name) }
            if (part.length() != size) { part.delete(); throw Exception("The download of $name was incomplete — try again") }
            if (local.exists()) local.delete()
            if (!part.renameTo(local)) throw Exception("Couldn't save $name")
            done += size
        }
        File(d, MANIFEST).writeText(manText)   // written last: its presence + sizes = installed
    }

    /** One file → bytes (to == null) or into `to`. */
    private fun get(url: String, to: File?, isCancelled: () -> Boolean, onBytes: (Long) -> Unit = {}): ByteArray {
        Prefs.requireOnline(url, "photo model")
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15_000; c.readTimeout = 60_000; c.instanceFollowRedirects = true
        c.setRequestProperty("User-Agent", "Attune/6.10 (Android; photo model)")
        try {
            val code = c.responseCode
            if (code == 404) throw Exception("The photo model is not published yet — run \"Build the photo fast path\" on GitHub once")
            if (code !in 200..299) throw Exception("The photo model download returned HTTP $code")
            val buf = ByteArray(65536)
            c.inputStream.use { inp ->
                if (to == null) {
                    val out = java.io.ByteArrayOutputStream()
                    var n: Int
                    while (inp.read(buf).also { n = it } > 0) { if (isCancelled()) throw Cancelled(); out.write(buf, 0, n); if (out.size() > 2_000_000) throw Exception("The photo model list is too big") }
                    return out.toByteArray()
                }
                to.outputStream().use { out ->
                    var n: Int; var got = 0L; var last = 0L
                    while (inp.read(buf).also { n = it } > 0) {
                        if (isCancelled()) throw Cancelled()
                        out.write(buf, 0, n); got += n
                        if (got - last > 1_000_000) { last = got; onBytes(got) }
                    }
                    onBytes(got)
                }
            }
            return ByteArray(0)
        } finally { try { c.disconnect() } catch (e: Exception) {} }
    }
}
