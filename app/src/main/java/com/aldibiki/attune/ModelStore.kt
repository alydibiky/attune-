package com.aldibiki.attune

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest

/**
 * Installed models live in filesDir/models/<id>/ with a meta.json beside the
 * weights. Nothing is ever updated behind the user's back: a model file, once
 * installed, is the same file until they delete it — so a prompt that works
 * today gives the same kind of answer in six months.
 */
object ModelStore {

    class Cancelled : IOException("Cancelled")

    data class RemoteFile(val name: String, val url: String, val size: Long)
    data class Plan(val parts: List<RemoteFile>, val mmproj: RemoteFile?) {
        val totalBytes: Long get() = parts.sumOf { it.size.coerceAtLeast(0) } + (mmproj?.size?.coerceAtLeast(0) ?: 0)
    }

    data class Installed(
        val id: String, val label: String, val dir: File,
        val modelFile: File, val partCount: Int, val mmproj: File?,
        val sizeBytes: Long, val mmprojBytes: Long, val ctx: Int,
        val source: String, val quant: String, val sha256: String?, val installedAt: Long,
    ) {
        fun toJson(active: Boolean): JSONObject = JSONObject()
            .put("id", id).put("label", label).put("quant", quant).put("source", source)
            .put("sizeBytes", sizeBytes).put("mmprojBytes", mmprojBytes)
            // A .litertlm Gemma 4 carries its own photo reader inside the one file.
            .put("vision", (mmproj != null && mmproj.exists()) || modelFile.name.endsWith(".litertlm", true))
            .put("engine", if (modelFile.name.endsWith(".litertlm", true)) "litert" else "llama")
            .put("ctx", ctx).put("sha256", sha256 ?: JSONObject.NULL)
            .put("installedAt", installedAt).put("active", active)
    }

    private const val UA = "Attune/1.0 (Android; on-device)"

    fun root(ctx: Context): File = File(ctx.filesDir, "models").apply { mkdirs() }
    private fun dirFor(ctx: Context, id: String) = File(root(ctx), id.replace(Regex("[^A-Za-z0-9._-]"), "_"))

    fun list(ctx: Context): List<Installed> =
        (root(ctx).listFiles() ?: emptyArray()).mapNotNull { read(it) }.sortedBy { it.installedAt }

    fun get(ctx: Context, id: String): Installed? = read(dirFor(ctx, id))

    fun active(ctx: Context): Installed? {
        val id = Prefs.activeModel(ctx) ?: return null
        return get(ctx, id)
    }

    fun remove(ctx: Context, id: String): Boolean {
        val d = dirFor(ctx, id)
        if (Prefs.activeModel(ctx) == id) Prefs.setActiveModel(ctx, null)
        return d.deleteRecursively()
    }

    private fun read(dir: File): Installed? {
        val meta = File(dir, "meta.json")
        if (!meta.exists()) return null
        return try {
            val j = JSONObject(meta.readText())
            val model = File(dir, j.getString("modelFile"))
            if (!model.exists()) return null
            val mm = j.optString("mmproj", "").takeIf { it.isNotEmpty() }?.let { File(dir, it) }
            Installed(
                id = j.getString("id"), label = j.optString("label", j.getString("id")), dir = dir,
                modelFile = model, partCount = j.optInt("partCount", 1), mmproj = mm?.takeIf { it.exists() },
                sizeBytes = j.optLong("sizeBytes", model.length()), mmprojBytes = j.optLong("mmprojBytes", 0),
                ctx = j.optInt("ctx", 8192), source = j.optString("source", ""), quant = j.optString("quant", ""),
                sha256 = j.optString("sha256", "").takeIf { it.isNotEmpty() },
                installedAt = j.optLong("installedAt", dir.lastModified()),
            )
        } catch (e: Exception) { null }
    }

    // ---------------------------------------------------------------------
    // Finding the right files
    // ---------------------------------------------------------------------

    private fun enc(path: String) = path.split("/").joinToString("/") { URLEncoder.encode(it, "UTF-8").replace("+", "%20") }

    /**
     * Resolve "the Q4_K_M build in unsloth/Qwen3.5-4B-GGUF" to exact files by
     * asking Hugging Face for the repo listing on the phone. Handles models
     * split into several parts and picks the vision (mmproj) file if wanted.
     */
    fun resolveHf(repo: String, quantSpec: String, vision: Boolean): Plan {
        val listing = httpGetString("https://huggingface.co/api/models/$repo/tree/main?recursive=true")
        val arr = JSONArray(listing)
        data class F(val path: String, val size: Long)
        val files = ArrayList<F>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            if (o.optString("type") != "file") continue
            val path = o.getString("path")
            if (!path.lowercase().endsWith(".gguf")) continue
            val size = o.optJSONObject("lfs")?.optLong("size", -1L)?.takeIf { it > 0 } ?: o.optLong("size", -1L)
            files.add(F(path, size))
        }
        if (files.isEmpty()) throw IOException("No GGUF files in $repo")

