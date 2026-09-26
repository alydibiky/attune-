package com.aldibiki.attune

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException

/**
 * Studio: pictures drawn on the phone with stable-diffusion.cpp.
 *
 * The engine is a separate program (lib attune-image*.so, see
 * build-image-engine.sh), started once per picture. So:
 *  - a crash or out-of-memory while drawing ends that program, never Attune;
 *  - every byte it used is returned the moment the picture is saved;
 *  - Stop is instant (the process is killed).
 * GPU first (OpenCL/Adreno) when this APK has it; if the GPU run fails before
 * a picture comes out, the same picture is drawn again on the CPU, and the app
 * remembers — the reason is shown in Studio.
 *
 * Model packs (FLUX.2 klein 4B = diffusion model + text reader + VAE;
 * Real-ESRGAN for ×4 sharpening) live in filesDir/image-models/<pack>/.
 * Pictures are saved in filesDir/studio/ and shown to the page through
 * https://appassets.androidplatform.net/studio/<name> (MainActivity).
 */
object ImageEngine {

    private fun bin(ctx: Context, gpu: Boolean) =
        File(ctx.applicationInfo.nativeLibraryDir, if (gpu) "libattune-image-gpu.so" else "libattune-image.so")

    fun built(ctx: Context) = bin(ctx, false).exists()
    fun gpuBuilt(ctx: Context) = bin(ctx, true).exists()

    fun studioDir(ctx: Context) = File(ctx.filesDir, "studio").apply { mkdirs() }
    private fun packsDir(ctx: Context) = File(ctx.filesDir, "image-models").apply { mkdirs() }
    private fun packDir(ctx: Context, id: String) = File(packsDir(ctx), id.replace(Regex("[^A-Za-z0-9._-]"), "_"))

    private val prefs = { ctx: Context -> ctx.getSharedPreferences("attune", Context.MODE_PRIVATE) }
    fun cpuOnly(ctx: Context) = prefs(ctx).getBoolean("image_cpu", false)
    fun setCpuOnly(ctx: Context, on: Boolean) { prefs(ctx).edit().putBoolean("image_cpu", on).putString("image_note", "").apply() }
    fun note(ctx: Context) = prefs(ctx).getString("image_note", "") ?: ""
    private fun setNote(ctx: Context, s: String) = prefs(ctx).edit().putString("image_note", s).apply()
    /** The last picture that failed, and why — shown by Studio even if the page missed the answer. (v5.19) */
    fun lastError(ctx: Context) = prefs(ctx).getString("image_last_error", "") ?: ""
    fun setLastError(ctx: Context, s: String) = prefs(ctx).edit().putString("image_last_error", s).apply()
    @Volatile var lastBackend: String = ""
        private set

    // ---- packs ------------------------------------------------------------------------
    fun packs(ctx: Context): JSONArray {
        val arr = JSONArray()
        for (d in packsDir(ctx).listFiles() ?: emptyArray()) {
            val meta = File(d, "meta.json"); if (!meta.exists()) continue
            try {
                val j = JSONObject(meta.readText())
                val files = j.getJSONObject("files")
                val ok = files.keys().asSequence().all { File(d, files.getString(it)).exists() }
                if (ok) arr.put(j.put("bytes", (d.listFiles() ?: emptyArray()).sumOf { it.length() }))
            } catch (e: Exception) {}
        }
        return arr
    }

    private fun packFile(ctx: Context, packId: String, role: String): File? {
        val d = packDir(ctx, packId)
        return try {
            val j = JSONObject(File(d, "meta.json").readText())
            j.getJSONObject("files").optString(role).takeIf { it.isNotEmpty() }?.let { File(d, it) }?.takeIf { it.exists() }
        } catch (e: Exception) { null }
    }

