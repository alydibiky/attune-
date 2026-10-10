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
        close(id)
        val d = dir(ctx, id); val old = File(root(ctx), "$id.old"); old.deleteRecursively()
        if (d.exists() && !d.renameTo(old)) throw Exception("Couldn't replace the old pack")
        if (!next.renameTo(d)) { old.renameTo(d); throw Exception("Couldn't install the pack") }
        old.deleteRecursively()
        return man.put("installed", true)
    }

    fun remove(ctx: Context, id: String): Boolean = try { close(id); dir(ctx, id).deleteRecursively(); true } catch (e: Exception) { false }

    private val STOP = ("the a an of in on at to for and or is are was were be by with from as that this these those it its into about what which who whom " +
        "whose when where why how do does did can could will would should may might than then there their them they he she his her you your i we our not no " +
        "tell me please explain في من على عن الى هو هي ما ماذا متى اين كيف كم هل التي الذي الذين او ثم مع كان كانت هذا هذه ذلك تلك").split(' ').toSet()

    /** Light English stemming for the search key: "currencies" → "currenc", "cranes" → "crane" (then a prefix match). */
    private fun stem(w: String): String {
        if (w.length <= 4 || !w.all { it in 'a'..'z' }) return w
        for (suf in listOf("ies", "ing", "ed", "es", "s")) if (w.endsWith(suf) && w.length - suf.length >= 4) return w.dropLast(suf.length)
        return w
    }

    /** Open pack databases, kept between questions (opening a 100 MB file on every lookup cost more than the search). */
    private val open = HashMap<String, SQLiteDatabase>()
    @Synchronized private fun handle(ctx: Context, id: String): SQLiteDatabase? {
        open[id]?.let { if (it.isOpen) return it }
        val f = File(dir(ctx, id), "$id.sqlite"); if (!f.exists()) return null
        return SQLiteDatabase.openDatabase(f.path, null, SQLiteDatabase.OPEN_READONLY).also { open[id] = it }
    }
    /** Called before a pack is replaced or removed. */
    @Synchronized fun close(id: String) { open.remove(id)?.close() }

    private fun ints(blob: ByteArray): IntArray { val b = ByteBuffer.wrap(blob).order(ByteOrder.nativeOrder()); return IntArray(blob.size / 4) { b.getInt(it * 4) } }
    private val ENDINGS = setOf("s", "es", "ed", "er", "ing")
    private fun near(x: String, w: String) = x == w || (x.startsWith(w) && x.substring(w.length) in ENDINGS)   // "seal" → "seals", not "sealion"

    /**
     * {q, k, ids?} → {passages: [{pack, id, title, text, url, lang, score, cov, notice?, notice_ar?}]} best first.
     * v6.16b (measured in tests/trials/packtrial.mjs: the right passage given 22/24 instead of 12/24):
     *  1. each pack is probed once: how many passages hold each word → how telling each word is, across all the packs;
     *  2. candidates: every passage holding a DISTINCTIVE word (in ≤ 3 % of the pack) — not the first 4,000 rows in storage order;
     *  3. score = BM25 (mild length penalty) × (0.3 + coverage)² × (1 + title coverage) × (1 + name match), where coverage is weighted
     *     by how telling each word is, and "name match" prefers "BYD Seal" over "BYD Seal U" for "BYD Seal".
     * tests/trials/packsearch.py is the same search in Python (keep the two in step).
     */
    fun search(ctx: Context, arg: String): JSONObject {
        val a = JSONObject(arg)
        val words = MapPacks.normalize(a.optString("q")).split(' ').filter { it.length >= 2 && it !in STOP }.map { stem(it) }.distinct().take(10)
        val out = JSONArray()
        if (words.isEmpty()) return JSONObject().put("passages", out)
        val k = a.optInt("k", 24).coerceIn(1, 60)
        val only = a.optJSONArray("ids")?.let { j -> (0 until j.length()).map { j.getString(it) }.toSet() }
        val phr = words.map { it.replace("\"", "") + "*" }
        val orAll = phr.joinToString(" OR ")
        data class Probe(val id: String, val man: JSONObject, val db: SQLiteDatabase, val n: Int, val df: IntArray)
        val probes = ArrayList<Probe>()
        val packs = list(ctx)
        for (p in 0 until packs.length()) {
            val man = packs.getJSONObject(p); val id = man.getString("id")
            if (only != null && id !in only) continue
            try {
                val db = handle(ctx, id) ?: continue
                db.rawQuery("SELECT matchinfo(passages_fts, 'pcnalx') FROM passages_fts WHERE passages_fts MATCH ? LIMIT 1", arrayOf(orAll)).use { c ->
                    if (c.moveToFirst()) { val ii = ints(c.getBlob(0)); val cc = ii[1]; val x0 = 3 + 2 * cc
                        probes.add(Probe(id, man, db, ii[2], IntArray(ii[0]) { ii[x0 + 3 * (it * cc) + 2] })) }
                }
            } catch (e: Exception) { }
        }
        if (probes.isEmpty()) return JSONObject().put("passages", out)
        val bigN = probes.sumOf { it.n }.coerceAtLeast(1)
        val gidf = DoubleArray(words.size) { i -> Math.log(1.0 + bigN.toDouble() / probes.sumOf { it.df[i] }.coerceAtLeast(1)) }
        val tot = gidf.sum()
        data class Hit(val o: JSONObject, val score: Double)
        val hits = ArrayList<Hit>()
        for (pr in probes) {
            try {
                val order = words.indices.sortedBy { pr.df[it] }
                var rare = order.filter { pr.df[it] > 0 && pr.df[it] <= maxOf(200.0, pr.n * 0.03) }
                if (rare.isEmpty()) rare = order.filter { pr.df[it] > 0 }.take(1)
                if (rare.isEmpty()) continue
                if (rare.sumOf { pr.df[it] } > 6000) rare = rare.take(2)
                val q = "(" + rare.joinToString(" OR ") { phr[it] } + ") (" + orAll + ")"
                val nf = rare.size
                val cand = ArrayList<Triple<Long, Double, Double>>()
                pr.db.rawQuery("SELECT rowid, matchinfo(passages_fts, 'pcnalx') FROM passages_fts WHERE passages_fts MATCH ? LIMIT 6000", arrayOf(q)).use { c ->
                    while (c.moveToNext()) {
                        val blob = c.getBlob(1); val ii = ints(blob); val cc = ii[1]
                        var cov = 0.0
                        for (j in words.indices) if (ii[3 + 2 * cc + 3 * ((nf + j) * cc)] > 0) cov += gidf[j]
                        cov /= tot
                        cand.add(Triple(c.getLong(0), bm25(blob) * (0.3 + cov) * (0.3 + cov), cov))
                    }
                }
                cand.sortByDescending { it.second }
                for ((rowid, sc, cov) in cand.take(k * 3)) {
                    pr.db.rawQuery("SELECT title, text, url, lang FROM passages WHERE id = ?", arrayOf(rowid.toString())).use { r ->
                        if (!r.moveToFirst()) return@use
                        val title = r.getString(0) ?: ""
                        val tw = MapPacks.normalize(title).split(' ').filter { it.isNotEmpty() }
                        var tcov = 0.0; for (j in words.indices) if (tw.any { near(it, words[j]) }) tcov += gidf[j]
                        tcov /= tot
                        val head = MapPacks.normalize(title.replace(Regex("\\([^)]*\\)"), " ").split(" — ")[0]).split(' ').filter { it.isNotEmpty() }.toSet()
                        val tprec = if (head.isEmpty()) 0.0 else head.count { x -> words.any { near(x, it) } }.toDouble() / head.size
                        val score = sc * (1 + tcov) * (1 + tprec)
                        hits.add(Hit(JSONObject().put("pack", pr.id).put("id", "${pr.id}:$rowid").put("title", title).put("text", r.getString(1) ?: "")
                            .put("url", r.getString(2) ?: "").put("lang", r.getString(3) ?: "").put("score", score).put("cov", Math.round(cov * 1000) / 1000.0)
                            .put("notice", pr.man.optString("notice")).put("notice_ar", pr.man.optString("notice_ar")), score))
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
            s += idf * (tf * 2.4) / (tf + 1.4 * (0.75 + 0.25 * len / avg))   // v6.16b: a mild length penalty (long = the main model with all its versions)
        }
        return s
    }
}
