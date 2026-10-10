package com.aldibiki.attune

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.text.Normalizer
import java.util.zip.ZipInputStream

/**
 * v6.15 — whole-country offline maps (Ali: "download a whole country at once … every time something updates I can
 * install the map with the updates"). A pack is published by the "Build a country map" workflow
 * (tools/build_map_pack.py) as the release map-<code>:
 *   <code>-manifest.json  {code, name, date (OSM data date), built, files: [{name, bytes, sha256}]}
 *   <code>.pmtiles        the vector map (Protomaps' OpenStreetMap build, cut to the country)
 *   <code>-places.sqlite  the offline search index (every named street, place and shop; FTS4 on a normalised key)
 * The shared fonts and icons are the release map-assets (assets-manifest.json + map-assets.zip).
 * Files go to filesDir/maps/<code>/; an update downloads beside the old pack and replaces it only when complete
 * and verified, so the map keeps working during an update and after a failed one.
 */
object MapPacks {
    private const val BASE = "https://github.com/alydibiky/attune-/releases/download/"
    private val CODE = Regex("^[a-z]{2,4}$")
    private val NAME = Regex("^[a-z0-9._-]{1,80}$")

    class Cancelled : Exception("Cancelled")

    fun root(ctx: Context): File = File(ctx.filesDir, "maps").apply { mkdirs() }
    private fun dir(ctx: Context, code: String): File {
        require(CODE.matches(code)) { "Unknown map" }
        return File(root(ctx), code)
    }

    /** The packs on the phone: [{code, name, date, built, bytes, files}] — only complete ones. */
    fun list(ctx: Context): JSONArray {
        val out = JSONArray()
        for (d in root(ctx).listFiles() ?: arrayOf()) {
            if (!d.isDirectory || !CODE.matches(d.name)) continue
            val man = File(d, "manifest.json"); if (!man.exists()) continue
            try {
                val j = JSONObject(man.readText())
                var bytes = 0L; var ok = true
                val files = j.getJSONArray("files")
                for (i in 0 until files.length()) {
                    val f = files.getJSONObject(i); val local = File(d, f.getString("name"))
                    if (!local.exists() || local.length() != f.getLong("bytes")) ok = false else bytes += local.length()
                }
                if (ok) out.put(j.put("bytes", bytes).put("installed", true))
            } catch (e: Exception) { }
        }
        return out
    }

    fun assetsInstalled(ctx: Context): Boolean = File(root(ctx), "assets/assets-manifest.json").exists()

    /** The published manifest of a country (what an update would bring). */
    fun remote(code: String): JSONObject {
        require(CODE.matches(code)) { "Unknown map" }
        return JSONObject(String(get(BASE + "map-$code/$code-manifest.json", null, { false }), Charsets.UTF_8))
    }