    /** arg: {id, label, kind, files:[{role, name, url, size}]} */
    fun install(ctx: Context, a: JSONObject, onProgress: (Long, Long, String) -> Unit, cancelled: () -> Boolean): JSONObject {
        val id = a.getString("id")
        val d = packDir(ctx, id).apply { mkdirs() }
        val list = a.getJSONArray("files")
        val parts = (0 until list.length()).map { list.getJSONObject(it) }
        val total = parts.sumOf { it.optLong("size", 0) }
        val have = (d.listFiles() ?: emptyArray()).sumOf { it.length() }
        val free = DeviceInfo.freeStorageBytes(ctx)
        if (total > 0 && free >= 0 && total - have + 500L * 1024 * 1024 > free)
            throw IOException("Not enough storage: this needs ${ModelStore.gb(total - have)} free and the phone has ${ModelStore.gb(free)}.")
        var base = 0L
        val files = JSONObject()
        for ((i, p) in parts.withIndex()) {
            val name = p.getString("name")
            val rf = ModelStore.RemoteFile(name, p.getString("url"), p.optLong("size", -1))
            val stage = "Downloading ${i + 1} of ${parts.size}: ${p.optString("what", name)}"
            ModelStore.downloadFile(rf, File(d, name), base, total, stage, onProgress, cancelled)
            base += File(d, name).length()
            files.put(p.getString("role"), name)
        }
        // v5.20: the size of every file, so a half-downloaded one is caught before drawing
        val sizes = JSONObject(); for (p in parts) sizes.put(p.getString("role"), File(d, p.getString("name")).length())
        val meta = JSONObject().put("id", id).put("label", a.optString("label", id)).put("kind", a.optString("kind", "draw"))
            .put("files", files).put("sizes", sizes).put("installedAt", System.currentTimeMillis())
            .put("defaults", a.optJSONObject("defaults") ?: JSONObject())
        File(d, "meta.json").writeText(meta.toString())
        return meta
    }

    fun remove(ctx: Context, id: String): Boolean = packDir(ctx, id).deleteRecursively()

    /**
     * v5.20 — is every file of the pack whole? A download cut short (phone off,
     * storage full) leaves a file the engine can't read, and the picture fails
     * with a cryptic "failed to load". Checked against the saved size, and GGUF
     * files must start with "GGUF". → null when fine, or what's wrong.
     */
    fun packProblem(ctx: Context, packId: String): String? {
        val d = packDir(ctx, packId)
        val meta = try { JSONObject(File(d, "meta.json").readText()) } catch (e: Exception) { return "The picture model isn't installed completely — install it again in Studio." }
        val files = meta.getJSONObject("files"); val sizes = meta.optJSONObject("sizes")
        for (role in files.keys()) {
            val f = File(d, files.getString(role))
            if (!f.exists() || f.length() < 1024) return "A picture model file (${f.name}) is missing — remove the model in Studio and install it again."
            val want = sizes?.optLong(role, -1L) ?: -1L
            if (want > 0 && f.length() != want) return "A picture model file (${f.name}) is incomplete (${f.length() / 1_000_000} of ${want / 1_000_000} MB) — remove the model in Studio and install it again."
            if (f.name.endsWith(".gguf", true)) {
                val magic = ByteArray(4); try { f.inputStream().use { it.read(magic) } } catch (e: Exception) {}
                if (String(magic, Charsets.US_ASCII) != "GGUF") return "A picture model file (${f.name}) is damaged — remove the model in Studio and install it again."
            }
        }
        return null
    }

