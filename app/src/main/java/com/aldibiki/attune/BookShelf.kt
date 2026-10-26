package com.aldibiki.attune

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.util.zip.ZipInputStream

/**
 * v8.3 Library at scale (Ali, 26 Oct 2026: "make a topic called History, upload all my history books, and when I need a history
 * reference it goes to these books — and make it handle huge context, 20 GB of books at least").
 *
 * The books are not kept in the page (its storage is small and the page would have to hold every book in memory). They live here:
 *  - books.db (SQLite, the app's private folder): `topics`, `books` (name, topic, the file's address, pages, state) and `chunks`,
 *    an FTS4 full-text index of every passage (~900 characters) with its book and page. The indexed column is the passage
 *    NORMALISED (Arabic without tashkeel, أ/إ/آ → ا, ة → ه, ى → ي, Arabic digits → 0-9, lower case), so «الصلاة» finds «الصَّلاة».
 *    `chunks_terms` (fts4aux) knows how many passages hold each word — rare words are searched first.
 *  - The original files stay where they are (the person's own folders); only their text is kept, so 20 GB of PDFs is a few GB.
 *  - Reading is done by BookIngestService (a foreground service, so a long import keeps going with Attune in the background): one
 *    page at a time (PDFBox with a temp-file cache, never the whole file in memory), committed every 20 pages; a stopped import
 *    resumes from the last page it saved.
 *  - search(): the rare words of the question → FTS MATCH (all of them first, then any of them) → BM25 from matchinfo → the best
 *    passages of each book, the strongest books first. Milliseconds on millions of passages; the model only reads what is found.
 */
object BookShelf {
    private const val CHUNK = 900
    @Volatile var job: JSONObject = JSONObject()   // what the service is reading now: {book, name, page, pages}