    /** Downloads (or updates) a country's pack and, the first time, the shared fonts and icons. */
    fun install(ctx: Context, code: String, onProgress: (Long, Long, String) -> Unit, isCancelled: () -> Boolean): JSONObject {
        val man = remote(code)
        val files = man.getJSONArray("files")
        val needAssets = !assetsInstalled(ctx)
        val assetsMan = if (needAssets) JSONObject(String(get(BASE + "map-assets/assets-manifest.json", null, isCancelled), Charsets.UTF_8)) else null
        var total = 0L
        for (i in 0 until files.length()) total += files.getJSONObject(i).getLong("bytes")
        assetsMan?.getJSONArray("files")?.let { for (i in 0 until it.length()) total += it.getJSONObject(i).getLong("bytes") }
        var done = 0L

        // the shared fonts and icons (a few MB, once)
        if (assetsMan != null) {
            val tmp = File(root(ctx), "assets.new").apply { deleteRecursively(); mkdirs() }
            val af = assetsMan.getJSONArray("files")
            for (i in 0 until af.length()) {
                val f = af.getJSONObject(i); val name = f.getString("name")
                if (!NAME.matches(name)) throw Exception("Unexpected file in the map fonts: $name")
                val zip = File(root(ctx), "$name.part")
                val base = done
                fetchResumable(BASE + "map-assets/$name", zip, f.getLong("bytes"), isCancelled) { got -> onProgress(base + got, total, name) }
                verify(zip, f.getString("sha256"), name)
                unzip(zip, tmp); zip.delete()
                done += f.getLong("bytes")
            }
            File(tmp, "assets-manifest.json").writeText(assetsMan.toString())
            val dest = File(root(ctx), "assets"); dest.deleteRecursively()
            if (!tmp.renameTo(dest)) throw Exception("Couldn't save the map fonts")
        }

        // the country: downloaded beside the old pack, swapped in when complete
        val d = dir(ctx, code)
        val next = File(root(ctx), "$code.next").apply { mkdirs() }
        for (i in 0 until files.length()) {
            val f = files.getJSONObject(i); val name = f.getString("name"); val size = f.getLong("bytes")
            if (!NAME.matches(name)) throw Exception("Unexpected file in the map: $name")
            val target = File(next, name)
            val base = done
            if (!(target.exists() && target.length() == size)) {
                val part = File(next, "$name.part")
                val parts = f.optJSONArray("parts")
                if (parts == null) fetchResumable(BASE + "map-$code/$name", part, size, isCancelled) { got -> onProgress(base + got, total, name) }
                else {
                    // a file over GitHub's 2 GB limit comes in parts: each is appended to the same file (resumable across parts)
                    var start = 0L
                    for (k in 0 until parts.length()) {
                        val pk = parts.getJSONObject(k); val pn = pk.getString("name"); val pb = pk.getLong("bytes")
                        if (!NAME.matches(pn)) throw Exception("Unexpected file in the map: $pn")
                        if (part.length() < start + pb) {
                            val s0 = start
                            fetchInto(BASE + "map-$code/$pn", part, s0, pb, isCancelled) { got -> onProgress(base + s0 + got, total, name) }
                        }
                        start += pb
                    }
                    if (part.length() != size) throw Exception("The map download stopped early — tap Download again to continue")
                }
                verify(part, f.optString("sha256"), name)
                if (!part.renameTo(target)) throw Exception("Couldn't save $name")
            }
            done += size; onProgress(done, total, name)
        }
        File(next, "manifest.json").writeText(man.toString())
        val trash = File(root(ctx), "$code.old"); trash.deleteRecursively()
        if (d.exists() && !d.renameTo(trash)) throw Exception("Couldn't replace the old map")
        if (!next.renameTo(d)) { trash.renameTo(d); throw Exception("Couldn't install the map") }
        trash.deleteRecursively()
        return man.put("installed", true)
    }

    fun remove(ctx: Context, code: String): Boolean = try {
        dir(ctx, code).deleteRecursively(); File(root(ctx), "$code.next").deleteRecursively(); true
    } catch (e: Exception) { false }

    /** Bytes of a file under maps/ for the page: {path, offset, length (-1 = whole file, ≤ 8 MB)} → base64, "" if missing. */
    fun read(ctx: Context, arg: String): String {
        val a = JSONObject(arg)
        val rel = a.getString("path")
        if (rel.contains("..") || rel.startsWith("/")) return ""
        val f = File(root(ctx), rel)
        if (!f.canonicalPath.startsWith(root(ctx).canonicalPath + File.separator) || !f.isFile) return ""
        val off = a.optLong("offset", 0L).coerceAtLeast(0L)
        var len = a.optLong("length", -1L)
        if (len < 0) len = (f.length() - off).coerceAtMost(8_000_000L)
        len = len.coerceAtMost(f.length() - off).coerceAtMost(32_000_000L)
        if (len <= 0) return ""
        val buf = ByteArray(len.toInt())
        RandomAccessFile(f, "r").use { it.seek(off); it.readFully(buf) }
        return android.util.Base64.encodeToString(buf, android.util.Base64.NO_WRAP)
    }

    /** The search index's text normalisation — the same as offlinemap.js normalize() and tools/build_map_pack.py. */
    fun normalize(s: String): String {
        var t = s.lowercase().replace('\u0670', 'ا')   // the dagger alef (ٰ) is an alef
            .replace(Regex("[ً-ْـ\u06D6-\u06ED]"), "")
            .replace(Regex("[أإآٱ]"), "ا").replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')
            .replace('ı', 'i')
        t = buildString { for (ch in t) append(when (ch) { in '٠'..'٩' -> '0' + (ch - '٠'); in '۰'..'۹' -> '0' + (ch - '۰'); else -> ch }) }   // ٩٠ = 90
        t = Normalizer.normalize(t, Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "")
        return t.replace(Regex("[^\\p{L}\\p{N}]+"), " ").trim()
    }

