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
        val meta = JSONObject().put("id", id).put("label", a.optString("label", id)).put("kind", a.optString("kind", "draw"))
            .put("files", files).put("installedAt", System.currentTimeMillis())
            .put("defaults", a.optJSONObject("defaults") ?: JSONObject())
        File(d, "meta.json").writeText(meta.toString())
        return meta
    }

    fun remove(ctx: Context, id: String): Boolean = packDir(ctx, id).deleteRecursively()

    // ---- running -----------------------------------------------------------------------
    private var gpuName: String? = null
    private var gpuChecked = false

    private fun env(ctx: Context, gpu: Boolean): Map<String, String> {
        // The GPU program uses the phone's own OpenCL driver, which lives in /vendor.
        val lib = ctx.applicationInfo.nativeLibraryDir
        return if (gpu) mapOf("LD_LIBRARY_PATH" to "/vendor/lib64:/system/vendor/lib64:$lib") else mapOf("LD_LIBRARY_PATH" to lib)
    }

    /** The GPU device name, asked once from the GPU program itself. */
    private fun gpuDevice(ctx: Context): String? {
        if (gpuChecked) return gpuName
        gpuChecked = true
        if (!gpuBuilt(ctx)) return null
        gpuName = try {
            val p = ProcessBuilder(bin(ctx, true).path, "--list-devices").redirectErrorStream(true)
                .also { it.environment().putAll(env(ctx, true)) }.start()
            val out = p.inputStream.bufferedReader().readText()
            if (!p.waitFor(20, java.util.concurrent.TimeUnit.SECONDS)) { p.destroyForcibly(); null } else ImageRun.gpuDevice(out)
        } catch (e: Exception) { null }
        if (gpuName == null && !cpuOnly(ctx)) setNote(ctx, "This phone's GPU driver did not answer, so pictures are drawn on the CPU (slower).")
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
        val dev = if (!cpuOnly(ctx)) gpuDevice(ctx) else null
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
        val code = try { job.run(onProgress) } catch (e: Exception) { -1 }
        register(null)
        if (job.cancelled) throw IOException("Stopped")
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
        val diffusion = packFile(ctx, pack, "diffusion") ?: throw IOException("Install the picture model first (Studio).")
        val files = ImageRun.Files(diffusion.path, packFile(ctx, pack, "llm")?.path, packFile(ctx, pack, "vae")?.path)
        val need = listOfNotNull(diffusion, packFile(ctx, pack, "llm"), packFile(ctx, pack, "vae")).sumOf { it.length() } + 1_500_000_000L
        var paused = false
        if (DeviceInfo.availRamBytes(ctx) < need && Engine.state == Engine.State.READY) {
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
            val backend = runWithFallback(ctx, out, { b, be ->
                ImageRun.genArgs(b, files, a.getString("prompt"), out.path, w, h, a.optInt("steps", 4).coerceIn(1, 50), seed,
                    threads(), be, ref?.path, a.optDouble("cfg", 1.0), lowMem)
            }, onProgress, register)
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
