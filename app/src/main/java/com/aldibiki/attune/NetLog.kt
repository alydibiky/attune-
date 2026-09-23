package com.aldibiki.attune

import org.json.JSONArray
import org.json.JSONObject
import java.net.URI

/**
 * Every connection the app makes, or refuses, in this session — the proof
 * behind "nothing leaves this phone". Shown on the Engine screen.
 *
 * Only the host and the reason are kept, never the full address or anything
 * that was sent, so the log itself holds nothing private.
 */
object NetLog {
    private const val MAX = 300

    data class Entry(val t: Long, val host: String, val what: String, val blocked: Boolean)

    private val entries = ArrayDeque<Entry>()

    fun hostOf(url: String): String = try { URI(url).host ?: url.take(60) } catch (e: Exception) { url.take(60) }

    @Synchronized
    fun add(url: String, what: String, blocked: Boolean = false) {
        entries.addLast(Entry(System.currentTimeMillis(), hostOf(url), what, blocked))
        while (entries.size > MAX) entries.removeFirst()
    }

    @Synchronized
    fun toJson(): JSONObject {
        val arr = JSONArray()
        for (e in entries.reversed()) arr.put(JSONObject()
            .put("t", e.t).put("host", e.host).put("what", e.what).put("blocked", e.blocked))
        return JSONObject().put("entries", arr)
            .put("sent", entries.count { !it.blocked })
            .put("blocked", entries.count { it.blocked })
    }

    @Synchronized
    fun clear() = entries.clear()
}