    /**
     * v5.20 — can the picture engine start at all on this phone? Runs it with
     * --help (a second or two) once per app version: a missing library or a
     * blocked program is then reported plainly instead of failing mid-picture.
     */
    @Volatile private var checkedOk = false
    fun selfTest(ctx: Context): String? {
        if (checkedOk) return null
        val ver = try { ctx.packageManager.getPackageInfo(ctx.packageName, 0).lastUpdateTime.toString() } catch (e: Exception) { "?" }
        if (prefs(ctx).getString("image_selftest", "") == ver) { checkedOk = true; return null }
        val b = bin(ctx, false)
        if (!b.exists()) return "This build of the app has no picture engine."
        return try {
            if (!b.canExecute()) b.setExecutable(true)
            val p = ProcessBuilder(b.path, "--help").redirectErrorStream(true).also { it.environment().putAll(env(ctx, false)) }.start()
            val sb = StringBuilder()
            val rd = Thread { try { sb.append(p.inputStream.bufferedReader().readText()) } catch (e: Exception) {} }.apply { isDaemon = true; start() }
            val done = p.waitFor(30, java.util.concurrent.TimeUnit.SECONDS)
            if (!done) { p.destroyForcibly(); null }                  // slow, but it started
            else {
                rd.join(1000)
                val out = sb.toString()
                if (Regex("CANNOT LINK|not found|Permission denied|No such file|error while loading", RegexOption.IGNORE_CASE).containsMatchIn(out) || (p.exitValue() != 0 && !out.contains("usage", true) && !out.contains("--prompt")))
                    "The picture engine can't start on this phone: " + out.lines().firstOrNull { it.isNotBlank() }.orEmpty().take(200)
                else { prefs(ctx).edit().putString("image_selftest", ver).apply(); checkedOk = true; null }
            }
        } catch (e: Exception) { "The picture engine can't start on this phone: " + (e.message ?: e.javaClass.simpleName) }
    }

    /** Pictures in the Studio folder (newest first) — the page adds any it missed. (v5.20) */
    fun list(ctx: Context): JSONArray {
        val arr = JSONArray()
        (studioDir(ctx).listFiles() ?: emptyArray()).filter { it.name.endsWith(".png") && it.length() > 0 }.sortedByDescending { it.lastModified() }.take(200).forEach { f ->
            val (w, h) = size(f)
            arr.put(JSONObject().put("file", f.name).put("url", "https://appassets.androidplatform.net/studio/" + f.name).put("width", w).put("height", h).put("at", f.lastModified()))
        }
        return arr
    }

    // ---- running -----------------------------------------------------------------------
    private var gpuName: String? = null
    private var gpuChecked = false

    private fun env(ctx: Context, gpu: Boolean): Map<String, String> {
        // The GPU program uses the phone's own OpenCL driver, which lives in /vendor.
        val lib = ctx.applicationInfo.nativeLibraryDir
        return if (gpu) mapOf("LD_LIBRARY_PATH" to "/vendor/lib64:/system/vendor/lib64:$lib") else mapOf("LD_LIBRARY_PATH" to lib)
    }

    /**
     * The GPU device name, asked from the GPU program itself.
     * v5.14: the first OpenCL start on a new Adreno compiles its kernels and can
     * take well over the old 20 s — Studio then wrongly decided "the GPU driver
     * did not answer" and drew on the CPU (minutes per picture). Now it waits up
     * to 120 s, says what it is doing, and a timeout is NOT remembered: the next
     * picture tries the GPU again. Only a definite "no GPU device" is kept.
     */
    private fun gpuDevice(ctx: Context, onProgress: (ImageRun.Progress) -> Unit): String? {
        if (gpuChecked) return gpuName
        if (!gpuBuilt(ctx)) { gpuChecked = true; return null }
        onProgress(ImageRun.Progress("gpu"))
        var timedOut = false
        gpuName = try {
            val p = ProcessBuilder(bin(ctx, true).path, "--list-devices").redirectErrorStream(true)
                .also { it.environment().putAll(env(ctx, true)) }.start()
            val sb = StringBuilder()
            val reader = Thread { try { sb.append(p.inputStream.bufferedReader().readText()) } catch (e: Exception) {} }.apply { isDaemon = true; start() }
            if (!p.waitFor(120, java.util.concurrent.TimeUnit.SECONDS)) { timedOut = true; p.destroyForcibly(); null }
            else { reader.join(2000); ImageRun.gpuDevice(sb.toString()) }
        } catch (e: Exception) { null }
        gpuChecked = gpuName != null || !timedOut
        if (gpuName == null && !cpuOnly(ctx)) setNote(ctx, if (timedOut)
            "The graphics chip took too long to start this time, so this picture is drawn on the CPU (slower). Studio will try the graphics chip again next time."
            else "This phone's GPU driver did not answer, so pictures are drawn on the CPU (slower).")
        return gpuName
    }

