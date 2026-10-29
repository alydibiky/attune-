package com.aldibiki.attune

import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * v8.7 (Ali, 29 Oct: "and also reads Gmail by itself"): the emails about money — receipts, invoices, subscriptions, renewals,
 * trials, price changes, bank and wallet emails — read on the phone with the Gmail API (gmail.readonly, asked once through
 * Google's own screen, MainActivity.authorizeScopes). The token stays here; the page gets only the emails it asked for:
 * [{ id, kind: "email", from, title, text, at, link }] — the same shape as the Gmail export (overpay.js readEmail).
 * Setup Ali does once (Cloud project, Gmail API, consent screen, Android client, test users): docs/GMAIL_SIGNIN.md.
 * Idea from Google's own Gmail API Android quickstart (Apache-2.0), written here from scratch.
 */
object GmailRead {
    const val SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
    const val MONEY_Q = "(receipt OR invoice OR order OR subscription OR renew OR renewal OR trial OR \"price increase\" OR payment OR billing OR charged OR debited OR credited OR transfer OR voucher OR points OR إيصال OR فاتورة OR اشتراك OR تجديد OR دفع OR تحويل)"

    private fun get(url: String, token: String): JSONObject {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15000; c.readTimeout = 20000
        c.setRequestProperty("Authorization", "Bearer $token")
        try {
            val code = c.responseCode
            val body = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) throw RuntimeException(if (code == 401 || code == 403) "Gmail said no ($code) — sign in again" else "Gmail answered $code")
            return JSONObject(body)
        } finally { c.disconnect() }
    }

    const val SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"

    /** v8.7: send ONE email the person has just read and confirmed in Attune (gmail.send — Attune can only send, not read, with it). */
    fun send(token: String, to: List<String>, subject: String, body: String): String {
        val enc = { s: String -> "=?UTF-8?B?" + Base64.encodeToString(s.toByteArray(Charsets.UTF_8), Base64.NO_WRAP) + "?=" }
        val mime = "To: " + to.joinToString(", ") + "\r\nSubject: " + enc(subject) + "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n" +
            "Content-Transfer-Encoding: base64\r\n\r\n" + Base64.encodeToString(body.toByteArray(Charsets.UTF_8), Base64.DEFAULT)
        val raw = Base64.encodeToString(mime.toByteArray(Charsets.UTF_8), Base64.URL_SAFE or Base64.NO_WRAP)
        val c = URL("https://gmail.googleapis.com/gmail/v1/users/me/messages/send").openConnection() as HttpURLConnection
        c.connectTimeout = 15000; c.readTimeout = 20000; c.requestMethod = "POST"; c.doOutput = true
        c.setRequestProperty("Authorization", "Bearer $token"); c.setRequestProperty("Content-Type", "application/json")
        try {
            c.outputStream.use { it.write(JSONObject().put("raw", raw).toString().toByteArray(Charsets.UTF_8)) }
            val code = c.responseCode
            val txt = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
            if (code !in 200..299) throw RuntimeException(if (code == 401 || code == 403) "Gmail said no ($code) — connect Gmail again" else "Gmail answered $code")
            return JSONObject(txt).optString("id")
        } finally { c.disconnect() }
    }

    private fun b64(s: String): String = try { String(Base64.decode(s, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING), Charsets.UTF_8) } catch (e: Exception) { "" }

    // the readable text: text/plain first, else text/html without its tags
    private fun bodyOf(part: JSONObject?): Pair<String, String> {
        if (part == null) return "" to ""
        val mime = part.optString("mimeType")
        val data = part.optJSONObject("body")?.optString("data").orEmpty()
        var plain = if (mime == "text/plain" && data.isNotEmpty()) b64(data) else ""
        var html = if (mime == "text/html" && data.isNotEmpty()) b64(data) else ""
        val parts = part.optJSONArray("parts")
        if (parts != null) for (i in 0 until parts.length()) {
            val (p, h) = bodyOf(parts.optJSONObject(i)); if (plain.isEmpty()) plain = p; if (html.isEmpty()) html = h
        }
        return plain to html
    }
    private fun clean(html: String) = html.replace(Regex("(?is)<(script|style)[^>]*>.*?</\\1>"), " ").replace(Regex("<[^>]+>"), " ")
        .replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&#39;", "'").replace("&quot;", "\"")

    /** The money emails of the last `days` days (newest first, at most `max`). Runs on a background thread. */
    fun money(token: String, days: Int, max: Int, extraQ: String = ""): JSONArray {
        val q = "newer_than:${days.coerceIn(1, 730)}d " + (extraQ.ifBlank { MONEY_Q })
        val list = get("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max.coerceIn(1, 100)}&q=" + URLEncoder.encode(q, "UTF-8"), token)
        val ids = list.optJSONArray("messages") ?: JSONArray()
        val out = JSONArray()
        for (i in 0 until ids.length()) {
            val id = ids.optJSONObject(i)?.optString("id") ?: continue
            try {
                val m = get("https://gmail.googleapis.com/gmail/v1/users/me/messages/$id?format=full", token)
                val pl = m.optJSONObject("payload")
                val hs = pl?.optJSONArray("headers") ?: JSONArray()
                var from = ""; var subj = ""
                for (k in 0 until hs.length()) { val h = hs.optJSONObject(k) ?: continue
                    when (h.optString("name").lowercase()) { "from" -> from = h.optString("value"); "subject" -> subj = h.optString("value") } }
                val (plain, html) = bodyOf(pl)
                val text = (plain.ifBlank { clean(html) }.ifBlank { m.optString("snippet") }).replace(Regex("\\s+"), " ").trim().take(3000)
                if (PayLog.isOtp(subj) || PayLog.isOtp(text.take(400))) continue   // never a one-time code
                out.put(JSONObject().put("id", "gm:" + id).put("kind", "email").put("from", from).put("title", subj).put("text", text)
                    .put("at", m.optString("internalDate").toLongOrNull() ?: 0L).put("link", "https://mail.google.com/mail/#all/" + m.optString("threadId")))
            } catch (e: Exception) { if (e.message?.startsWith("Gmail said no") == true) throw e }
        }
        return out
    }
}
