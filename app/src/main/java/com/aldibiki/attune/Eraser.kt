package com.aldibiki.attune

import ai.onnxruntime.OnnxJavaType
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * v6.38 (batch 4) — Studio's eraser, like the gallery apps: paint over a person or a thing, it is gone.
 * MI-GAN (MIT licence, code and weights, 28 MB: migan_pipeline_v2.onnx) run by ONNX Runtime on the phone's CPU — about a
 * second, one pass, no internet. The model's own pipeline crops around the painted part, fills it at 512 px and puts it
 * back, so the rest of the photo keeps every pixel.
 * Inputs: image uint8 [1,3,H,W]; mask uint8 [1,1,H,W] with 255 = keep and 0 = fill (checked on a test image, 18 Oct 2026).
 * The model is a Studio pack ("eraser", role "inpaint") downloaded once; the session stays loaded until Studio is left.
 */
object Eraser {
    const val PACK = "eraser"
    private const val MAX_SIDE = 3072
    private var session: OrtSession? = null
    private var sessionPath = ""

    @Synchronized
    private fun session(ctx: Context): OrtSession {
        val f = ImageEngine.packFile(ctx, PACK, "inpaint") ?: throw IOException("Download the eraser first (28 MB, once).")
        session?.let { if (sessionPath == f.path) return it }
        release()
        val env = OrtEnvironment.getEnvironment()
        val opts = OrtSession.SessionOptions().apply {
            setIntraOpNumThreads(Runtime.getRuntime().availableProcessors().coerceIn(2, 4))
            setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
        }
        return env.createSession(f.path, opts).also { session = it; sessionPath = f.path }
    }

    /** The hole (mask value 0) grown by r pixels: a box of 2r+1 around each hole pixel, by running counts (fast on 9 MP). */
    private fun grow(keep: ByteArray, w: Int, h: Int, r: Int): ByteArray {
        val hole = BooleanArray(w * h) { keep[it] == 0.toByte() }
        val tmp = BooleanArray(w * h)
        for (y in 0 until h) { var c = 0; val o = y * w
            for (x in 0 until minOf(r, w)) if (hole[o + x]) c++
            for (x in 0 until w) { if (x + r < w && hole[o + x + r]) c++; if (x - r - 1 >= 0 && hole[o + x - r - 1]) c--; tmp[o + x] = c > 0 } }
        val out = ByteArray(w * h)
        for (x in 0 until w) { var c = 0
            for (y in 0 until minOf(r, h)) if (tmp[y * w + x]) c++
            for (y in 0 until h) { if (y + r < h && tmp[(y + r) * w + x]) c++; if (y - r - 1 >= 0 && tmp[(y - r - 1) * w + x]) c--; out[y * w + x] = (if (c > 0) 0 else -1).toByte() } }
        return out
    }
    /** How much of the filled picture to use at each pixel: 1 inside the hole, fading to 0 over k pixels outside it. */
    private fun feather(mask: ByteArray, w: Int, h: Int, k: Int): FloatArray {
        val a = FloatArray(w * h)
        var cur = mask
        for (i in a.indices) if (cur[i] == 0.toByte()) a[i] = 1f
        for (step in 1..k) { cur = grow(cur, w, h, 1); val v = 1f - step / (k + 1f); for (i in a.indices) if (cur[i] == 0.toByte() && a[i] == 0f) a[i] = v }
        return a
    }
    private fun mix(p: Int, q: Int, t: Float): Int {
        fun ch(sh: Int) = (((p shr sh) and 255) * (1 - t) + ((q shr sh) and 255) * t).toInt().coerceIn(0, 255)
        return -0x1000000 or (ch(16) shl 16) or (ch(8) shl 8) or ch(0)
    }

    @Synchronized
    fun release() { try { session?.close() } catch (e: Throwable) {}; session = null; sessionPath = "" }

    private fun fit(b: Bitmap): Bitmap {
        val side = maxOf(b.width, b.height)
        if (side <= MAX_SIDE) return b
        val k = MAX_SIDE.toFloat() / side
        return Bitmap.createScaledBitmap(b, (b.width * k).toInt().coerceAtLeast(1), (b.height * k).toInt().coerceAtLeast(1), true).also { if (it !== b) b.recycle() }
    }