    private fun threads(): Int = DeviceInfo.bigCores().coerceIn(4, 8)

    class Result(val file: File, val backend: String, val ms: Long, val pausedChat: Boolean, val seed: Long = -1)

    /**
     * Run once on the GPU (if possible), and again on the CPU if the GPU run
     * failed before producing the picture.
     */
    private fun runWithFallback(ctx: Context, out: File, argsFor: (bin: String, backend: String?) -> List<String>,
                                onProgress: (ImageRun.Progress) -> Unit, register: (ImageRun.Job?) -> Unit,
                                valid: (File) -> Boolean = { it.exists() && it.length() > 0 }): String {
        val dev = if (!cpuOnly(ctx)) gpuDevice(ctx, onProgress) else null
        if (dev != null) {
            val job = ImageRun.Job(argsFor(bin(ctx, true).path, "diffusion=$dev,vae=$dev,upscaler=$dev,te=cpu"), env(ctx, true), ctx.cacheDir)
            register(job)
            // v5.13 — a GPU driver that HANGS while preparing the model (no
            // output, no error) used to leave "Loading the picture model…"
            // up forever. If the start makes no progress for 150 s (or is
            // still loading after 5 min), the GPU run is stopped and the
            // picture is drawn on the CPU instead — and Studio remembers.
            val stalled = java.util.concurrent.atomic.AtomicBoolean(false)
            val dog = Thread {
                try {
                    while (true) {
                        Thread.sleep(3000)
                        if (job.cancelled || job.aborted) break
                        val now = System.currentTimeMillis()
                        val early = job.stage == "start" || job.stage == "load"
                        if (early && (now - job.lastOutputAt > 150_000 || now - job.stageSince > 300_000)) { stalled.set(true); job.abort(); break }
                    }
                } catch (e: InterruptedException) {}
            }.apply { isDaemon = true; start() }
            val code = try { job.run(onProgress) } catch (e: Exception) { -1 }
            dog.interrupt()
            register(null)
            if (job.cancelled) throw IOException("Stopped")
            if (code == 0 && valid(out)) { lastBackend = "GPU"; return "GPU" }
            out.delete()
            setCpuOnly(ctx, true)
            setNote(ctx, if (stalled.get()) "The GPU driver stalled while loading the picture model, so Attune switched Studio to the CPU (you can try the GPU again below)."
                else "Drawing on the GPU failed, so Attune switched Studio to the CPU. " + job.lastError())
            onProgress(ImageRun.Progress("start"))
        }
        val job = ImageRun.Job(argsFor(bin(ctx, false).path, "cpu"), env(ctx, false), ctx.cacheDir)
        register(job)
        // v5.14: the CPU run had no watchdog — a run that truly stops making
        // progress now ends with a clear message instead of spinning forever.
        // (One CPU drawing step can take minutes, so the limit is generous.)
        val stuck = java.util.concurrent.atomic.AtomicBoolean(false)
        val dog = Thread {
            try {
                while (true) {
                    Thread.sleep(5000)
                    if (job.cancelled || job.aborted) break
                    if (System.currentTimeMillis() - job.lastOutputAt > 20 * 60_000L) { stuck.set(true); job.abort(); break }
                }
            } catch (e: InterruptedException) {}
        }.apply { isDaemon = true; start() }
        val code = try { job.run(onProgress) } catch (e: Exception) { -1 }
        dog.interrupt()
        register(null)
        if (job.cancelled) throw IOException("Stopped")
        // Killed by Android to free memory (SIGKILL → exit 137 / -9): say so plainly. (v5.17)
        if ((code == 137 || code == 9 || code == -9) && !valid(out)) { out.delete(); throw IOException("Android closed the picture engine to free memory. Close other apps (or pause the chat model in Engine) and try again — “Quick draft” needs the least memory.") }
        if (stuck.get()) { out.delete(); throw IOException("The picture engine made no progress for 20 minutes on the CPU and was stopped. Try a smaller size, or close other apps and try again.") }
        if (code != 0 || !valid(out)) { out.delete(); throw IOException("The picture could not be made. " + job.lastError()) }
        lastBackend = "CPU"
        return "CPU"
    }