    /** Offline search in the installed packs: {q, limit, lat, lon} → [{name, name_ar, name_en, kind, lat, lon, code}] */
    fun search(ctx: Context, arg: String): JSONArray {
        val a = JSONObject(arg)
        val words = normalize(a.optString("q")).split(' ').filter { it.isNotEmpty() }.take(6)
        val kinds = a.optJSONArray("kinds")?.let { k -> (0 until k.length()).map { k.getString(it) }.filter { Regex("^[a-z_]+/[a-z_]+$").matches(it) } } ?: emptyList()
        val out = JSONArray()
        if (words.isEmpty() && kinds.isEmpty()) return out
        val limit = a.optInt("limit", 12).coerceIn(1, 50)
        val lat = a.optDouble("lat", Double.NaN); val lon = a.optDouble("lon", Double.NaN)
        val match = words.joinToString(" ") { w -> w.replace("\"", "") + "*" }
        data class Hit(val o: JSONObject, val rank: Int, val dist: Double)
        val hits = ArrayList<Hit>()
        val packs = list(ctx)
        for (p in 0 until packs.length()) {
            val code = packs.getJSONObject(p).getString("code")
            val db = File(dir(ctx, code), "$code-places.sqlite"); if (!db.exists()) continue
            try {
                SQLiteDatabase.openDatabase(db.path, null, SQLiteDatabase.OPEN_READONLY).use { sq ->
                    // a category near the map's centre ("Fuel", "Pharmacy"), or words anywhere in the country
                    val cur = if (kinds.isNotEmpty() && !lat.isNaN() && !lon.isNaN()) {
                        val d = a.optDouble("radiusDeg", 0.25)
                        sq.rawQuery("SELECT name, name_ar, name_en, kind, lat, lon, rank FROM places WHERE kind IN (" + kinds.joinToString(",") { "?" } + ") AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? LIMIT 2000",
                            (kinds + listOf((lat - d).toString(), (lat + d).toString(), (lon - d).toString(), (lon + d).toString())).toTypedArray())
                    } else sq.rawQuery("SELECT p.name, p.name_ar, p.name_en, p.kind, p.lat, p.lon, p.rank FROM places_fts f JOIN places p ON p.id = f.rowid WHERE f.key MATCH ? LIMIT 400", arrayOf(match))
                    cur.use { c ->
                        while (c.moveToNext()) {
                            val plat = c.getDouble(4); val plon = c.getDouble(5)
                            val dist = if (lat.isNaN() || lon.isNaN()) 0.0 else haversineKm(lat, lon, plat, plon)
                            hits.add(Hit(JSONObject().put("name", c.getString(0) ?: "").put("name_ar", c.getString(1) ?: "").put("name_en", c.getString(2) ?: "")
                                .put("kind", c.getString(3) ?: "").put("lat", plat).put("lon", plon).put("code", code).put("dist", Math.round(dist * 10) / 10.0), c.getInt(6), dist))
                        }
                    }
                }
            } catch (e: Exception) { }
        }
        // the most important kinds first (city > town > … > shop), then the nearest
        if (kinds.isNotEmpty()) hits.sortBy { it.dist } else hits.sortWith(compareBy<Hit>({ -it.rank / 10 }, { it.dist }))
        for (h in hits.take(limit)) out.put(h.o)
        return out
    }

    private fun haversineKm(a1: Double, o1: Double, a2: Double, o2: Double): Double {
        val r = 6371.0; val dLat = Math.toRadians(a2 - a1); val dLon = Math.toRadians(o2 - o1)
        val h = Math.sin(dLat / 2).let { it * it } + Math.cos(Math.toRadians(a1)) * Math.cos(Math.toRadians(a2)) * Math.sin(dLon / 2).let { it * it }
        return 2 * r * Math.asin(Math.sqrt(h))
    }

    internal fun sha256(f: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        f.inputStream().use { inp -> val buf = ByteArray(1 shl 16); var n: Int; while (inp.read(buf).also { n = it } > 0) md.update(buf, 0, n) }
        return md.digest().joinToString("") { "%02x".format(it) }
    }
    internal fun verify(f: File, want: String, name: String) {
        if (want.isEmpty()) return
        if (sha256(f) != want.lowercase()) { f.delete(); throw Exception("$name arrived damaged — download it again") }
    }

    private fun unzip(zip: File, into: File) {
        val base = into.canonicalPath + File.separator
        ZipInputStream(zip.inputStream().buffered()).use { z ->
            var e = z.nextEntry
            while (e != null) {
                val out = File(into, e.name)
                if (!out.canonicalPath.startsWith(base)) throw Exception("Bad file in the map fonts")
                if (e.isDirectory) out.mkdirs() else { out.parentFile?.mkdirs(); out.outputStream().use { z.copyTo(it) } }
                e = z.nextEntry
            }
        }
    }

