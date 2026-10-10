package com.aldibiki.attune

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.GZIPInputStream

/**
 * v6.16 — the public Knowledge packs as ready search databases (Ali: "make the app better in general knowledge … so when I
 * ask the chat anything it answers me"). tools/build_know_pack.py publishes each as the release know-<id>-v2:
 *   manifest.json   {id, name, built, count, files: [{name: "<id>.sqlite.gz", bytes, sha256, gz: true}], notice?, notice_ar?}
 *   <id>.sqlite.gz  passages(id, title, text, url, lang) + passages_fts(key) — FTS4 on the normalised text
 * The phone keeps <id>.sqlite in filesDir/know/<id>/ and searches it here (BM25 from FTS4 matchinfo); nothing is indexed in
 * the page's memory, so the packs can be large. Download, SHA-256 check and swap are the maps' (MapPacks).
 */
object KnowPacks {
    private const val BASE = "https://github.com/alydibiky/attune-/releases/download/"
    private val ID = Regex("^[a-z][a-z0-9-]{1,20}$")
    private val NAME = Regex("^[a-z0-9._-]{1,80}$")

    fun root(ctx: Context): File = File(ctx.filesDir, "know").apply { mkdirs() }
    private fun dir(ctx: Context, id: String): File { require(ID.matches(id)) { "Unknown pack" }; return File(root(ctx), id) }

    /** The packs on the phone: [{id, name, built, count, notice?…, installed}] */
    fun list(ctx: Context): JSONArray {
        val out = JSONArray()
        for (d in root(ctx).listFiles() ?: arrayOf()) {
            if (!d.isDirectory || !ID.matches(d.name)) continue
            val man = File(d, "manifest.json"); val db = File(d, d.name + ".sqlite")
            if (!man.exists() || !db.exists()) continue
            try { out.put(JSONObject(man.readText()).put("installed", true).put("size", db.length())) } catch (e: Exception) { }
        }
        return out
    }

    fun remote(id: String): JSONObject {
        require(ID.matches(id)) { "Unknown pack" }
        return JSONObject(String(MapPacks.get(BASE + "know-$id-v2/manifest.json", null) { false }, Charsets.UTF_8))
    }

    /** Downloads (or updates) a pack; the old one keeps working until the new one is complete and checked. */
    fun install(ctx: Context, id: String, onProgress: (Long, Long, String) -> Unit, isCancelled: () -> Boolean): JSONObject {
        val man = remote(id)
        val files = man.getJSONArray("files")
        var total = 0L; for (i in 0 until files.length()) total += files.getJSONObject(i).getLong("bytes")
        val next = File(root(ctx), "$id.next").apply { deleteRecursively(); mkdirs() }
        var done = 0L
        for (i in 0 until files.length()) {
            val f = files.getJSONObject(i); val name = f.getString("name"); val size = f.getLong("bytes")
            if (!NAME.matches(name)) throw Exception("Unexpected file in the pack: $name")
            val part = File(root(ctx), "$id-$name.part")              // outside .next, so a stopped download resumes
            val base = done
            MapPacks.fetchResumable(BASE + "know-$id-v2/$name", part, size, isCancelled) { got -> onProgress(base + got, total, name) }
            MapPacks.verify(part, f.optString("sha256"), name)
            val target = File(next, "$id.sqlite")
            if (f.optBoolean("gz")) {
                GZIPInputStream(part.inputStream().buffered()).use { inp -> target.outputStream().use { inp.copyTo(it, 1 shl 16) } }
                part.delete()
            } else if (!part.renameTo(target)) throw Exception("Couldn't save $name")
            done += size; onProgress(done, total, name)
        }
        File(next, "manifest.json").writeText(man.toString())
        val d = dir(ctx, id); val old = File(root(ctx), "$id.old"); old.deleteRecursively()
        if (d.exists() && !d.renameTo(old)) throw Exception("Couldn't replace the old pack")
        if (!next.renameTo(d)) { old.renameTo(d); throw Exception("Couldn't install the pack") }
        old.deleteRecursively()
        return man.put("installed", true)
    }

    fun remove(ctx: Context, id: String): Boolean = try { dir(ctx, id).deleteRecursively(); true } catch (e: Exception) { false }

