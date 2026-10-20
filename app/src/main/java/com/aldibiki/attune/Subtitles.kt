package com.aldibiki.attune

import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.Build
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * v6.45 (W6) Subtitles for a saved video, made on the phone: its sound is decoded to 16 kHz mono, cut at the pauses into
 * pieces of 2–14 s, and each piece is read by the phone's OWN offline speech recogniser (Android 13+: a recogniser can
 * take audio from a file — EXTRA_AUDIO_SOURCE). Only the on-device recogniser is used, so the sound never leaves the
 * phone. → [{start, end, text}] in ms; the page turns them into an .srt (video.js srtOf).
 */
object Subtitles {
    private const val RATE = 16000

    class Cancelled : Exception("Stopped")

    fun available(ctx: Context): Boolean = Build.VERSION.SDK_INT >= 33 && SpeechRecognizer.isOnDeviceRecognitionAvailable(ctx)

    /** The video's sound as 16 kHz mono 16-bit samples. */
    fun decode(ctx: Context, id: Long, isCancelled: () -> Boolean): ShortArray {
        val dm = ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val src = dm.getUriForDownloadedFile(id) ?: throw IllegalStateException("The file was moved or deleted")
        val ex = MediaExtractor(); ex.setDataSource(ctx, src, null)
        var t = -1
        for (i in 0 until ex.trackCount) if ((ex.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: "").startsWith("audio/")) { t = i; break }
        if (t < 0) { ex.release(); throw IllegalStateException("This video has no sound") }
        ex.selectTrack(t)
        val fmt = ex.getTrackFormat(t)
        val codec = MediaCodec.createDecoderByType(fmt.getString(MediaFormat.KEY_MIME)!!)
        codec.configure(fmt, null, null, 0); codec.start()
        var rate = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE); var ch = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        val info = MediaCodec.BufferInfo()
        var inDone = false; var outDone = false
        var mono = ShortArray(1 shl 20); var len = 0   // grows by doubling (no boxed numbers: a 10-minute video is ~26 M samples)
        try {
            while (!outDone) {
                if (isCancelled()) throw Cancelled()
                if (!inDone) {
                    val ii = codec.dequeueInputBuffer(10_000)
                    if (ii >= 0) {
                        val n = ex.readSampleData(codec.getInputBuffer(ii)!!, 0)
                        if (n < 0) { codec.queueInputBuffer(ii, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inDone = true }
                        else { codec.queueInputBuffer(ii, 0, n, ex.sampleTime, 0); ex.advance() }
                    }
                }
                val oi = codec.dequeueOutputBuffer(info, 10_000)
                if (oi == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    val f = codec.outputFormat; rate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE); ch = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                } else if (oi >= 0) {
                    val b = codec.getOutputBuffer(oi)!!.order(java.nio.ByteOrder.LITTLE_ENDIAN).asShortBuffer()
                    val frames = b.remaining() / ch
                    if (len + frames > mono.size) mono = mono.copyOf(maxOf(mono.size * 2, len + frames))
                    for (i in 0 until frames) { var s = 0; for (c in 0 until ch) s += b.get(i * ch + c); mono[len++] = (s / ch).toShort() }
                    codec.releaseOutputBuffer(oi, false)
                    if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) outDone = true
                }
            }
        } finally { try { codec.stop() } catch (e: Throwable) {}; codec.release(); ex.release() }
        // to 16 kHz (linear)
        val n = (len.toLong() * RATE / rate).toInt()
        val res = ShortArray(n)
        for (i in 0 until n) { val p = i.toDouble() * rate / RATE; val a = p.toInt(); val f = p - a
            val x0 = if (a < len) mono[a].toInt() else 0; val x1 = if (a + 1 < len) mono[a + 1].toInt() else x0; res[i] = (x0 + (x1 - x0) * f).toInt().toShort() }
        return res
    }

    /** Pieces of 2–14 s cut at the quietest 100 ms near the end of each piece; silent pieces are skipped. → [startSample, endSample]. */
    fun pieces(pcm: ShortArray, minS: Int = 2, maxS: Int = 14): List<IntArray> {
        val win = RATE / 10; val nw = pcm.size / win
        val e = DoubleArray(nw) { w -> var s = 0.0; for (i in w * win until (w + 1) * win) s += pcm[i].toDouble() * pcm[i]; Math.sqrt(s / win) }
        val loud = (e.sorted().getOrElse((nw * 0.6).toInt()) { 0.0 }).coerceAtLeast(200.0)
        val out = ArrayList<IntArray>(); var a = 0
        while (a < nw) {
            if (nw - a <= maxS * 10) { out += intArrayOf(a, nw); break }
            var cut = a + maxS * 10; var best = Double.MAX_VALUE
            for (w in a + minS * 10 until a + maxS * 10) if (e[w] < best) { best = e[w]; cut = w }
            out += intArrayOf(a, cut + 1); a = cut + 1
        }
        return out.filter { p -> (p[0] until p[1]).any { e[it] > loud * 0.5 } }.map { intArrayOf(it[0] * win, minOf(pcm.size, it[1] * win)) }
    }

    /** One piece → text with the on-device recogniser (on the main thread, as Android wants); "" when nothing was heard. */
    @androidx.annotation.RequiresApi(33)
    private fun recognise(act: Activity, file: File, lang: String): String {
        var text = ""; var err: String? = null
        val done = CountDownLatch(1)
        var rec: SpeechRecognizer? = null
        val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
        act.runOnUiThread {
            try {
                val r = SpeechRecognizer.createOnDeviceSpeechRecognizer(act); rec = r
                r.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(p: Bundle?) {}
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(v: Float) {}
                    override fun onBufferReceived(b: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onEvent(t: Int, p: Bundle?) {}
                    override fun onPartialResults(b: Bundle?) {}
                    override fun onResults(b: Bundle?) { text = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""; done.countDown() }
                    override fun onError(e: Int) {
                        if (e == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED || e == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE) err = "The phone's offline speech pack for this language is missing — add it in the phone's Settings → Speech"
                        done.countDown()
                    }
                })
                val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                    .putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
                    .putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE, pfd)
                    .putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT, 1)
                    .putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
                    .putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE, RATE)
                r.startListening(i)
            } catch (e: Throwable) { err = e.message; done.countDown() }
        }
        val ok = done.await(60, TimeUnit.SECONDS)
        act.runOnUiThread { try { rec?.destroy() } catch (e: Throwable) {} }
        try { pfd.close() } catch (e: Throwable) {}
        err?.let { throw IllegalStateException(it) }
        return if (ok) text else ""
    }

    /** The whole video → [{start, end, text}] (ms), with progress (pieces done / all). */
    fun make(act: Activity, id: Long, lang: String, onProgress: (Int, Int) -> Unit, isCancelled: () -> Boolean): JSONArray {
        if (Build.VERSION.SDK_INT < 33) throw IllegalStateException("Subtitles need Android 13 or newer")
        if (!SpeechRecognizer.isOnDeviceRecognitionAvailable(act)) throw IllegalStateException("This phone has no offline speech recogniser (Google's speech services)")
        val pcm = decode(act, id, isCancelled)
        val ps = pieces(pcm)
        val out = JSONArray()
        val tmp = File(act.cacheDir, "subs-${System.currentTimeMillis()}.pcm")
        try {
            ps.forEachIndexed { k, p ->
                if (isCancelled()) throw Cancelled()
                onProgress(k, ps.size)
                tmp.outputStream().buffered().use { o -> for (i in p[0] until p[1]) { val v = pcm[i].toInt(); o.write(v and 255); o.write((v shr 8) and 255) } }
                val text = recognise(act, tmp, lang).trim()
                if (text.isNotEmpty()) out.put(JSONObject().put("start", p[0] * 1000L / RATE).put("end", p[1] * 1000L / RATE).put("text", text))
            }
            onProgress(ps.size, ps.size)
        } finally { tmp.delete() }
        return out
    }
}