    /** Downloads `url` into `part`, continuing from where an earlier try stopped (HTTP Range). */
    internal fun fetchResumable(url: String, part: File, size: Long, isCancelled: () -> Boolean, onBytes: (Long) -> Unit) {
        if (part.exists() && part.length() > size) part.delete()
        if (part.exists() && part.length() == size) { onBytes(size); return }
        Prefs.requireOnline(url, "map")
        var from = if (part.exists()) part.length() else 0L
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 20_000; c.readTimeout = 90_000; c.instanceFollowRedirects = true
        c.setRequestProperty("User-Agent", "Attune/6.16 (Android; offline map)")
        if (from > 0) c.setRequestProperty("Range", "bytes=$from-")
        try {
            val code = c.responseCode
            if (code == 404) throw Exception("This map is not published yet — run \"Build a country map\" on GitHub for it once")
            if (code !in 200..299) throw Exception("The map download returned HTTP $code")
            if (code == 200 && from > 0) { from = 0; part.delete() }   // the server ignored Range: start over
            val buf = ByteArray(1 shl 16)
            c.inputStream.use { inp ->
                java.io.FileOutputStream(part, from > 0).use { out ->
                    var n: Int; var got = from; var last = got
                    while (inp.read(buf).also { n = it } > 0) {
                        if (isCancelled()) throw Cancelled()
                        out.write(buf, 0, n); got += n
                        if (got - last > 2_000_000) { last = got; onBytes(got) }
                    }
                    onBytes(got)
                }
            }
            if (part.length() != size) throw Exception("The map download stopped early — tap Download again to continue")
        } finally { try { c.disconnect() } catch (e: Exception) {} }
    }

    /** Appends one part (bytes [start, start+size) of the joined file) to `file`, continuing a stopped part. */
    private fun fetchInto(url: String, file: File, start: Long, size: Long, isCancelled: () -> Boolean, onBytes: (Long) -> Unit) {
        if (file.length() < start) throw Exception("The map download is out of order — delete it and download again")
        if (file.length() > start + size) return
        Prefs.requireOnline(url, "map")
        val from = file.length() - start
        if (from == size) { onBytes(size); return }
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 20_000; c.readTimeout = 90_000; c.instanceFollowRedirects = true
        c.setRequestProperty("User-Agent", "Attune/6.16 (Android; offline map)")
        if (from > 0) c.setRequestProperty("Range", "bytes=$from-")
        try {
            val code = c.responseCode
            if (code !in 200..299) throw Exception("The map download returned HTTP $code")
            val skip = if (code == 200 && from > 0) from else 0L      // the server ignored Range: skip what we have
            val buf = ByteArray(1 shl 16)
            c.inputStream.use { inp ->
                var toSkip = skip
                while (toSkip > 0) { val n = inp.skip(toSkip); if (n <= 0) break; toSkip -= n }
                java.io.FileOutputStream(file, true).use { out ->
                    var n: Int; var got = from; var last = got
                    while (inp.read(buf).also { n = it } > 0) {
                        if (isCancelled()) throw Cancelled()
                        out.write(buf, 0, n); got += n
                        if (got - last > 2_000_000) { last = got; onBytes(got) }
                    }
                    onBytes(got)
                }
            }
            if (file.length() != start + size) throw Exception("The map download stopped early — tap Download again to continue")
        } finally { try { c.disconnect() } catch (e: Exception) {} }
    }

    /** One small file (a manifest) → bytes. */
    internal fun get(url: String, to: File?, isCancelled: () -> Boolean): ByteArray {
        Prefs.requireOnline(url, "map")
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15_000; c.readTimeout = 30_000; c.instanceFollowRedirects = true
        c.setRequestProperty("User-Agent", "Attune/6.16 (Android; offline map)")
        try {
            val code = c.responseCode
            if (code == 404) throw Exception("This map is not published yet — run \"Build a country map\" on GitHub for it once")
            if (code !in 200..299) throw Exception("The map server returned HTTP $code")
            val out = java.io.ByteArrayOutputStream()
            c.inputStream.use { inp -> val buf = ByteArray(16384); var n: Int; while (inp.read(buf).also { n = it } > 0) { if (isCancelled()) throw Cancelled(); out.write(buf, 0, n); if (out.size() > 1_000_000) throw Exception("The map list is too big") } }
            return out.toByteArray()
        } finally { try { c.disconnect() } catch (e: Exception) {} }
    }
}
