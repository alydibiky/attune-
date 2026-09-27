package com.aldibiki.attune

import android.Manifest
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * v5.38 — Video Downloader, the phone side (the link reading is web-src/video.js).
 *  - probe: what a link really is after redirects (type, size, file name) without downloading it.
 *  - getText: a page or an API answer (HTML / JSON) as text, up to 3 MB.
 *  - download: Android's DownloadManager saves the file to Movies/Attune (or Music/Attune) with a
 *    progress notification; it continues when Attune is closed and resumes after a lost connection.
 *  - status / open / cancel for the downloads Attune started.
 */
object MediaTools {
    private const val UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36"

    private fun open(url: String, method: String): HttpURLConnection {
        var u = url
        repeat(8) {
            val c = (URL(u).openConnection() as HttpURLConnection).apply {
                requestMethod = method; instanceFollowRedirects = false
                connectTimeout = 15000; readTimeout = 20000
                setRequestProperty("User-Agent", UA); setRequestProperty("Accept", "*/*")
                if (method == "GET") setRequestProperty("Range", "bytes=0-")
            }
            val code = c.responseCode
            if (code in 300..399) {
                val loc = c.getHeaderField("Location") ?: return c
                c.disconnect(); u = URL(URL(u), loc).toString(); return@repeat
            }
            return c
        }
        throw java.io.IOException("Too many redirects")
    }

    /** {url (after redirects), type, size, name, code} */
    fun probe(url: String): JSONObject {
        var c = open(url, "HEAD")
        if (c.responseCode == 405 || c.responseCode == 403 || c.responseCode == 501 || c.contentType == null) { c.disconnect(); c = open(url, "GET") }
        try {
            val len = c.getHeaderField("Content-Range")?.substringAfter("/")?.toLongOrNull() ?: c.contentLengthLong
            val cd = c.getHeaderField("Content-Disposition") ?: ""
            val name = Regex("filename\\*=UTF-8''([^;]+)", RegexOption.IGNORE_CASE).find(cd)?.groupValues?.get(1)?.let { java.net.URLDecoder.decode(it, "UTF-8") }
                ?: Regex("filename=\"?([^\";]+)\"?", RegexOption.IGNORE_CASE).find(cd)?.groupValues?.get(1) ?: ""
            return JSONObject().put("url", c.url.toString()).put("type", (c.contentType ?: "").substringBefore(";").trim())
                .put("size", if (len > 0) len else 0L).put("name", name).put("code", c.responseCode)
        } finally { c.disconnect() }
    }

    /** {url, type, text} — a page or API answer, at most 3 MB. */
    fun getText(url: String): JSONObject {
        val c = open(url, "GET")
        try {
            if (c.responseCode >= 400) throw java.io.IOException("The site answered ${c.responseCode}")
            val type = (c.contentType ?: "").substringBefore(";").trim()
            if (type.startsWith("video/") || type.startsWith("audio/")) return JSONObject().put("url", c.url.toString()).put("type", type).put("text", "")
            val bytes = c.inputStream.use { s -> val o = java.io.ByteArrayOutputStream(); val b = ByteArray(16384); while (o.size() < 3_000_000) { val n = s.read(b); if (n < 0) break; o.write(b, 0, n) }; o.toByteArray() }
            val cs = Regex("charset=([\\w-]+)", RegexOption.IGNORE_CASE).find(c.contentType ?: "")?.groupValues?.get(1) ?: "UTF-8"
            val text = try { String(bytes, charset(cs)) } catch (e: Exception) { String(bytes, Charsets.UTF_8) }
            return JSONObject().put("url", c.url.toString()).put("type", type).put("text", text)
        } finally { c.disconnect() }
    }

    private fun dm(ctx: Context) = ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

    /** Starts a download → {id, where}. audio = true saves to Music/Attune, else Movies/Attune. */
    fun download(ctx: Context, url: String, name: String, audio: Boolean, title: String): JSONObject {
        val safe = name.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]+"), " ").trim().take(120).ifEmpty { "video.mp4" }
        val r = DownloadManager.Request(Uri.parse(url))
            .addRequestHeader("User-Agent", UA)
            .setTitle(title.ifEmpty { safe })
            .setDescription("Attune")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setAllowedOverMetered(true).setAllowedOverRoaming(true)
        val dir = if (audio) Environment.DIRECTORY_MUSIC else Environment.DIRECTORY_MOVIES
        // Android 10+: DownloadManager may write to the shared folders; Android 9 needs the storage permission
        val shared = Build.VERSION.SDK_INT >= 29 || ctx.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        val where: String
        if (shared) { r.setDestinationInExternalPublicDir(dir, "Attune/$safe"); where = "$dir/Attune/$safe" }
        else { r.setDestinationInExternalFilesDir(ctx, dir, safe); where = "Android/data/${ctx.packageName}/files/$dir/$safe" }
        if (Build.VERSION.SDK_INT < 29) scanOld(r)
        val id = dm(ctx).enqueue(r)
        return JSONObject().put("id", id).put("where", where).put("name", safe)
    }

    @Suppress("DEPRECATION")
    private fun scanOld(r: DownloadManager.Request) { r.allowScanningByMediaScanner() }

    /** [{id, status: pending|running|paused|done|failed, done, total, reason}] for the given ids. */
    fun status(ctx: Context, ids: List<Long>): JSONArray {
        val out = JSONArray()
        if (ids.isEmpty()) return out
        dm(ctx).query(DownloadManager.Query().setFilterById(*ids.toLongArray()))?.use { c ->
            while (c.moveToNext()) {
                fun col(n: String) = c.getColumnIndex(n)
                val st = c.getInt(col(DownloadManager.COLUMN_STATUS))
                out.put(JSONObject()
                    .put("id", c.getLong(col(DownloadManager.COLUMN_ID)))
                    .put("status", when (st) { DownloadManager.STATUS_PENDING -> "pending"; DownloadManager.STATUS_RUNNING -> "running"; DownloadManager.STATUS_PAUSED -> "paused"; DownloadManager.STATUS_SUCCESSFUL -> "done"; else -> "failed" })
                    .put("done", c.getLong(col(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)))
                    .put("total", c.getLong(col(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)))
                    .put("reason", c.getInt(col(DownloadManager.COLUMN_REASON))))
            }
        }
        return out
    }

    fun openFile(ctx: Context, id: Long): Boolean {
        val uri = dm(ctx).getUriForDownloadedFile(id) ?: return false
        val type = dm(ctx).getMimeTypeForDownloadedFile(id) ?: "video/*"
        ctx.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, type)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
        return true
    }

    fun cancel(ctx: Context, id: Long): Boolean = dm(ctx).remove(id) > 0
}