    /** src: a Studio picture's file name, or photo = the bytes of a photo; mask = a PNG the page painted (any size: it is
     *  stretched to the picture), painted pixels = remove. → the new picture in Studio's folder. */
    fun erase(ctx: Context, file: String?, photo: ByteArray?, mask: ByteArray): ImageEngine.Result {
        val t0 = System.currentTimeMillis()
        val src0 = when {
            !file.isNullOrEmpty() -> File(ImageEngine.studioDir(ctx), File(file).name).takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path) } ?: throw IOException("That picture is gone.")
            photo != null -> BitmapFactory.decodeByteArray(photo, 0, photo.size) ?: throw IOException("Couldn't open that photo.")
            else -> throw IOException("No picture")
        }
        val src = fit(src0)
        val w = src.width; val h = src.height
        val m0 = BitmapFactory.decodeByteArray(mask, 0, mask.size) ?: throw IOException("Paint over what to remove first.")
        val m = if (m0.width == w && m0.height == h) m0 else Bitmap.createScaledBitmap(m0, w, h, true).also { m0.recycle() }
        val px = IntArray(w * h); src.getPixels(px, 0, w, 0, 0, w, h); src.recycle()
        val mp = IntArray(w * h); m.getPixels(mp, 0, w, 0, 0, w, h); m.recycle()
        val n = w * h
        val img = ByteBuffer.allocateDirect(3 * n).order(ByteOrder.nativeOrder())
        for (c in 0 until 3) { val sh = 16 - 8 * c; for (i in 0 until n) img.put(((px[i] shr sh) and 255).toByte()) }
        img.rewind()
        val msk = ByteBuffer.allocateDirect(n).order(ByteOrder.nativeOrder())
        var holes = 0
        for (i in 0 until n) { val a = (mp[i] ushr 24) and 255; val v = (mp[i] shr 8) and 255; val hole = a > 40 && v > 40; if (hole) holes++; msk.put(if (hole) 0.toByte() else (-1).toByte()) }
        msk.rewind()
        if (holes == 0) throw IOException("Paint over what to remove first.")
        // v6.43 (Ali: "erase people like the gallery, high quality"): a painted stroke always misses the edge of a person —
        // their outline and shadow stayed as a halo. The hole grows by ~0.6 % of the photo's side (4–14 px) first.
        val keep0 = ByteArray(n).also { msk.get(it); msk.rewind() }
        val grown = grow(keep0, w, h, (maxOf(w, h) * 0.006).toInt().coerceIn(4, 14))
        msk.put(grown); msk.rewind()
        val env = OrtEnvironment.getEnvironment()
        val s = session(ctx)
        val out = IntArray(n)
        OnnxTensor.createTensor(env, img, longArrayOf(1, 3, h.toLong(), w.toLong()), OnnxJavaType.UINT8).use { ti ->
            OnnxTensor.createTensor(env, msk, longArrayOf(1, 1, h.toLong(), w.toLong()), OnnxJavaType.UINT8).use { tm ->
                s.run(mapOf("image" to ti, "mask" to tm)).use { r ->
                    val t = r.get(0) as OnnxTensor
                    val shape = t.info.shape
                    if (shape.size != 4 || shape[2].toInt() != h || shape[3].toInt() != w) throw IOException("The eraser gave a wrong size")
                    val b = t.byteBuffer
                    for (i in 0 until n) out[i] = -0x1000000 or ((b.get(i).toInt() and 255) shl 16) or ((b.get(n + i).toInt() and 255) shl 8) or (b.get(2 * n + i).toInt() and 255)
                }
            }
        }
        // only the filled part changes, with a soft 3 px edge — the rest of the photo keeps every original pixel
        val soft = feather(grown, w, h, 3)
        for (i in 0 until n) { val a = soft[i]; if (a <= 0f) out[i] = px[i] else if (a < 1f) out[i] = mix(px[i], out[i], a) }
        val res = Bitmap.createBitmap(out, w, h, Bitmap.Config.ARGB_8888)
        val dest = File(ImageEngine.studioDir(ctx), "erase-${System.currentTimeMillis()}.png")
        dest.outputStream().use { res.compress(Bitmap.CompressFormat.PNG, 100, it) }
        res.recycle()
        return ImageEngine.Result(dest, "cpu · eraser", System.currentTimeMillis() - t0, false)
    }
}
