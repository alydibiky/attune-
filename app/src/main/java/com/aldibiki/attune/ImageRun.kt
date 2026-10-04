package com.aldibiki.attune

import java.io.File
import java.io.InputStream

/**
 * Running the picture engine (stable-diffusion.cpp's sd-cli) as a separate
 * process and reading its progress. Plain JVM code, no Android — so it is
 * tested on a desktop against the real sd-cli (tests/image_run/).
 */
object ImageRun {

    /** What the person sees: a stage and, while drawing, step n of N. */
    data class Progress(val stage: String, val step: Int = 0, val total: Int = 0, val line: String = "")

    private val BAR = Regex("\\|([=>#\\s-]*)\\|\\s*(\\d+)/(\\d+)")
    private val ANSI = Regex("\u001B\\[[0-9;]*[A-Za-z]")

    /** "|=====>    | 2/4 - 3.20s/it" → (2, 4, '='), "|####   | 551/702 - 248MB/s" → (551, 702, '#'). */
    fun parseBar(s: String): Triple<Int, Int, Char>? {
        val m = BAR.find(s) ?: return null
        val kind = if (m.groupValues[1].contains('#')) '#' else '='
        return Triple(m.groupValues[2].toInt(), m.groupValues[3].toInt(), kind)
    }

    /** The stage a log line announces, or null if it announces none. */
    fun stageOf(line: String): String? {
        val l = line.lowercase()
        return when {
            l.contains("upscal") && !l.contains("hires") -> "upscale"
            l.contains("loading ") && (l.contains(" from '") || l.contains("tensors")) -> "load"
            l.contains("generate_image") || l.contains("get_learned_condition") && !l.contains("completed") -> "prompt"
            l.contains("sampling using") || l.contains("get_learned_condition completed") -> "draw"
            l.contains("decoding") || l.contains("decode_first_stage") && !l.contains("completed") -> "develop"
            l.contains("save result image") -> "save"
            else -> null
        }
    }

    /** Folds one piece of output into the running progress. */
    fun advance(p: Progress, piece: String): Progress {
        val s = ANSI.replace(piece, "")
        val bar = parseBar(s)
        if (bar != null) {
            val (n, total, kind) = bar
            return when {
                // v5.14: a finished loading bar means the model is in memory and
                // the engine has moved on to reading the description — say so,
                // instead of "Loading… 100%" for the minutes that follow.
                kind == '#' && p.stage != "upscale" && total > 0 && n >= total -> Progress("prompt")
                kind == '#' -> if (p.stage == "upscale") p.copy(step = n, total = total) else Progress("load", n, total)
                p.stage == "upscale" -> p.copy(step = n, total = total)
                p.stage == "develop" -> p.copy(step = n, total = total)
                else -> Progress("draw", n, total)
            }
        }
        val st = stageOf(s) ?: return p
        return if (st == p.stage) p else Progress(st)
    }

    /** One engine output line, short enough for a status line. */
    fun shortLine(s: String): String = s.replace(Regex("^\\[[A-Z]+\\s*\\]\\s*[\\w./-]+:\\d+\\s*-\\s*"), "").trim().take(110)

    /** Output split on \n and \r (progress bars redraw with \r). */
    fun readPieces(input: InputStream, onPiece: (String) -> Unit) {
        val rd = input.bufferedReader(Charsets.UTF_8)
        val sb = StringBuilder()
        while (true) {
            val c = rd.read()
            if (c < 0) break
            if (c == '\n'.code || c == '\r'.code) {
                if (sb.isNotEmpty()) { onPiece(sb.toString()); sb.setLength(0) }
            } else sb.append(c.toChar())
        }
        if (sb.isNotEmpty()) onPiece(sb.toString())
    }

    /** One run of the engine. `onProgress` is called whenever the stage or step changes. */
    class Job(private val cmd: List<String>, private val env: Map<String, String>, private val dir: File) {
        @Volatile private var proc: Process? = null
        @Volatile var cancelled = false
            private set
        val tail = ArrayDeque<String>()
        /** When the engine last printed anything, and the stage it is in (for the stall watchdog). */
        @Volatile var lastOutputAt = System.currentTimeMillis()
        @Volatile var stage = "start"
        @Volatile var stageSince = System.currentTimeMillis()
        @Volatile var aborted = false
            private set