    /**
     * a: {pack, prompt, width, height, steps, seed, refImage? (base64 PNG/JPEG)}
     * Memory: a picture model needs ~5-6 GB. If the phone has less free than
     * that, the chat model is paused while drawing and loaded again after.
     */
    fun imagine(ctx: Context, a: JSONObject, onProgress: (ImageRun.Progress) -> Unit, register: (ImageRun.Job?) -> Unit): Result {
        if (!built(ctx)) throw IOException("This build of the app has no picture engine yet.")
        val pack = a.getString("pack")
        packProblem(ctx, pack)?.let { throw IOException(it) }
        onProgress(ImageRun.Progress("check"))
        selfTest(ctx)?.let { throw IOException(it) }
        val diffusion = packFile(ctx, pack, "diffusion") ?: throw IOException("Install the picture model first (Studio).")
        val files = ImageRun.Files(diffusion.path, packFile(ctx, pack, "llm")?.path, packFile(ctx, pack, "vae")?.path)
        val need = listOfNotNull(diffusion, packFile(ctx, pack, "llm"), packFile(ctx, pack, "vae")).sumOf { it.length() } + 1_500_000_000L
        var paused = false
        // v5.19: on phones under 20 GB the chat model is ALWAYS paused while
        // drawing (the fast engine's GPU memory isn't counted in "available",
        // so both models were squeezed in and the picture engine died).
        if ((DeviceInfo.availRamBytes(ctx) < need || DeviceInfo.ramGB(ctx) < 20) && Engine.state == Engine.State.READY) {
            val lock = java.util.concurrent.CountDownLatch(1)
            Engine.stop { lock.countDown() }
            lock.await(90, java.util.concurrent.TimeUnit.SECONDS)
            paused = true
        }
        val lowMem = DeviceInfo.availRamBytes(ctx) < need
        val id = System.currentTimeMillis().toString(36)
        val out = File(studioDir(ctx), "img-$id.png")
        var ref: File? = null
        a.optString("refImage").takeIf { it.isNotEmpty() }?.let { b64 ->
            ref = File(ctx.cacheDir, "ref-$id.png").apply { writeBytes(android.util.Base64.decode(b64.substringAfter("base64,"), android.util.Base64.DEFAULT)) }
        }
        val t0 = System.currentTimeMillis()
        try {
            val w = a.optInt("width", 1024).coerceIn(256, 2048) / 16 * 16
            val h = a.optInt("height", 1024).coerceIn(256, 2048) / 16 * 16
            val seed = if (a.has("seed")) a.getLong("seed") else (System.nanoTime() % 1_000_000_000L)
            fun argsAt(maxSide: Int, low: Boolean): (String, String?) -> List<String> = { b, be ->
                // On the CPU, a picture over 768 px on its long side is drawn at
                // 768: ~45% of the work of 1024 px, minutes instead of a quarter hour. (v5.14)
                val cap = if (be == "cpu") minOf(maxSide, 768) else maxSide
                val k = if (maxOf(w, h) > cap) cap.toDouble() / maxOf(w, h) else 1.0
                val cw = ((w * k).toInt() / 16 * 16).coerceAtLeast(256); val ch = ((h * k).toInt() / 16 * 16).coerceAtLeast(256)
                ImageRun.genArgs(b, files, a.getString("prompt"), out.path, cw, ch, a.optInt("steps", 4).coerceIn(1, 50), seed,
                    threads(), be, ref?.path, a.optDouble("cfg", 1.0), low)
            }
            val backend = try {
                runWithFallback(ctx, out, argsAt(2048, lowMem), onProgress, register)
            } catch (e: IOException) {
                // v5.20: out of memory (Android killed it, or it couldn't allocate)
                // → once more, smaller (512 px) with the text reader kept on storage.
                val m = e.message ?: ""
                if (m == "Stopped" || !Regex("free memory|alloc|out of memory|memory|killed", RegexOption.IGNORE_CASE).containsMatchIn(m)) throw e
                onProgress(ImageRun.Progress("retry"))
                setNote(ctx, "The phone ran short of memory, so this picture was drawn smaller (512 px). Close other apps for full size.")
                runWithFallback(ctx, out, argsAt(512, true), onProgress, register)
            }
            return Result(out, backend, System.currentTimeMillis() - t0, paused, seed)
        } finally {
            ref?.delete()
            if (paused) ModelStore.active(ctx)?.let { m -> Engine.start(ctx, m) { _, _ -> } }
        }
    }