    class Db(ctx: Context) : SQLiteOpenHelper(ctx.applicationContext, "books.db", null, 1) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("CREATE TABLE topics(name TEXT PRIMARY KEY, created INTEGER)")
            db.execSQL("CREATE TABLE books(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, topic TEXT, kind TEXT, uri TEXT, bytes INTEGER, pages INTEGER DEFAULT 0, done INTEGER DEFAULT 0, chunks INTEGER DEFAULT 0, scans INTEGER DEFAULT 0, state TEXT, err TEXT, added INTEGER)")
            try { db.execSQL("CREATE VIRTUAL TABLE chunks USING fts4(norm, text, book, page, notindexed=text, notindexed=book, notindexed=page, tokenize=unicode61)") }
            catch (e: Exception) { db.execSQL("CREATE VIRTUAL TABLE chunks USING fts4(norm, text, book, page, notindexed=text, notindexed=book, notindexed=page)") }
            db.execSQL("CREATE VIRTUAL TABLE chunks_terms USING fts4aux(chunks)")
        }
        override fun onUpgrade(db: SQLiteDatabase, a: Int, b: Int) {}
    }
    @Volatile private var dbh: Db? = null
    fun db(ctx: Context): SQLiteDatabase = (dbh ?: synchronized(this) { dbh ?: Db(ctx).also { dbh = it } }).writableDatabase

    // ---- words ------------------------------------------------------------------------------------------------------------------
    private val TASHKEEL = Regex("[\\u064B-\\u0652\\u0670\\u0640]")
    private val NOT_WORD = Regex("[^\\p{L}\\p{N}]+")
    fun norm(s: String): String {
        val sb = StringBuilder(s.length)
        for (ch in s) sb.append(when (ch) {
            in '٠'..'٩' -> '0' + (ch - '٠'); in '۰'..'۹' -> '0' + (ch - '۰')
            'أ', 'إ', 'آ', 'ٱ' -> 'ا'; 'ة' -> 'ه'; 'ى' -> 'ي'
            else -> ch
        })
        return sb.toString().replace(TASHKEEL, "").lowercase().replace(NOT_WORD, " ").trim()
    }
    private val STOP = setOf("the", "a", "an", "of", "in", "on", "at", "to", "and", "or", "is", "was", "were", "are", "be", "by", "for", "with", "what", "who", "when", "where",
        "why", "how", "did", "does", "do", "this", "that", "these", "those", "it", "its", "as", "from", "about", "which", "tell", "me", "explain", "happened",
        "في", "من", "علي", "على", "الي", "إلى", "الى", "عن", "ما", "ماذا", "هو", "هي", "هل", "كان", "كانت", "التي", "الذي", "ان", "أن", "إن", "او", "أو", "و", "ده", "دي", "ايه", "إيه", "اللي", "مين", "ليه", "امتي", "إزاي", "ازاي")
    fun words(q: String): List<String> = norm(q).split(' ').filter { it.length > 1 && it !in STOP }.distinct()

    /** A page → passages of about 900 characters, cut at paragraph or sentence ends. */
    fun chunks(text: String): List<String> {
        val out = ArrayList<String>(); val cur = StringBuilder()
        for (para in text.replace("\r", "").split(Regex("\\n\\s*\\n|\\n(?=[A-Z0-9•\\-–—])"))) {
            val p = para.trim(); if (p.isEmpty()) continue
            if (cur.isNotEmpty() && cur.length + p.length > CHUNK) { out.add(cur.toString()); cur.setLength(0) }
            if (p.length > CHUNK * 1.5) {
                for (s in p.split(Regex("(?<=[.!?؟۔])\\s+"))) { if (cur.isNotEmpty() && cur.length + s.length > CHUNK) { out.add(cur.toString()); cur.setLength(0) }; if (cur.isNotEmpty()) cur.append(' '); cur.append(s) }
            } else { if (cur.isNotEmpty()) cur.append('\n'); cur.append(p) }
        }
        if (cur.isNotBlank()) out.add(cur.toString())
        return out
    }

    // ---- topics and books -----------------------------------------------------------------------------------------------------------
    fun state(ctx: Context): JSONObject {
        val d = db(ctx); val topics = JSONArray(); val books = JSONArray()
        d.rawQuery("SELECT name FROM topics ORDER BY created", null).use { c -> while (c.moveToNext()) topics.put(c.getString(0)) }
        d.rawQuery("SELECT id, name, topic, kind, bytes, pages, done, chunks, scans, state, err FROM books ORDER BY added DESC", null).use { c ->
            while (c.moveToNext()) books.put(JSONObject().put("id", c.getLong(0)).put("name", c.getString(1)).put("topic", c.getString(2) ?: "").put("kind", c.getString(3))
                .put("bytes", c.getLong(4)).put("pages", c.getInt(5)).put("done", c.getInt(6)).put("chunks", c.getInt(7)).put("scans", c.getInt(8)).put("state", c.getString(9)).put("err", c.getString(10) ?: ""))
        }
        val size = try { ctx.getDatabasePath("books.db").length() } catch (e: Exception) { 0L }
        return JSONObject().put("topics", topics).put("books", books).put("job", job).put("dbBytes", size)
    }
    fun topic(ctx: Context, a: JSONObject): JSONObject {
        val d = db(ctx); val name = a.optString("name").trim().take(60)
        when (a.optString("op")) {
            "add" -> if (name.isNotEmpty()) d.insertWithOnConflict("topics", null, ContentValues().apply { put("name", name); put("created", System.currentTimeMillis()) }, SQLiteDatabase.CONFLICT_IGNORE)
            "rename" -> { val to = a.optString("to").trim().take(60); if (to.isNotEmpty()) { d.execSQL("UPDATE topics SET name=? WHERE name=?", arrayOf<Any>(to, name)); d.execSQL("UPDATE books SET topic=? WHERE topic=?", arrayOf<Any>(to, name)) } }
            "delete" -> { d.execSQL("DELETE FROM topics WHERE name=?", arrayOf<Any>(name)); d.execSQL("UPDATE books SET topic='' WHERE topic=?", arrayOf<Any>(name)) }   // the books stay, without a topic
            "move" -> d.execSQL("UPDATE books SET topic=? WHERE id=?", arrayOf<Any>(name, a.optLong("book")))
        }
        return state(ctx)
    }
    fun remove(ctx: Context, id: Long): JSONObject {
        val d = db(ctx)
        d.execSQL("UPDATE books SET state='cancel' WHERE id=? AND state IN ('queued','reading')", arrayOf<Any>(id))
        d.execSQL("DELETE FROM chunks WHERE book=?", arrayOf<Any>(id.toString()))
        d.execSQL("DELETE FROM books WHERE id=?", arrayOf<Any>(id))
        return state(ctx)
    }

    /** Files (or every book in a picked folder) → queued under a topic; the service reads them one by one. */
    fun enqueue(ctx: Context, uris: List<Uri>, topic: String) {
        val d = db(ctx); val now = System.currentTimeMillis()
        if (topic.isNotEmpty()) d.insertWithOnConflict("topics", null, ContentValues().apply { put("name", topic); put("created", now) }, SQLiteDatabase.CONFLICT_IGNORE)
        val files = ArrayList<Pair<Uri, String>>()
        for (u in uris) {
            try { ctx.contentResolver.takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION) } catch (e: Exception) {}
            if (DocumentsContract.isTreeUri(u) && !DocumentsContract.isDocumentUri(ctx, u)) walk(ctx, u, DocumentsContract.getTreeDocumentId(u), files, 0) else files.add(u to nameOf(ctx, u))
        }
        for ((u, name) in files) {
            val kind = kindOf(name); if (kind.isEmpty()) continue
            val bytes = sizeOf(ctx, u)
            // the same book again (same name and size) is not read twice — it only moves to this topic
            val dup = d.rawQuery("SELECT id FROM books WHERE name=? AND bytes=?", arrayOf(name, bytes.toString())).use { c -> if (c.moveToFirst()) c.getLong(0) else -1L }
            if (dup >= 0) { if (topic.isNotEmpty()) d.execSQL("UPDATE books SET topic=? WHERE id=?", arrayOf<Any>(topic, dup)); continue }
            d.insert("books", null, ContentValues().apply { put("name", name); put("topic", topic); put("kind", kind); put("uri", u.toString()); put("bytes", bytes); put("state", "queued"); put("added", now) })
        }
        BookIngestService.start(ctx)
    }
    private fun walk(ctx: Context, tree: Uri, docId: String, out: ArrayList<Pair<Uri, String>>, depth: Int) {
        if (depth > 8 || out.size > 20000) return
        val kids = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId)
        ctx.contentResolver.query(kids, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE), null, null, null)?.use { c ->
            while (c.moveToNext()) {
                val id = c.getString(0); val name = c.getString(1) ?: ""; val mime = c.getString(2) ?: ""
                if (mime == DocumentsContract.Document.MIME_TYPE_DIR) walk(ctx, tree, id, out, depth + 1)
                else if (kindOf(name).isNotEmpty()) out.add(DocumentsContract.buildDocumentUriUsingTree(tree, id) to name)
            }
        }
    }
    private fun nameOf(ctx: Context, u: Uri): String = try { ctx.contentResolver.query(u, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null } } catch (e: Exception) { null } ?: (u.lastPathSegment ?: "book")
    private fun sizeOf(ctx: Context, u: Uri): Long = try { ctx.contentResolver.query(u, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { c -> if (c.moveToFirst() && !c.isNull(0)) c.getLong(0) else 0L } } catch (e: Exception) { 0L } ?: 0L
    fun kindOf(name: String): String = when (name.substringAfterLast('.', "").lowercase()) { "pdf" -> "pdf"; "epub" -> "epub"; "docx" -> "docx"; "txt", "md" -> "text"; "html", "htm" -> "html"; else -> "" }

    // ---- reading one book (on the service's thread) ---------------------------------------------------------------------------------
    /** → true when finished (or cancelled), false when the service is stopping (it resumes later from `done`). */
    fun readOne(ctx: Context, id: Long, keepGoing: () -> Boolean): Boolean {
        val d = db(ctx)
        var name = ""; var kind = ""; var uri = ""; var done = 0
        d.rawQuery("SELECT name, kind, uri, done FROM books WHERE id=?", arrayOf(id.toString())).use { c -> if (!c.moveToFirst()) return true; name = c.getString(0); kind = c.getString(1); uri = c.getString(2); done = c.getInt(3) }
        d.execSQL("UPDATE books SET state='reading', err=NULL WHERE id=?", arrayOf<Any>(id))
        val batch = ArrayList<Pair<Int, String>>(); var chunksAdded = 0; var scans = 0; var lastPage = done
        fun flush(total: Int) {
            if (batch.isEmpty()) { d.execSQL("UPDATE books SET pages=?, done=? WHERE id=?", arrayOf<Any>(total, lastPage, id)); return }
            d.beginTransaction()
            try {
                for ((page, text) in batch) for (ch in chunks(text)) {
                    d.insert("chunks", null, ContentValues().apply { put("norm", norm(ch)); put("text", ch); put("book", id.toString()); put("page", page.toString()) }); chunksAdded++
                }
                d.execSQL("UPDATE books SET pages=?, done=?, chunks=chunks+?, scans=scans+? WHERE id=?", arrayOf<Any>(total, lastPage, chunksAdded, scans, id))
                d.setTransactionSuccessful()
            } finally { d.endTransaction() }
            batch.clear(); chunksAdded = 0; scans = 0
        }
        val cancelled = { d.rawQuery("SELECT state FROM books WHERE id=?", arrayOf(id.toString())).use { c -> !c.moveToFirst() || c.getString(0) == "cancel" } }
        try {
            ctx.contentResolver.openInputStream(Uri.parse(uri)).use { input ->
                if (input == null) throw java.io.IOException("The file can't be opened any more")
                val onPage = { n: Int, total: Int, text: String ->
                    var go = true
                    if (n > done) {
                        if (text.replace(Regex("\\s"), "").length < 25) scans++ else batch.add(n to text)
                        lastPage = n
                        job = JSONObject().put("book", id).put("name", name).put("page", n).put("pages", total)
                        if (n % 20 == 0) { flush(total); if (cancelled() || !keepGoing() || !calm(ctx)) go = false }
                        try { Thread.sleep(8) } catch (e: InterruptedException) {}   // a breath between pages: the phone stays cool and smooth
                    }
                    go
                }
                val total = when (kind) {
                    "pdf" -> DocTools.pdfEachPage(ctx, input, onPage)
                    "epub" -> textPages(epubText(input), onPage)
                    "docx" -> textPages(docxText(input), onPage)
                    "html" -> textPages(htmlText(input.bufferedReader().readText()), onPage)
                    else -> textPages(input.bufferedReader().readText(), onPage)
                }
                flush(total)
                if (cancelled()) return true
                if (lastPage < total) return false   // stopped part way: resumes from `done`
                d.execSQL("UPDATE books SET state='done', pages=? WHERE id=?", arrayOf<Any>(total, id))
            }
        } catch (e: Throwable) {
            d.execSQL("UPDATE books SET state='error', err=? WHERE id=?", arrayOf<Any>((e.message ?: e.javaClass.simpleName).take(200), id))
        }
        job = JSONObject()
        return true
    }
    /** v8.3 (Ali: "make the code strong so it does not overload the model or the phone"): reading waits while the model is answering
     *  (one heavy job at a time), and stops on a low battery that isn't charging (it resumes from the saved page later). */
    fun calm(ctx: Context): Boolean {
        var waited = 0
        while (GenService.busy() && waited < 600) { try { Thread.sleep(1000) } catch (e: InterruptedException) { return false }; waited++ }
        return try {
            val bm = ctx.getSystemService(Context.BATTERY_SERVICE) as android.os.BatteryManager
            bm.isCharging || bm.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY) > 15
        } catch (e: Exception) { true }
    }
    /** Text with no pages of its own (e-book, Word, web page, text) → "pages" of about 3,000 characters. */
    private fun textPages(text: String, onPage: (Int, Int, String) -> Boolean): Int {
        val pages = ArrayList<String>(); val cur = StringBuilder()
        for (para in text.split(Regex("\\n\\s*\\n"))) { if (cur.length + para.length > 3000 && cur.isNotEmpty()) { pages.add(cur.toString()); cur.setLength(0) }; cur.append(para.trim()).append("\n\n") }
        if (cur.isNotBlank()) pages.add(cur.toString())
        for ((i, p) in pages.withIndex()) if (!onPage(i + 1, pages.size, p)) break
        return pages.size
    }
    private fun htmlText(h: String): String = h.replace(Regex("(?is)<(script|style)[^>]*>.*?</\\1>"), " ").replace(Regex("(?i)</(p|div|h[1-6]|li|br|tr)>|<br\\s*/?>"), "\n\n")
        .replace(Regex("<[^>]+>"), " ").replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace(Regex("[ \\t]+"), " ")
    private fun epubText(input: InputStream): String {
        val parts = java.util.TreeMap<String, String>()
        ZipInputStream(input).use { z -> var e = z.nextEntry; while (e != null) { val n = e.name; if (Regex("(?i)\\.(x?html?)$").containsMatchIn(n)) parts[n] = htmlText(z.readBytes().toString(Charsets.UTF_8)); e = z.nextEntry } }
        return parts.values.joinToString("\n\n")
    }
    private fun docxText(input: InputStream): String {
        var xml = ""
        ZipInputStream(input).use { z -> var e = z.nextEntry; while (e != null) { if (e.name == "word/document.xml") { xml = z.readBytes().toString(Charsets.UTF_8); break }; e = z.nextEntry } }
        return xml.replace(Regex("</w:p>"), "\n\n").replace(Regex("<w:tab/>"), " ").replace(Regex("<[^>]+>"), "").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    }

    // ---- search -------------------------------------------------------------------------------------------------------------------------
    /** {q, topic, k, perBook, books:[ids]} → {passages:[{book, title, topic, page, text, score}], searched, ms} */
    fun search(ctx: Context, a: JSONObject): JSONObject {
        val t0 = System.currentTimeMillis()
        val d = db(ctx); val topic = a.optString("topic"); val k = a.optInt("k", 12).coerceIn(1, 200); val perBook = a.optInt("perBook", 3).coerceIn(1, 40)
        val only = HashSet<String>()
        a.optJSONArray("books")?.let { for (i in 0 until it.length()) only.add(it.get(i).toString()) }
        val allowed = HashMap<String, Pair<String, String>>()   // book id → (name, topic)
        d.rawQuery("SELECT id, name, topic FROM books WHERE chunks > 0" + if (topic.isNotEmpty()) " AND topic=?" else "", if (topic.isNotEmpty()) arrayOf(topic) else null).use { c ->
            while (c.moveToNext()) { val id = c.getLong(0).toString(); if (only.isEmpty() || id in only) allowed[id] = c.getString(1) to (c.getString(2) ?: "") }
        }
        val out = JSONObject().put("passages", JSONArray()).put("searched", allowed.size)
        if (allowed.isEmpty()) return out
        val total = d.rawQuery("SELECT count(*) FROM chunks", null).use { c -> if (c.moveToFirst()) c.getLong(0) else 0L }.coerceAtLeast(1)
        // the question's words, rarest first; a word in more than a quarter of all passages says nothing
        val ws = words(a.optString("q")).map { w -> w to (d.rawQuery("SELECT documents FROM chunks_terms WHERE term=? AND col='*'", arrayOf(w)).use { c -> if (c.moveToFirst()) c.getLong(0) else 0L }) }
            .filter { it.second in 1..(total / 4 + 5) }.sortedBy { it.second }.take(8).map { it.first }
        if (ws.isEmpty()) return out
        val rows = ArrayList<Triple<String, Int, Pair<String, Double>>>()   // book, page, (text, score)
        val qn = norm(a.optString("q"))
        fun scan(match: String) {
            d.rawQuery("SELECT book, page, text, matchinfo(chunks, 'pcnalx') FROM chunks WHERE chunks MATCH ? LIMIT 6000", arrayOf(match)).use { c ->
                while (c.moveToNext()) {
                    val book = c.getString(0); if (book !in allowed) continue
                    val text = c.getString(2); var s = bm25(c.getBlob(3))
                    if (qn.length > 8 && norm(text).contains(qn)) s *= 1.6   // the question's own words in a row
                    rows.add(Triple(book, c.getString(1).toIntOrNull() ?: 0, text to s))
                }
            }
        }
        val quote = { w: String -> "\"" + w.replace("\"", "") + "\"" }
        if (ws.size > 1) scan(ws.take(4).joinToString(" ") { quote(it) })            // all of the rarest words first
        if (rows.size < k * 2) { rows.clear(); scan(ws.joinToString(" OR ") { quote(it) }) }   // then any of them
        // the best passages of each book, the strongest books first (so several books can be compared)
        val byBook = rows.groupBy { it.first }.mapValues { (_, l) -> l.sortedByDescending { it.third.second }.take(perBook) }
        val best = byBook.values.maxOfOrNull { it[0].third.second } ?: 0.0
        val books = byBook.entries.filter { it.value[0].third.second >= best * 0.25 }.sortedByDescending { it.value[0].third.second }
        val picked = ArrayList<Triple<String, Int, Pair<String, Double>>>()
        for (r in 0 until perBook) for ((_, l) in books) if (r < l.size && picked.size < k) picked.add(l[r])
        val arr = JSONArray()
        for ((book, page, ts) in picked) { val info = allowed[book]!!; arr.put(JSONObject().put("book", book).put("title", info.first).put("topic", info.second).put("page", page).put("text", ts.first).put("score", ts.second)) }
        return out.put("passages", arr).put("ms", System.currentTimeMillis() - t0).put("words", JSONArray(ws))
    }
    /** BM25 of the indexed column (0) from FTS4's matchinfo('pcnalx'). */
    private fun bm25(b: ByteArray): Double {
        val bb = java.nio.ByteBuffer.wrap(b).order(java.nio.ByteOrder.nativeOrder()).asIntBuffer()
        val p = bb.get(0); val c = bb.get(1); val n = bb.get(2).toDouble()
        val avg = bb.get(3).toDouble().coerceAtLeast(1.0); val len = bb.get(3 + c).toDouble()
        val base = 3 + 2 * c; var s = 0.0; val k1 = 1.4; val bp = 0.7
        for (i in 0 until p) {
            val o = base + 3 * (i * c + 0)
            val tf = bb.get(o).toDouble(); val df = bb.get(o + 2).toDouble()
            if (tf <= 0) continue
            val idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
            s += idf * tf * (k1 + 1) / (tf + k1 * (1 - bp + bp * len / avg))
        }
        return s
    }
}