        fun run(onProgress: (Progress) -> Unit): Int {
            val pb = ProcessBuilder(cmd).directory(dir).redirectErrorStream(true)
            pb.environment().putAll(env)
            val p = pb.start()
            proc = p
            if (cancelled) p.destroyForcibly()
            var prog = Progress("start")
            onProgress(prog)
            var lastEmit = 0L
            readPieces(p.inputStream) { piece ->
                val now = System.currentTimeMillis()
                lastOutputAt = now
                val clean = ANSI.replace(piece, "")
                synchronized(tail) { tail.addLast(clean); while (tail.size > 60) tail.removeFirst() }
                val next = advance(prog, piece)
                if (next != prog) {
                    if (next.stage != prog.stage) { stage = next.stage; stageSince = now }
                    prog = next; onProgress(prog.copy(line = shortLine(clean))); lastEmit = now
                } else if (now - lastEmit > 1500) {
                    // v5.32: what the engine is doing right now, shown under Studio's status —
                    // never a silent "Loading…" for minutes (Ali: 4 min with no sign of life)
                    onProgress(prog.copy(line = shortLine(clean))); lastEmit = now
                }
            }
            return p.waitFor()
        }

        fun cancel() { cancelled = true; proc?.destroyForcibly() }
        /** Stopped by the app itself (a stalled GPU start) — not by the person. */
        fun abort() { aborted = true; proc?.destroyForcibly() }

        /** The last lines of output, for Engine → Engine log. */
        fun tailText(n: Int = 14): String = synchronized(tail) { tail.toList().takeLast(n).joinToString("\n") { "  " + it.take(200) } }

        /** The most telling line of the output, for an error message. */
        fun lastError(): String = synchronized(tail) {
            (tail.lastOrNull { it.contains("error", true) || it.contains("failed", true) || it.contains("CANNOT LINK", true) } ?: tail.lastOrNull() ?: "")
                .replace(Regex("^\\[[A-Z]+\\s*\\]\\s*[\\w./-]+:\\d+\\s*-\\s*"), "").take(300)
        }
    }

    /** Model files for one picture. */
    data class Files(val diffusion: String, val llm: String?, val vae: String?, val allInOne: Boolean = false, val taesd: String? = null)

    /** The command for one picture. `refImage` turns it into an edit of that picture. */
    fun genArgs(
        bin: String, f: Files, prompt: String, out: String, width: Int, height: Int, steps: Int, seed: Long,
        threads: Int, backend: String?, refImage: String?, cfg: Double = 1.0, lowMemory: Boolean = false,
    ): List<String> {
        // an all-in-one checkpoint (SD-Turbo) is loaded with -m; FLUX.2 klein comes in three files
        val a = if (f.allInOne) arrayListOf(bin, "-m", f.diffusion) else arrayListOf(bin, "--diffusion-model", f.diffusion)
        f.llm?.let { a += listOf("--llm", it) }
        f.vae?.let { a += listOf("--vae", it) }
        // v6.19: tiny colour decoder (Turbo) — measured 63 s → 37 s a picture with a slightly better prompt match
        f.taesd?.let { a += listOf("--taesd", it) }
        a += listOf("-p", prompt, "-o", out, "-W", width.toString(), "-H", height.toString(),
            "--steps", steps.toString(), "--cfg-scale", cfg.toString(), "--sampling-method", if (f.allInOne) "euler_a" else "euler",
            "-s", seed.toString(), "-t", threads.toString())
        if (!f.allInOne) a += "--diffusion-fa"
        // v5.33 — Turbo (SD-Turbo, an "SD 2" model): sd-cli GUESSES eps vs v prediction for SD 2
        // with a test run, and a quantised Turbo fools it into v — Ali's picture came out as pure
        // coloured noise. Turbo is eps, trained on "trailing" timesteps (≈ sgm_uniform).
        if (f.allInOne) a += listOf("--prediction", "eps", "--scheduler", "sgm_uniform")
        // VAE in tiles above 1 megapixel: the same picture, far less memory at the end.
        if (width * height > 1024 * 1024) a += "--vae-tiling"
        if (backend != null) a += listOf("--backend", backend)
        // Short of memory: the text reader is used once per picture, so it can
        // be read from storage when needed instead of sitting in RAM.
        // v6.19: weights memory-mapped too, so the big drawing model's pages can be dropped and re-read
        // (Studio lab: the 7B Qwen-Image pack ran inside an 8 GB no-swap cage this way at the same speed).
        if (lowMemory) a += listOf("--params-backend", "te=disk", "--mmap")
        refImage?.let { a += listOf("-r", it) }
        return a
    }

    fun upscaleArgs(bin: String, esrgan: String, input: String, out: String, threads: Int, backend: String?): List<String> {
        val a = arrayListOf(bin, "-M", "upscale", "--upscale-model", esrgan, "-i", input, "-o", out,
            "-t", threads.toString(), "--upscale-tile-size", "128")
        if (backend != null) a += listOf("--backend", backend)
        return a
    }

    /** `sd-cli --list-devices` → the first device that is not the CPU (e.g. the Adreno GPU), or null. */
    fun gpuDevice(listOutput: String): String? = listOutput.lines()
        .map { it.trim() }.filter { it.contains('\t') }
        .map { it.substringBefore('\t') }
        .firstOrNull { it.isNotBlank() && !it.equals("CPU", true) }
}
