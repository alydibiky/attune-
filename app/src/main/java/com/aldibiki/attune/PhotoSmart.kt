package com.aldibiki.attune

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.google.android.gms.common.moduleinstall.ModuleInstall
import com.google.android.gms.common.moduleinstall.ModuleInstallRequest
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * v6.43 (Ali: "I want the image part to be exactly like my Honor phone"): the photo editor finds every person and thing in a
 * photo, each as its own shape — tap one to erase it, "Passers-by" removes everyone but the main subject, "Cut out" lifts a
 * subject off its background. Google's ML Kit subject segmentation (Play services, runs on the phone, no upload): the module
 * is fetched once by Play services, then works offline.
 * → { w, h, subjects: [{ x, y, w, h, mask: PNG data URL (white = the subject, soft edge) }] } in the analysed picture's pixels.
 */
object PhotoSmart {
    private const val MAX_SIDE = 1280

    fun subjects(ctx: Context, file: String?, photo: ByteArray?): JSONObject {
        val src0 = when {
            !file.isNullOrEmpty() -> File(ImageEngine.studioDir(ctx), File(file).name).takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path) } ?: throw IOException("That picture is gone.")
            photo != null -> BitmapFactory.decodeByteArray(photo, 0, photo.size) ?: throw IOException("Couldn't open that photo.")
            else -> throw IOException("No picture")
        }
        val k = minOf(1f, MAX_SIDE.toFloat() / maxOf(src0.width, src0.height))
        val bmp = if (k < 1f) Bitmap.createScaledBitmap(src0, (src0.width * k).toInt().coerceAtLeast(1), (src0.height * k).toInt().coerceAtLeast(1), true).also { src0.recycle() } else src0
        val opts = SubjectSegmenterOptions.Builder()
            .enableMultipleSubjects(SubjectSegmenterOptions.SubjectResultOptions.Builder().enableConfidenceMask().build())
            .build()
        val seg = SubjectSegmentation.getClient(opts)
        try {
            // the first time, Play services fetches the segmenter (a few MB); afterwards it is on the phone
            val mi = ModuleInstall.getClient(ctx)
            val have = try { Tasks.await(mi.areModulesAvailable(seg), 20, TimeUnit.SECONDS).areModulesAvailable() } catch (e: Exception) { false }
            if (!have) {
                try { Tasks.await(mi.installModules(ModuleInstallRequest.newBuilder().addApi(seg).build()), 180, TimeUnit.SECONDS) }
                catch (e: Exception) { throw IOException("Google Play services couldn't fetch the photo tools — check the internet once and try again.") }
            }
            val res = Tasks.await(seg.process(InputImage.fromBitmap(bmp, 0)), 90, TimeUnit.SECONDS)
            val out = JSONArray()
            for (s in res.subjects) {
                val w = s.width; val h = s.height
                val buf = s.confidenceMask ?: continue
                if (w <= 0 || h <= 0) continue
                buf.rewind()
                val px = IntArray(w * h)
                var area = 0
                for (i in 0 until w * h) {
                    val c = if (buf.hasRemaining()) buf.get() else 0f
                    val a = ((c - 0.35f) / 0.3f).coerceIn(0f, 1f)          // a soft edge between 35 % and 65 % sure
                    if (c >= 0.5f) area++
                    px[i] = ((a * 255).toInt() shl 24) or 0xFFFFFF
                }
                if (area < 40) continue
                val m = Bitmap.createBitmap(px, w, h, Bitmap.Config.ARGB_8888)
                val bos = ByteArrayOutputStream(); m.compress(Bitmap.CompressFormat.PNG, 100, bos); m.recycle()
                out.put(JSONObject().put("x", s.startX).put("y", s.startY).put("w", w).put("h", h).put("area", area)
                    .put("mask", "data:image/png;base64," + android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP)))
            }
            return JSONObject().put("w", bmp.width).put("h", bmp.height).put("subjects", out)
        } finally { try { seg.close() } catch (e: Throwable) {}; bmp.recycle() }
    }
}
