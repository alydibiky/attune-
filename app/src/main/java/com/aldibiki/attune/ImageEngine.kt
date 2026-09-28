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
    /** The person's own choice (Studio's switch): kept, never undone by an update. */
    fun setCpuOnly(ctx: Context, on: Boolean) {
        prefs(ctx).edit().putBoolean("image_cpu", on).putBoolean("image_cpu_auto", false).putInt("image_gpu_fails", 0).putString("image_note", "").apply()
        if (!on) { gpuChecked = false; gpuName = null }   // ask the graphics chip again on the next picture
    }
    /**
     * v6.1 (Ali: "a mobile has a GPU, why can't I use it for photo generation?"): ONE failed GPU run
     * used to switch Studio to the CPU for good — and the first run on a new Adreno can fail just
     * because it spends minutes preparing its programs, or the chat model still holds GPU memory.
     * Now: the CPU only after 2 GPU failures in a row, a GPU success resets the count, and after an
     * app update a GPU that was switched off automatically gets a fresh try.
     */
    private fun gpuFailed(ctx: Context): Boolean {
        val n = prefs(ctx).getInt("image_gpu_fails", 0) + 1
        val off = n >= 2
        prefs(ctx).edit().putInt("image_gpu_fails", n).apply()
        if (off) prefs(ctx).edit().putBoolean("image_cpu", true).putBoolean("image_cpu_auto", true).apply()
        return off
    }
    private fun gpuWorked(ctx: Context) { prefs(ctx).edit().putInt("image_gpu_fails", 0).apply() }
    private fun retryGpuAfterUpdate(ctx: Context) {
        val p = prefs(ctx)
        val ver = try { ctx.packageManager.getPackageInfo(ctx.packageName, 0).lastUpdateTime } catch (e: Exception) { 0L }
        if (p.getLong("image_cpu_ver", -1L) == ver) return
        val e = p.edit().putLong("image_cpu_ver", ver)
        if (p.getBoolean("image_cpu", false) && p.getBoolean("image_cpu_auto", false)) {
            e.putBoolean("image_cpu", false).putBoolean("image_cpu_auto", false).putInt("image_gpu_fails", 0).putString("image_note", "")
            gpuChecked = false; gpuName = null
            log(ctx, "App updated: Studio tries the graphics chip again (it had been switched off automatically).")
        }
        e.apply()
    }
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
        // exact sizes when known; otherwise the approximate size, only for the progress bar (v5.28)
        val total = parts.sumOf { it.optLong("size", 0).takeIf { n -> n > 0 } ?: it.optLong("approx", 0) }
        val have = (d.listFiles() ?: emptyArray()).sumOf { it.length() }
        val free = DeviceInfo.freeStorageBytes(ctx)
        if (total > 0 && free >= 0 && total - have + 500L * 1024 * 1024 > free)
            throw IOException("Not enough storage: this needs ${ModelStore.gb(total - have)} free and the phone has ${ModelStore.gb(free)}.")
        var base = 0L
        val files = JSONObject()
        for ((i, p) in parts.withIndex()) {
            val name = p.getString("name")
            val stage = "Downloading ${i + 1} of ${parts.size}: ${p.optString("what", name)}"
            // v5.28: a file may list several links; one that doesn't exist (404) moves on to the next
            val links = p.optJSONArray("urls")?.let { u -> (0 until u.length()).map { u.getString(it) } } ?: listOf(p.getString("url"))
            var lastErr: IOException? = null
            for (link in links) {
                try {
                    ModelStore.downloadFile(ModelStore.RemoteFile(name, link, p.optLong("size", -1)), File(d, name), base, total, stage, onProgress, cancelled)
                    lastErr = null; break
                } catch (e: ModelStore.NotFound) { lastErr = e; File(d, "$name.part").delete() }
            }
            lastErr?.let { throw IOException("The picture model could not be downloaded: ${it.message}. Check the connection and try again.") }
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
    private var devicesOut = ""

    /** v5.32: every Studio run leaves its story in Engine → Engine log (what ran, how long, the engine's last lines). */
    fun log(ctx: Context, text: String) {
        try {
            val f = File(ctx.filesDir, "engine.log")
            if (f.length() > 200_000) f.writeText(f.readText().takeLast(100_000))
            f.appendText("\nStudio (${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())}): $text\n")
        } catch (e: Exception) {}
    }
    private fun logRun(ctx: Context, what: String, job: ImageRun.Job, code: Int, t0: Long) =
        log(ctx, "$what finished · exit $code · ${(System.currentTimeMillis() - t0) / 1000} s · last stage: ${job.stage}" +
            (if (job.cancelled) " · stopped by you" else "") + "\n" + job.tailText())
    /** v5.28 — "gpu" (the graphics chip works), "cpu" (it doesn't, or is switched off), or "" (not tried yet). */
    fun gpuState(ctx: Context): String = when {
        cpuOnly(ctx) || !gpuBuilt(ctx) -> "cpu"
        lastBackend == "GPU" || (gpuChecked && gpuName != null) -> "gpu"
        gpuChecked || lastBackend == "CPU" -> "cpu"
        else -> ""
    }

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
        if (!gpuBuilt(ctx)) {
            gpuChecked = true
            log(ctx, "GPU check: this build has no GPU picture engine (libattune-image-gpu.so missing)")
            if (!cpuOnly(ctx)) setNote(ctx, "This version of Attune has no graphics-chip picture engine, so pictures are drawn on the CPU (slower). An update adds it.")
            return null
        }
        onProgress(ImageRun.Progress("gpu"))
        var timedOut = false
        gpuName = try {
            val p = ProcessBuilder(bin(ctx, true).path, "--list-devices").redirectErrorStream(true)
                .also { it.environment().putAll(env(ctx, true)) }.start()
            val sb = StringBuilder()
            val reader = Thread { try { sb.append(p.inputStream.bufferedReader().readText()) } catch (e: Exception) {} }.apply { isDaemon = true; start() }
            if (!p.waitFor(120, java.util.concurrent.TimeUnit.SECONDS)) { timedOut = true; p.destroyForcibly(); null }
            else { reader.join(2000); devicesOut = sb.toString().trim().take(600); ImageRun.gpuDevice(sb.toString()) }
        } catch (e: Exception) { devicesOut = "could not start: " + (e.message ?: e.javaClass.simpleName); null }
        log(ctx, "GPU check: " + (gpuName ?: (if (timedOut) "timed out after 120 s" else "no GPU device")) + "\n  " + devicesOut.replace("\n", "\n  "))
        gpuChecked = gpuName != null || !timedOut
        if (gpuName == null && !cpuOnly(ctx)) setNote(ctx, if (timedOut)
            "The graphics chip took too long to start this time, so this picture is drawn on the CPU (slower). Studio will try the graphics chip again next time."
            else "This phone's GPU driver did not answer, so pictures are drawn on the CPU (slower).")
        return gpuName
    }

    // v5.32: one big core is left for the screen — all of them made the phone stutter ("glitching")
    private fun threads(): Int = (DeviceInfo.bigCores() - 1).coerceIn(3, 7)

    class Result(val file: File, val backend: String, val ms: Long, val pausedChat: Boolean, val seed: Long = -1)

    /**
     * Run once on the GPU (if possible), and again on the CPU if the GPU run
     * failed before producing the picture.
     */
    private fun runWithFallback(ctx: Context, out: File, argsFor: (bin: String, backend: String?) -> List<String>,
                                onProgress: (ImageRun.Progress) -> Unit, register: (ImageRun.Job?) -> Unit,
                                valid: (File) -> Boolean = { it.exists() && it.length() > 0 }): String {
        retryGpuAfterUpdate(ctx)
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
            val tg = System.currentTimeMillis()
            log(ctx, "drawing on the GPU ($dev), ${threads()} threads")
            val code = try { job.run(onProgress) } catch (e: Exception) { -1 }
            dog.interrupt()
            register(null)
            logRun(ctx, "GPU run", job, code, tg)
            if (job.cancelled) throw IOException("Stopped")
            if (code == 0 && valid(out)) { lastBackend = "GPU"; gpuWorked(ctx); return "GPU" }
            out.delete()
            val off = gpuFailed(ctx)
            log(ctx, "GPU run failed (" + (if (stalled.get()) "stalled while loading" else "exit $code") + ") — " + (if (off) "2nd time in a row: Studio switched to the CPU" else "the next picture tries the graphics chip again"))
            setNote(ctx, if (off) (if (stalled.get()) "The GPU driver stalled twice while loading the picture model, so Attune switched Studio to the CPU (you can try the GPU again below)."
                else "Drawing on the GPU failed twice, so Attune switched Studio to the CPU. " + job.lastError())
                else "This picture was drawn on the CPU because the graphics chip didn't finish; the next picture tries the graphics chip again.")
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
                    val quiet = System.currentTimeMillis() - job.lastOutputAt
                    // loading a picture model takes seconds; 4 silent minutes there means it hangs (v5.32)
                    if (quiet > 20 * 60_000L || ((job.stage == "start" || job.stage == "load") && quiet > 4 * 60_000L)) { stuck.set(true); job.abort(); break }
                }
            } catch (e: InterruptedException) {}
        }.apply { isDaemon = true; start() }
        val tc = System.currentTimeMillis()
        log(ctx, "drawing on the CPU, ${threads()} threads")
        val code = try { job.run(onProgress) } catch (e: Exception) { -1 }
        dog.interrupt()
        register(null)
        logRun(ctx, "CPU run", job, code, tc)
        if (job.cancelled) throw IOException("Stopped")
        // Killed by Android to free memory (SIGKILL → exit 137 / -9): say so plainly. (v5.17)
        if ((code == 137 || code == 9 || code == -9) && !valid(out)) { out.delete(); throw IOException("Android closed the picture engine to free memory. Close other apps (or pause the chat model in Engine) and try again — “Quick draft” needs the least memory.") }
        if (stuck.get()) { out.delete(); throw IOException(if (job.stage == "start" || job.stage == "load") "The picture engine stopped responding while loading the model, so it was stopped. Engine → Engine log shows its last lines — send them to support." else "The picture engine made no progress for 20 minutes on the CPU and was stopped. Try a smaller size, or close other apps and try again.") }
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
        // v5.28: "model" = one all-in-one file (SD-Turbo); "diffusion" + "llm" + "vae" = FLUX.2 klein
        val whole = packFile(ctx, pack, "model")
        val diffusion = whole ?: packFile(ctx, pack, "diffusion") ?: throw IOException("Install the picture model first (Studio).")
        val files = ImageRun.Files(diffusion.path, packFile(ctx, pack, "llm")?.path, packFile(ctx, pack, "vae")?.path, whole != null)
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
        log(ctx, "new picture · $pack · ${diffusion.name} ${diffusion.length() / 1_000_000} MB · free RAM ${DeviceInfo.availRamBytes(ctx) / 1_000_000} MB" +
            (if (paused) " · chat model paused" else "") + (if (lowMem) " · low memory mode" else ""))
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

    /**
     * v5.42 (Ali: "Studio took 10 min to sharpen and only finished 6 of 25"): Real-ESRGAN on a
     * phone's CPU needs ~25 s for each of the 25 tiles. This is the instant way: ×2 with smooth
     * filtering, then an unsharp mask (edges made crisper) — under a second, no download.
     */
    fun sharpenFast(ctx: Context, name: String): Result {
        val input = File(studioDir(ctx), File(name).name)
        if (!input.exists()) throw IOException("That picture is gone.")
        val t0 = System.currentTimeMillis()
        val src = android.graphics.BitmapFactory.decodeFile(input.path) ?: throw IOException("Couldn't open that picture.")
        val w = src.width * 2; val h = src.height * 2
        val big = android.graphics.Bitmap.createScaledBitmap(src, w, h, true)
        src.recycle()
        val px = IntArray(w * h); big.getPixels(px, 0, w, 0, 0, w, h)
        big.recycle()   // (a scaled bitmap may be immutable — the result is a new bitmap made from the pixels)
        val out = IntArray(w * h)
        val amount = 0.7f
        for (y in 0 until h) {
            val y0 = if (y > 0) y - 1 else y; val y1 = if (y < h - 1) y + 1 else y
            for (x in 0 until w) {
                val x0 = if (x > 0) x - 1 else x; val x1 = if (x < w - 1) x + 1 else x
                val c = px[y * w + x]
                // 3×3 blur, one channel at a time
                var r = 0; var g = 0; var b = 0
                var k = 0
                while (k < 9) {
                    val yy = when (k / 3) { 0 -> y0; 1 -> y; else -> y1 }; val xx = when (k % 3) { 0 -> x0; 1 -> x; else -> x1 }
                    val q = px[yy * w + xx]; r += (q shr 16) and 255; g += (q shr 8) and 255; b += q and 255
                    k++
                }
                val cr = (c shr 16) and 255; val cg = (c shr 8) and 255; val cb = c and 255
                val nr = (cr + amount * (cr - r / 9f)).toInt().coerceIn(0, 255)
                val ng = (cg + amount * (cg - g / 9f)).toInt().coerceIn(0, 255)
                val nb = (cb + amount * (cb - b / 9f)).toInt().coerceIn(0, 255)
                out[y * w + x] = (c and -0x1000000) or (nr shl 16) or (ng shl 8) or nb
            }
        }
        val res = android.graphics.Bitmap.createBitmap(out, w, h, android.graphics.Bitmap.Config.ARGB_8888)
        val file = File(studioDir(ctx), input.nameWithoutExtension + "-x2.png")
        file.outputStream().use { res.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
        res.recycle()
        return Result(file, "fast", System.currentTimeMillis() - t0, false)
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