        val quant = quantSpec.trim().split(Regex("\\s+")).last().lowercase()
        val wantQat = quantSpec.contains("QAT", ignoreCase = true)
        val boundary = Regex("(^|[-_./])" + Regex.escape(quant) + "([-_./]|$)")
        val candidates = files.filter { f ->
            val p = f.path.lowercase()
            val base = p.substringAfterLast('/')
            !base.startsWith("mmproj") && boundary.containsMatchIn(p) &&
                (quant.startsWith("ud-") || !p.contains("ud-$quant"))
        }
        if (candidates.isEmpty()) throw IOException("No $quantSpec build found in $repo")

        // Group split parts: name-00001-of-00003.gguf
        val splitRe = Regex("-(\\d{5})-of-(\\d{5})\\.gguf$", RegexOption.IGNORE_CASE)
        val groups = candidates.groupBy { splitRe.replace(it.path, "") }
        val best = groups.entries.sortedWith(compareBy(
            { if (wantQat && !it.key.contains("qat", true)) 1 else 0 },
            { it.key.length },
        )).first().value.sortedBy { it.path }

        val parts = best.map { RemoteFile(it.path.substringAfterLast('/'), "https://huggingface.co/$repo/resolve/main/${enc(it.path)}", it.size) }

        var mm: RemoteFile? = null
        if (vision) {
            val mmFiles = files.filter { it.path.substringAfterLast('/').lowercase().startsWith("mmproj") }
            val pref = listOf("f16", "bf16", "q8_0", "f32")
            val pick = mmFiles.sortedWith(compareBy({ f ->
                val n = f.path.lowercase(); pref.indexOfFirst { n.contains(it) }.let { if (it < 0) 99 else it }
            }, { it.size })).firstOrNull()
            if (pick != null) mm = RemoteFile("mmproj.gguf", "https://huggingface.co/$repo/resolve/main/${enc(pick.path)}", pick.size)
        }
        return Plan(parts, mm)
    }

    /** Bring-your-own model: a direct https link to a .gguf (and optionally its mmproj). */
    fun resolveUrl(url: String, mmprojUrl: String?): Plan {
        require(url.startsWith("https://")) { "Use an https:// link to a .gguf or .litertlm file" }
        val name = url.substringAfterLast('/').substringBefore('?').ifEmpty { "model.gguf" }
        val mm = mmprojUrl?.takeIf { it.startsWith("https://") }?.let { RemoteFile("mmproj.gguf", it, contentLength(it)) }
        return Plan(listOf(RemoteFile(name, url, contentLength(url))), mm)
    }

    // ---------------------------------------------------------------------
    // Download (resumable) and install
    // ---------------------------------------------------------------------

    fun install(
        ctx: Context, id: String, label: String, ctxLen: Int, source: String, quant: String, plan: Plan,
        onProgress: (done: Long, total: Long, stage: String) -> Unit, cancelled: () -> Boolean,
    ): Installed {
        val dir = dirFor(ctx, id).apply { mkdirs() }
        val total = plan.totalBytes
        val have = (dir.listFiles() ?: emptyArray()).sumOf { it.length() }
        val free = DeviceInfo.freeStorageBytes(ctx)
        if (total > 0 && free >= 0 && total - have + 300L * 1024 * 1024 > free) {
            throw IOException("Not enough storage: this needs ${gb(total - have)} free and the phone has ${gb(free)}.")
        }

        var base = 0L
        for ((i, p) in plan.parts.withIndex()) {
            val stage = if (plan.parts.size > 1) "Downloading the model (part ${i + 1} of ${plan.parts.size})" else "Downloading the model"
            downloadFile(p, File(dir, p.name), base, total, stage, onProgress, cancelled)
            base += File(dir, p.name).length()
        }
        plan.mmproj?.let { m ->
            downloadFile(m, File(dir, m.name), base, total, "Downloading the photo reader", onProgress, cancelled)
            base += File(dir, m.name).length()
        }

        val modelBytes = plan.parts.sumOf { File(dir, it.name).length() }
        val meta = JSONObject()
            .put("id", id).put("label", label).put("source", source).put("quant", quant)
            .put("modelFile", plan.parts.first().name).put("partCount", plan.parts.size)
            .put("mmproj", plan.mmproj?.name ?: "")
            .put("sizeBytes", modelBytes).put("mmprojBytes", plan.mmproj?.let { File(dir, it.name).length() } ?: 0)
            .put("ctx", ctxLen).put("installedAt", System.currentTimeMillis())
        File(dir, "meta.json").writeText(meta.toString())
        return read(dir) ?: throw IOException("Install finished but the model could not be read back")
    }

    internal fun gb(b: Long) = "%.1f GB".format(b / 1e9)

    private fun open(url: String, from: Long): HttpURLConnection {
        Prefs.requireOnline(url, "model download")
        var u = url
        repeat(6) {
            val c = URL(u).openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.connectTimeout = 20_000
            c.readTimeout = 60_000
            c.setRequestProperty("User-Agent", UA)
            if (from > 0) c.setRequestProperty("Range", "bytes=$from-")
            val code = c.responseCode
            if (code in 300..399) {
                val loc = c.getHeaderField("Location") ?: throw IOException("Redirect without location")
                u = URL(URL(u), loc).toString()
                c.disconnect()
                return@repeat
            }
            return c
        }
        throw IOException("Too many redirects")
    }

    internal fun downloadFile(
        rf: RemoteFile, dest: File, base: Long, total: Long, stage: String,
        onProgress: (Long, Long, String) -> Unit, cancelled: () -> Boolean,
    ) {
        if (dest.exists() && (rf.size <= 0 || dest.length() == rf.size)) {
            onProgress(base + dest.length(), total, stage); return
        }
        val part = File(dest.path + ".part")
        var attempt = 0
        while (true) {
            if (cancelled()) throw Cancelled()
            var have = if (part.exists()) part.length() else 0L
            if (rf.size > 0 && have > rf.size) { part.delete(); have = 0 }
            if (rf.size > 0 && have == rf.size) break
            try {
                val c = open(rf.url, have)
                val code = c.responseCode
                if (code == 416 && rf.size > 0 && have == rf.size) { c.disconnect(); break }
                if (code !in 200..299) throw IOException("Download failed (HTTP $code)")
                val append = code == 206 && have > 0
                if (!append) have = 0
                c.inputStream.use { inp ->
                    FileOutputStream(part, append).use { out ->
                        val buf = ByteArray(256 * 1024)
                        var lastReport = 0L
                        while (true) {
                            val n = inp.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            have += n
                            val now = System.currentTimeMillis()
                            if (now - lastReport > 400) { lastReport = now; onProgress(base + have, total, stage) }
                            if (cancelled()) throw Cancelled()
                        }
                    }
                }
                c.disconnect()
                break
            } catch (e: Cancelled) {
                throw e
            } catch (e: IOException) {
                attempt++
                if (attempt >= 6) throw IOException("The download kept failing: ${e.message}. Check the connection and try again — it will resume.")
                Thread.sleep(1500L * attempt)
            }
        }
        if (rf.size > 0 && part.length() != rf.size) throw IOException("The downloaded file is incomplete. Try again — it will resume.")
        if (!part.renameTo(dest)) throw IOException("Could not save the model file")
        onProgress(base + dest.length(), total, stage)
    }

    private fun contentLength(url: String): Long = try {
        val c = open(url, 0)
        val n = c.getHeaderField("Content-Length")?.toLongOrNull() ?: -1L
        c.disconnect(); n
    } catch (e: Exception) { -1L }

    private fun httpGetString(url: String): String {
        val c = open(url, 0)
        if (c.responseCode !in 200..299) throw IOException("Hugging Face returned HTTP ${c.responseCode}")
        return c.inputStream.bufferedReader().use { it.readText() }
    }

    // ---------------------------------------------------------------------
    // Proof of which weights are in use
    // ---------------------------------------------------------------------

    fun sha256(ctx: Context, id: String): String {
        val m = get(ctx, id) ?: throw IOException("Model not installed")
        m.sha256?.let { return it }
        val md = MessageDigest.getInstance("SHA-256")
        val parts = (m.dir.listFiles() ?: emptyArray())
            .filter { (it.name.endsWith(".gguf") && it.name != "mmproj.gguf") || it.name.endsWith(".litertlm") }.sortedBy { it.name }
        val buf = ByteArray(1 shl 20)
        for (f in parts) f.inputStream().use { s -> while (true) { val n = s.read(buf); if (n < 0) break; md.update(buf, 0, n) } }
        val hex = md.digest().joinToString("") { "%02x".format(it) }
        val metaFile = File(m.dir, "meta.json")
        try { metaFile.writeText(JSONObject(metaFile.readText()).put("sha256", hex).toString()) } catch (e: Exception) {}
        return hex
    }
}