    /** ×4 sharper and bigger, with Real-ESRGAN. */
    fun upscale(ctx: Context, name: String, onProgress: (ImageRun.Progress) -> Unit, register: (ImageRun.Job?) -> Unit): Result {
        if (!built(ctx)) throw IOException("This build of the app has no picture engine yet.")
        val esrgan = packFile(ctx, "esrgan-x4", "upscaler") ?: throw IOException("Install the sharpening model first (Studio).")
        val input = File(studioDir(ctx), File(name).name)
        if (!input.exists()) throw IOException("That picture is gone.")
        val out = File(studioDir(ctx), input.nameWithoutExtension + "-x4.png")
        val t0 = System.currentTimeMillis()
        // sd-cli saves the ORIGINAL picture if the upscaler fails, and still
        // exits 0 — so the result is checked: it must really be 4× bigger.
        val w0 = size(input).first
        val backend = runWithFallback(ctx, out, { b, be -> ImageRun.upscaleArgs(b, esrgan.path, input.path, out.path, threads(), be) },
            onProgress, register, valid = { it.exists() && size(it).first == w0 * 4 })
        return Result(out, backend, System.currentTimeMillis() - t0, false)
    }

    fun size(f: File): Pair<Int, Int> {
        val o = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        android.graphics.BitmapFactory.decodeFile(f.path, o)
        return o.outWidth to o.outHeight
    }

    /** Copy a picture into the phone's Pictures/Attune folder (shows in Gallery / Photos). */
    fun saveToGallery(ctx: Context, name: String): String {
        val f = File(studioDir(ctx), File(name).name)
        if (!f.exists()) throw IOException("That picture is gone.")
        if (android.os.Build.VERSION.SDK_INT < 29) throw IOException("Saving to the gallery needs Android 10 or newer — use Share instead.")
        val cv = android.content.ContentValues().apply {
            put(android.provider.MediaStore.Images.Media.DISPLAY_NAME, "Attune-" + f.name)
            put(android.provider.MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(android.provider.MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Attune")
        }
        val uri = ctx.contentResolver.insert(android.provider.MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv) ?: throw IOException("The gallery refused the picture.")
        ctx.contentResolver.openOutputStream(uri)?.use { o -> f.inputStream().use { it.copyTo(o) } } ?: throw IOException("Could not write the picture.")
        return "Pictures/Attune/Attune-" + f.name
    }

    fun delete(ctx: Context, name: String): Boolean = File(studioDir(ctx), File(name).name).delete()
}
