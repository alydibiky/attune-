package com.aldibiki.attune

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * v6.37 Google sync (Ali: "either cloud using Google or using Wi-Fi"): ONE file, "attune-sync.attune", in the person's own
 * Google Drive, in the hidden app folder (scope drive.appdata — Attune can't see anything else in the Drive, and the file
 * doesn't show in the Drive app). The page locks it with the sync passphrase before it gets here (sync.js), so Google only
 * ever holds noise. The access token comes from Google's own sign-in screen (MainActivity.authorizeDrive).
 */
object GoogleDrive {
    private const val NAME = "attune-sync.attune"
    private const val API = "https://www.googleapis.com/drive/v3/files"
    private const val UP = "https://www.googleapis.com/upload/drive/v3/files"

    /** → {"id": "...", "modified": "...", "text": "..."} — or {} when there is no file yet. */
    fun get(token: String): JSONObject {
        val q = URLEncoder.encode("name='$NAME' and trashed=false", "UTF-8")
        val list = JSONObject(call(token, "GET", "$API?spaces=appDataFolder&q=$q&fields=files(id,modifiedTime)&orderBy=modifiedTime%20desc", null, null))
        val files = list.optJSONArray("files")
        if (files == null || files.length() == 0) return JSONObject()
        val f = files.getJSONObject(0)
        val text = call(token, "GET", "$API/${f.getString("id")}?alt=media", null, null)
        return JSONObject().put("id", f.getString("id")).put("modified", f.optString("modifiedTime")).put("text", text)
    }

    /** Writes the file (creates it the first time) → its id. */
    fun put(token: String, id: String?, text: String): String {
        if (!id.isNullOrEmpty()) {
            // HttpURLConnection has no PATCH: Google accepts the override header
            call(token, "POST", "$UP/$id?uploadType=media", text, "application/octet-stream", mapOf("X-HTTP-Method-Override" to "PATCH"))
            return id
        }
        val boundary = "attune" + System.nanoTime()
        val meta = JSONObject().put("name", NAME).put("parents", org.json.JSONArray().put("appDataFolder")).toString()
        val body = "--$boundary\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n$meta\r\n--$boundary\r\nContent-Type: application/octet-stream\r\n\r\n$text\r\n--$boundary--\r\n"
        val r = JSONObject(call(token, "POST", "$UP?uploadType=multipart&fields=id", body, "multipart/related; boundary=$boundary"))
        return r.getString("id")
    }

    private fun call(token: String, method: String, url: String, body: String?, type: String?, extra: Map<String, String> = emptyMap()): String {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = method; c.connectTimeout = 15_000; c.readTimeout = 60_000
            c.setRequestProperty("Authorization", "Bearer $token")
            for ((k, v) in extra) c.setRequestProperty(k, v)
            if (body != null) { c.doOutput = true; c.setRequestProperty("Content-Type", type ?: "application/octet-stream"); c.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) } }
            val code = c.responseCode
            val s = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            if (code == 401) throw IllegalStateException("Google sign-in expired — tap Sync again.")
            if (code == 403) throw IllegalStateException("Google refused (403): the Drive API may not be turned on for Attune yet.")
            if (code !in 200..299) throw IllegalStateException("Google Drive answered $code")
            return s
        } finally { c.disconnect() }
    }
}
