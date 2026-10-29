package com.aldibiki.attune

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * v8.7 (Ali, 29 Oct: "something that takes a WhatsApp chat or group and understands what's in it with photos and organizes
 * them" — design A, albums): a WhatsApp export shared to Attune (one .zip, or the chat .txt + its photos as several files).
 * The chat's text goes to the page (web-src/wagroups.js sorts it); its photos are kept in the app's own storage,
 * files/wa/<group>/ — made smaller (1600 px, JPEG) so a group of 2,000 photos stays light — and the page shows them from
 * /wa/<group>/<name> (MainActivity's path handler). look() reads each photo on the phone: what is in it (ML Kit image
 * labels: "Couch", "Kitchen", "Lamp"…) and the words written in it (ML Kit text). Nothing leaves the phone.
 */
object WaGroups {
    fun dir(ctx: Context): File = File(ctx.filesDir, "wa").apply { mkdirs() }
    private val PHOTO = Regex("\\.(jpe?g|png|webp|gif|heic)$", RegexOption.IGNORE_CASE)
    private fun safe(s: String) = s.replace(Regex("[^\\w.\\-]+"), "_").take(120)
    fun gidOf(title: String): String { var h = 2166136261L; for (c in title.trim().lowercase()) { h = h xor c.code.toLong(); h = (h * 16777619L) and 0xffffffffL }; return "g" + java.lang.Long.toString(h, 36) }

    private fun nameOf(ctx: Context, uri: Uri): String = try {
        ctx.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
    } catch (e: Exception) { null } ?: (uri.lastPathSegment ?: "file").substringAfterLast('/')

    // a photo, smaller (≤ 1600 px on its long side), as JPEG
    private fun keepPhoto(bytes: ByteArray, out: File): Boolean = try {
        val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, o)
        var sample = 1; while (maxOf(o.outWidth, o.outHeight) / (sample * 2) >= 1600) sample *= 2
        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
        if (bmp == null) { out.writeBytes(bytes); true } else { out.outputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 82, it) }; bmp.recycle(); true }
    } catch (e: Throwable) { false }

    /** The shared export → { kind: "wagroup", gid, name, text, files: [photo names kept] } or null if no chat text is in it.
     *  Photos are written one by one as they are read (an export of 2,000 photos never sits in memory). */
    fun receive(ctx: Context, uris: List<Uri>, subject: String): JSONObject? {
        var chat: String? = null; var chatName = ""
        val tmp = File(dir(ctx), "_in_" + System.currentTimeMillis()).apply { mkdirs() }
        val kept = mutableListOf<String>()
        fun photo(n: String, b: ByteArray) { if (kept.size < 5000 && b.size < 25_000_000) { val f = File(tmp, safe(n)); if (keepPhoto(b, f)) kept.add(safe(n)) } }
        try {
            for (u in uris) {
                val name = nameOf(ctx, u)
                ctx.contentResolver.openInputStream(u)?.use { ins ->
                    if (name.endsWith(".zip", true)) {
                        val z = java.util.zip.ZipInputStream(ins); var e = z.nextEntry
                        while (e != null) {
                            val n = e.name.substringAfterLast('/')
                            if (n.endsWith(".txt", true) && chat == null) { chat = z.readBytes().toString(Charsets.UTF_8).take(8_000_000); chatName = n }
                            else if (PHOTO.containsMatchIn(n)) photo(n, z.readBytes())
                            e = z.nextEntry
                        }
                    } else if (name.endsWith(".txt", true) && chat == null) { chat = ins.readBytes().toString(Charsets.UTF_8).take(8_000_000); chatName = name }
                    else if (PHOTO.containsMatchIn(name)) photo(name, ins.readBytes())
                }
            }
            val text = chat ?: return null
            if (!Regex("^[\u200e\u200f]?\\[?[\\d\u0660-\u0669]{1,4}[/.\\-]", RegexOption.MULTILINE).containsMatchIn(text.take(4000))) return null
            val title = subject.ifBlank { chatName }.replace(Regex("^WhatsApp Chat (with|-) ", RegexOption.IGNORE_CASE), "").replace(Regex("\\.(txt|zip)$", RegexOption.IGNORE_CASE), "").trim().ifBlank { "WhatsApp group" }
            val gid = gidOf(title)
            val d = File(dir(ctx), gid).apply { mkdirs() }
            for (n in kept) { val to = File(d, n); if (!to.exists()) File(tmp, n).renameTo(to) }
            val files = JSONArray(); for (n in kept) files.put(n)
            return JSONObject().put("kind", "wagroup").put("gid", gid).put("name", title).put("text", text).put("files", files)
        } finally { tmp.deleteRecursively() }
    }

    /** Look at photos: { gid, names: [..] } → { seen: { name: { labels: [{text, c}], text } } }. */
    fun look(ctx: Context, gid: String, names: JSONArray, progress: (Int, Int) -> Unit): JSONObject {
        val labeler = com.google.mlkit.vision.label.ImageLabeling.getClient(com.google.mlkit.vision.label.defaults.ImageLabelerOptions.Builder().setConfidenceThreshold(0.6f).build())
        val reader = com.google.mlkit.vision.text.TextRecognition.getClient(com.google.mlkit.vision.text.latin.TextRecognizerOptions.DEFAULT_OPTIONS)
        val out = JSONObject(); val d = File(dir(ctx), gid)
        try {
            for (i in 0 until names.length()) {
                val n = safe(names.optString(i)); val f = File(d, n); if (!f.exists()) continue
                try {
                    val o = BitmapFactory.Options().apply { inSampleSize = 2 }
                    val bmp = BitmapFactory.decodeFile(f.path, o) ?: continue
                    val img = com.google.mlkit.vision.common.InputImage.fromBitmap(bmp, 0)
                    val labels = com.google.android.gms.tasks.Tasks.await(labeler.process(img), 20, java.util.concurrent.TimeUnit.SECONDS)
                    val words = try { com.google.android.gms.tasks.Tasks.await(reader.process(img), 20, java.util.concurrent.TimeUnit.SECONDS).text } catch (e: Exception) { "" }
                    val ls = JSONArray(); for (l in labels.take(8)) ls.put(JSONObject().put("text", l.text).put("c", Math.round(l.confidence * 100) / 100.0))
                    out.put(n, JSONObject().put("labels", ls).put("text", words.take(600)))
                    bmp.recycle()
                } catch (e: Exception) { }
                progress(i + 1, names.length())
            }
        } finally { labeler.close(); reader.close() }
        return JSONObject().put("seen", out)
    }

    fun forget(ctx: Context, gid: String) { File(dir(ctx), safe(gid)).deleteRecursively() }
}
