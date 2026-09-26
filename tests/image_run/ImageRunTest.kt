// Desktop test of ImageRun (the picture engine runner) against the REAL sd-cli
// built from the same stable-diffusion.cpp commit as the phone:
//   bash tests/image_run/run.sh
import com.aldibiki.attune.ImageRun
import java.io.File

var fails = 0
fun check(ok: Boolean, what: String) { println((if (ok) "PASS " else "FAIL ") + what); if (!ok) fails++ }

fun main(args: Array<String>) {
    val sdcli = args[0]; val esrgan = args[1]; val work = File(args[2]).apply { mkdirs() }
    // progress parsing, on the exact strings sd-cli prints
    check(ImageRun.parseBar("|==================>                               | 2/4 - 3.20s/it\u001B[K") == Triple(2, 4, '='), "a drawing step bar reads as step 2 of 4")
    check(ImageRun.parseBar("  |#########################                         | 351/702 - 248.25MB/s") == Triple(351, 702, '#'), "a loading bar reads as loading")
    var p = ImageRun.Progress("start")
    for (piece in listOf("[INFO   ] stable-diffusion.cpp:714 - loading diffusion model from '/x/flux.gguf'",
            "  |####    | 10/702 - 100MB/s", "[INFO   ] denoiser.cpp:807 - generate_image 1024x1024",
            "[INFO   ] conditioner.cpp:522 - get_learned_condition completed, taking 3.10s", "[INFO   ] sampler.cpp:420 - sampling using euler method",
            "  |=====>    | 1/4 - 9.10s/it", "  |=========>| 3/4 - 9.00s/it", "[INFO   ] x.cpp:545 - decoding 1 latents"))
        p = ImageRun.advance(p, piece)
    check(p.stage == "develop", "stages follow the log: load → prompt → draw → develop (now ${p.stage})")
    check(ImageRun.advance(ImageRun.Progress("draw"), "|=====>    | 3/4 - 9.00s/it") == ImageRun.Progress("draw", 3, 4), "drawing reports step 3 of 4")
    check(ImageRun.advance(ImageRun.Progress("load", 700, 702), "|##################################################| 702/702 - 250MB/s").stage == "prompt", "a finished loading bar moves on to reading the description (not 'Loading… 100%' for minutes)")
    check(ImageRun.gpuDevice("CPU\tIntel Xeon\nGPUOpenCL\tQUALCOMM Adreno(TM) 840\n") == "GPUOpenCL", "the Adreno device is picked from --list-devices")
    check(ImageRun.gpuDevice("CPU\tIntel Xeon\n") == null, "no GPU → null (CPU binary used)")
    val g = ImageRun.genArgs("/bin/sd", ImageRun.Files("/m/d.gguf", "/m/q.gguf", "/m/v.st"), "a crane at dusk", "/o.png", 1024, 1024, 4, 7, 6, "diffusion=GPUOpenCL,vae=GPUOpenCL,te=cpu", "/r.png", lowMemory = true)
    check(g.containsAll(listOf("--diffusion-model", "--llm", "--vae", "--steps", "4", "-s", "7", "-r", "/r.png", "--params-backend", "te=disk")), "generation arguments: models, 4 steps, seed, reference photo, low-memory text reader")
    // the sd-cli accepts every option we pass (unknown options make it exit at once)
    val help = ProcessBuilder(sdcli, "--help").redirectErrorStream(true).start().inputStream.bufferedReader().readText()
    val used = (g + ImageRun.upscaleArgs("x", "e", "i", "o", 2, "cpu")).filter { it.startsWith("-") }.toSet()
    val unknown = used.filter { !Regex("(^|[\\s,])" + Regex.escape(it) + "([\\s,]|$)", RegexOption.MULTILINE).containsMatchIn(help) }
    check(unknown.isEmpty(), "sd-cli knows every option Attune uses ${if (unknown.isEmpty()) "" else unknown}")
    // a real run through the Job runner: upscale a small picture 4× with Real-ESRGAN
    val input = File(work, "in.png")
    javax.imageio.ImageIO.write(java.awt.image.BufferedImage(48, 32, java.awt.image.BufferedImage.TYPE_INT_RGB).apply {
        val gr = createGraphics(); gr.color = java.awt.Color(30, 120, 200); gr.fillRect(0, 0, 48, 32); gr.color = java.awt.Color.ORANGE; gr.fillOval(8, 6, 20, 20); gr.dispose() }, "png", input)
    val out = File(work, "out.png"); out.delete()
    val seen = ArrayList<ImageRun.Progress>()
    val job = ImageRun.Job(ImageRun.upscaleArgs(sdcli, esrgan, input.path, out.path, 4, "cpu"), emptyMap(), work)
    val code = job.run { seen += it }
    val img = if (out.exists()) javax.imageio.ImageIO.read(out) else null
    check(code == 0 && img != null && img.width == 192 && img.height == 128, "a real 4× upscale ran through the runner: 48×32 → ${img?.width}×${img?.height}")
    check(seen.any { it.stage == "upscale" && it.total > 0 }, "…and reported its progress (${seen.lastOrNull()})")
    // cancel stops the process at once
    val slow = ImageRun.Job(listOf("sleep", "30"), emptyMap(), work)
    val t0 = System.currentTimeMillis()
    Thread { Thread.sleep(300); slow.cancel() }.start()
    slow.run { }
    check(System.currentTimeMillis() - t0 < 5000 && slow.cancelled, "Stop kills the drawing process at once")
    // a failing run gives a readable error
    val bad = ImageRun.Job(listOf(sdcli, "--diffusion-model", "/nope.gguf", "-p", "x", "-o", File(work, "x.png").path), emptyMap(), work)
    val bc = bad.run { }
    check(bc != 0 && bad.lastError().isNotBlank(), "a failing run exits non-zero with a readable last line: " + bad.lastError().take(80))
    println(if (fails == 0) "ALL PASSED" else "$fails FAILED")
    kotlin.system.exitProcess(if (fails == 0) 0 else 1)
}