    private val STOP = ("the a an of in on at to for and or is are was were be by with from as that this these those it its into about what which who whom " +
        "whose when where why how do does did can could will would should may might than then there their them they he she his her you your i we our not no " +
        "tell me please explain في من على عن الى هو هي ما ماذا متى اين كيف كم هل التي الذي الذين او ثم مع كان كانت هذا هذه ذلك تلك").split(' ').toSet()

    /** Light English stemming for the search key: "currencies" → "currenc", "cranes" → "crane" (then a prefix match). */
    private fun stem(w: String): String {
        if (w.length <= 4 || !w.all { it in 'a'..'z' }) return w
        for (suf in listOf("ies", "ing", "ed", "es", "s")) if (w.endsWith(suf) && w.length - suf.length >= 4) return w.dropLast(suf.length)
        return w
    }

    /**
     * {q, k, ids?} → {passages: [{pack, id, title, text, url, lang, score, notice?, notice_ar?}]} best first (BM25 over the packs).
     * Words are normalised like the packs, common words dropped, each searched as a prefix, any of them may match.
     */
    fun search(ctx: Context, arg: String): JSONObject {
        val a = JSONObject(arg)
        val words = MapPacks.normalize(a.optString("q")).split(' ').filter { it.length >= 2 && it !in STOP }.map { stem(it) }.distinct().take(10)
        val out = JSONArray()
        if (words.isEmpty()) return JSONObject().put("passages", out)
        val k = a.optInt("k", 24).coerceIn(1, 60)
        val only = a.optJSONArray("ids")?.let { j -> (0 until j.length()).map { j.getString(it) }.toSet() }
        val match = words.joinToString(" OR ") { it.replace("\"", "") + "*" }
        data class Hit(val o: JSONObject, val score: Double)
        val hits = ArrayList<Hit>()
        val packs = list(ctx)
        for (p in 0 until packs.length()) {
            val man = packs.getJSONObject(p); val id = man.getString("id")
            if (only != null && id !in only) continue
            val db = File(dir(ctx, id), "$id.sqlite")
            try {
                SQLiteDatabase.openDatabase(db.path, null, SQLiteDatabase.OPEN_READONLY).use { sq ->
                    sq.rawQuery("SELECT rowid, matchinfo(passages_fts, 'pcnalx') FROM passages_fts WHERE passages_fts MATCH ? LIMIT 4000", arrayOf(match)).use { c ->
                        val scored = ArrayList<Pair<Long, Double>>()
                        while (c.moveToNext()) scored.add(c.getLong(0) to bm25(c.getBlob(1)))
                        scored.sortByDescending { it.second }
                        for ((rowid, score) in scored.take(k)) {
                            sq.rawQuery("SELECT title, text, url, lang FROM passages WHERE id = ?", arrayOf(rowid.toString())).use { r ->
                                if (r.moveToFirst()) hits.add(Hit(JSONObject().put("pack", id).put("id", "$id:$rowid").put("title", r.getString(0) ?: "").put("text", r.getString(1) ?: "")
                                    .put("url", r.getString(2) ?: "").put("lang", r.getString(3) ?: "").put("score", score)
                                    .put("notice", man.optString("notice")).put("notice_ar", man.optString("notice_ar")), score))
                            }
                        }
                    }
                }
            } catch (e: Exception) { }
        }
        hits.sortByDescending { it.score }
        for (h in hits.take(k)) out.put(h.o)
        return JSONObject().put("passages", out)
    }

    /** BM25 from FTS4 matchinfo('pcnalx') with one indexed column. */
    private fun bm25(blob: ByteArray): Double {
        val b = ByteBuffer.wrap(blob).order(ByteOrder.nativeOrder())
        val ints = IntArray(blob.size / 4) { b.getInt(it * 4) }
        val p = ints[0]; val c = ints[1]; val n = ints[2].toDouble()
        val avg = ints[3].toDouble().coerceAtLeast(1.0)                 // a: average tokens per row (column 0)
        val len = ints[3 + c].toDouble()                                  // l: tokens in this row (column 0)
        val x0 = 3 + 2 * c                                                // x: 3 ints per (phrase, column)
        var s = 0.0
        for (i in 0 until p) {
            val o = x0 + 3 * (i * c)
            val tf = ints[o].toDouble(); val df = ints[o + 2].toDouble()
            if (tf <= 0) continue
            val idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
            s += idf * (tf * 2.4) / (tf + 1.4 * (0.3 + 0.7 * len / avg))
        }
        return s
    }
}