/** Reads the queued books with Attune in the background (a notification says which book and page). */
class BookIngestService : Service() {
    @Volatile private var running = false
    override fun onBind(i: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "stop") { running = false; stopSelf(); return START_NOT_STICKY }
        try {
            val nm = getSystemService(NotificationManager::class.java)
            if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel("books", "Library", NotificationManager.IMPORTANCE_LOW))
            if (Build.VERSION.SDK_INT >= 34) startForeground(41, note("Reading your books…"), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC) else startForeground(41, note("Reading your books…"))
        } catch (e: Exception) { stopSelf(); return START_NOT_STICKY }
        if (!running) { running = true; Thread({ loop() }, "attune-books").apply { priority = Thread.MIN_PRIORITY; start() } }
        return START_STICKY
    }
    private fun note(text: String): Notification {
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "books") else @Suppress("DEPRECATION") Notification.Builder(this)
        return b.setSmallIcon(android.R.drawable.ic_menu_agenda).setContentTitle("Attune · Library").setContentText(text).setOngoing(true).build()
    }
    private fun loop() {
        val nm = getSystemService(NotificationManager::class.java)
        try {
            while (running) {
                val d = BookShelf.db(this)
                if (!BookShelf.calm(this)) break   // a low battery: later, from the saved page
                val next = d.rawQuery("SELECT id, name FROM books WHERE state IN ('queued','reading') ORDER BY added, id LIMIT 1", null).use { c -> if (c.moveToFirst()) c.getLong(0) to c.getString(1) else null } ?: break
                val left = d.rawQuery("SELECT count(*) FROM books WHERE state IN ('queued','reading')", null).use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }
                try { nm.notify(41, note("Reading " + next.second + (if (left > 1) " · $left books left" else ""))) } catch (e: Exception) {}
                if (!BookShelf.readOne(this, next.first) { running }) break
            }
        } finally {
            running = false; BookShelf.job = JSONObject()
            try { stopForeground(STOP_FOREGROUND_REMOVE) } catch (e: Exception) {}
            stopSelf()
        }
    }
    companion object {
        /** Attune opened: books still waiting are read on (an import stopped by a low battery or a restart). */
        fun resumeIfPending(ctx: Context) {
            try { val n = BookShelf.db(ctx).rawQuery("SELECT count(*) FROM books WHERE state IN ('queued','reading')", null).use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }; if (n > 0) start(ctx) } catch (e: Exception) {}
        }
        fun start(ctx: Context) {
            val i = Intent(ctx, BookIngestService::class.java)
            try { if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i) } catch (e: Exception) {}
        }
    }
}
