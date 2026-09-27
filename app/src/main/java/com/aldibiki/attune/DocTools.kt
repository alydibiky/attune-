package com.aldibiki.attune

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.text.Layout
import android.text.StaticLayout
import android.text.TextDirectionHeuristics
import android.text.TextPaint
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * v5.36 — File Converter, the PDF side (the Word / Excel side is web-src/convert.js).
 * Everything happens on the phone; no file is uploaded anywhere.
 *  - pdfText: the text of every page (PdfBox-Android, Apache-2.0). A page with (almost) no text is
 *    a scan — the page reports that, and the app has the AI model read its picture instead.
 *  - pdfImages: pages as pictures (Android's own PdfRenderer) — for "PDF → pictures" and for
 *    reading scanned pages.
 *  - makePdf: an A4 PDF from paragraphs / headings / bullets / tables (Android's PdfDocument;
 *    StaticLayout shapes Arabic and lays it out right-to-left) or from photos (one per page).
 */
object DocTools {
    @Volatile private var boxReady = false

    private fun pdfBox(ctx: Context) {
        if (!boxReady) { com.tom_roush.pdfbox.android.PDFBoxResourceLoader.init(ctx.applicationContext); boxReady = true }
    }

    /** {pages:[{n, text, scan}], count} */
    /**
     * v5.41 (Ali: "PDF → Word changed the format" — headings glued to paragraphs, tables as plain lines,
     * numbered questions lost their numbers): while the text is read, every word's position, size and
     * boldness is kept, so the page can rebuild headings, lists and real tables (convert.js pdfLinesToBlocks).
     */
    private class LayoutStripper : com.tom_roush.pdfbox.text.PDFTextStripper() {
        val words = ArrayList<FloatArray>()   // x, xEnd, y, size, bold (1/0)
        val texts = ArrayList<String>()
        override fun writeString(text: String?, textPositions: MutableList<com.tom_roush.pdfbox.text.TextPosition>?) {
            super.writeString(text, textPositions)
            try {
                val tp = textPositions ?: return
                if (tp.isEmpty() || text.isNullOrBlank()) return
                val a = tp.first(); val b = tp.last()
                val fname = try { a.font?.name ?: "" } catch (e: Exception) { "" }
                val bold = fname.contains("Bold", true) || fname.contains("Black", true) || fname.contains("Heavy", true) || fname.contains("Semibold", true)
                words.add(floatArrayOf(a.xDirAdj, b.xDirAdj + b.widthDirAdj, a.yDirAdj, a.fontSizeInPt, if (bold) 1f else 0f))
                texts.add(text)
            } catch (e: Exception) { }
        }
    }

    /** The kept words of one page → lines: [{y, x, s (size), b (all bold), sp: [[x, text, size]]}] (spans split at wide gaps). */
    private fun layoutLines(st: LayoutStripper): JSONArray {
        val out = JSONArray()
        val n = st.words.size
        if (n == 0) return out
        val order = (0 until n).sortedWith(compareBy({ st.words[it][2] }, { st.words[it][0] }))
        val groups = ArrayList<ArrayList<Int>>()
        for (i in order) {
            val w = st.words[i]
            val g = groups.lastOrNull()
            if (g != null) {
                val f = st.words[g[0]]
                if (Math.abs(w[2] - f[2]) <= maxOf(2f, minOf(w[3], f[3]) * 0.45f)) { g.add(i); continue }
            }
            groups.add(arrayListOf(i))
        }
        for (g in groups) {
            g.sortBy { st.words[it][0] }
            val sizes = g.map { st.words[it][3] }.sorted()
            val size = sizes[sizes.size / 2]
            val baseYs = g.filter { st.words[it][3] >= size * 0.9f }.map { st.words[it][2] }.sorted()
            val base = if (baseYs.isEmpty()) st.words[g[0]][2] else baseYs[baseYs.size / 2]
            val spans = JSONArray()
            var spanX = -1f; var spanEnd = 0f; val sb = StringBuilder(); var spanSize = 0f
            var wordsOf = JSONArray()   // each word's x and text, so a table header can be split into its columns
            var allBold = true
            for (i in g) {
                val w = st.words[i]; val t = st.texts[i]
                if (w[4] < 0.5f) allBold = false
                if (spanX >= 0f && w[0] - spanEnd > size * 1.6f) { spans.put(JSONArray().put(spanX.toDouble()).put(sb.toString()).put(spanSize.toDouble()).put(wordsOf)); sb.setLength(0); spanX = -1f; wordsOf = JSONArray() }
                if (spanX < 0f) { spanX = w[0]; spanSize = w[3] }
                else {
                    // a smaller word raised above the line is a superscript (2^−ΔΔCt)
                    if (w[3] < size * 0.8f && w[2] < base - 0.5f) { sb.append("^(").append(t).append(")"); spanEnd = w[1]; continue }
                    if (w[0] - spanEnd > size * 0.12f) sb.append(' ')
                }
                sb.append(t); spanEnd = w[1]
                wordsOf.put(JSONArray().put(w[0].toDouble()).put(t))
            }
            if (spanX >= 0f) spans.put(JSONArray().put(spanX.toDouble()).put(sb.toString()).put(spanSize.toDouble()).put(wordsOf))
            val first = st.words[g[0]]
            out.put(JSONObject().put("y", first[2].toDouble()).put("x", st.words[g.first()][0].toDouble()).put("s", size.toDouble()).put("b", allBold).put("sp", spans))
        }
        return out
    }

    fun pdfText(ctx: Context, bytes: ByteArray, maxPages: Int = 400): JSONObject {
        pdfBox(ctx)
        val doc = try { com.tom_roush.pdfbox.pdmodel.PDDocument.load(bytes) }
            catch (e: com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException) { throw java.io.IOException("This PDF is locked with a password — open it, save a copy without the password, and try again.") }
        doc.use { d ->
            val n = minOf(d.numberOfPages, maxPages)
            val pages = JSONArray()
            // paragraphs end with a blank line, so the Word file gets real paragraphs, not one block a page
            val strip = LayoutStripper().apply { sortByPosition = true; setAddMoreFormatting(true); setParagraphEnd("\n") }
            for (i in 1..n) {
                strip.startPage = i; strip.endPage = i
                strip.words.clear(); strip.texts.clear()
                val t = try { strip.getText(d) } catch (e: Exception) { "" }
                val clean = t.replace("\r", "").trim()
                val page = JSONObject().put("n", i).put("text", clean).put("scan", clean.replace(Regex("\\s"), "").length < 25)
                try {
                    page.put("lines", layoutLines(strip))
                    page.put("w", d.getPage(i - 1).mediaBox.width.toDouble())
                } catch (e: Exception) { }   // no layout: the page falls back to the plain text
                pages.put(page)
            }
            return JSONObject().put("pages", pages).put("count", d.numberOfPages)
        }
    }

    /** Pages as JPEG data URLs, `width` px wide. `pages` = 1-based page numbers (empty = all, up to `max`). */
    fun pdfImages(ctx: Context, bytes: ByteArray, pages: List<Int>, width: Int, max: Int = 60): JSONArray {
        val f = File(ctx.cacheDir, "convert-" + System.nanoTime() + ".pdf").apply { writeBytes(bytes) }
        val out = JSONArray()
        try {
            ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
                PdfRenderer(pfd).use { r ->
                    val want = (if (pages.isEmpty()) (1..r.pageCount).toList() else pages).filter { it in 1..r.pageCount }.take(max)
                    for (p in want) {
                        r.openPage(p - 1).use { page ->
                            val w = width.coerceIn(400, 2400)
                            val h = (w.toLong() * page.height / page.width.coerceAtLeast(1)).toInt().coerceIn(200, 4000)
                            val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                            bmp.eraseColor(Color.WHITE)
                            page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                            val bo = ByteArrayOutputStream()
                            bmp.compress(Bitmap.CompressFormat.JPEG, 88, bo)
                            bmp.recycle()
                            out.put(JSONObject().put("n", p).put("image", "data:image/jpeg;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP)))
                        }
                    }
                }
            }
        } catch (e: SecurityException) {
            throw java.io.IOException("This PDF is locked with a password — open it, save a copy without the password, and try again.")
        } finally { f.delete() }
        return out
    }

    /**
     * v5.37 — PDF tools: merge several PDFs, split one into pages, keep chosen pages, rotate pages.
     * op = merge {files:[b64]} | split {b64} | pick {b64, pages} | rotate {b64, pages (empty = all), degrees}
     * → {files:[{n, b64, pages}]} (merge / pick / rotate give one file, split one per page).
     */
    fun pdfEdit(ctx: Context, op: String, a: JSONObject): JSONObject {
        pdfBox(ctx)
        fun load(b64: String) = try { com.tom_roush.pdfbox.pdmodel.PDDocument.load(Base64.decode(b64, Base64.DEFAULT)) }
            catch (e: com.tom_roush.pdfbox.pdmodel.encryption.InvalidPasswordException) { throw java.io.IOException("This PDF is locked with a password — open it, save a copy without the password, and try again.") }
        fun save(d: com.tom_roush.pdfbox.pdmodel.PDDocument): String { val o = ByteArrayOutputStream(); d.save(o); return Base64.encodeToString(o.toByteArray(), Base64.NO_WRAP) }
        fun ints(k: String) = a.optJSONArray(k)?.let { p -> (0 until p.length()).map { p.getInt(it) } } ?: emptyList()
        val files = JSONArray()
        when (op) {
            "merge" -> {
                val src = a.getJSONArray("files")
                val m = com.tom_roush.pdfbox.multipdf.PDFMergerUtility()
                for (i in 0 until src.length()) m.addSource(java.io.ByteArrayInputStream(Base64.decode(src.getString(i), Base64.DEFAULT)))
                val o = ByteArrayOutputStream()
                m.destinationStream = o
                m.mergeDocuments(com.tom_roush.pdfbox.io.MemoryUsageSetting.setupMainMemoryOnly())
                val b = o.toByteArray()
                val n = com.tom_roush.pdfbox.pdmodel.PDDocument.load(b).use { it.numberOfPages }
                files.put(JSONObject().put("n", 1).put("b64", Base64.encodeToString(b, Base64.NO_WRAP)).put("pages", n))
            }
            "split" -> load(a.getString("b64")).use { d ->
                val parts = com.tom_roush.pdfbox.multipdf.Splitter().split(d)
                for ((i, p) in parts.withIndex()) { p.use { files.put(JSONObject().put("n", i + 1).put("b64", save(it)).put("pages", 1)) } }
            }
            "pick", "rotate" -> load(a.getString("b64")).use { d ->
                val count = d.numberOfPages
                val want = ints("pages").filter { it in 1..count }.toSet()
                if (op == "pick") {
                    if (want.isEmpty()) throw java.io.IOException("None of those page numbers are in this PDF (it has $count pages).")
                    for (i in count downTo 1) if (i !in want) d.removePage(i - 1)
                } else {
                    val deg = ((a.optInt("degrees", 90) % 360) + 360) % 360
                    for (i in 1..count) if (want.isEmpty() || i in want) { val p = d.getPage(i - 1); p.rotation = (p.rotation + deg) % 360 }
                }
                files.put(JSONObject().put("n", 1).put("b64", save(d)).put("pages", d.numberOfPages))
            }
            else -> throw java.io.IOException("Unknown PDF tool: $op")
        }
        return JSONObject().put("files", files)
    }

    private const val PW = 595; private const val PH = 842; private const val M = 50f

    /**
     * blocks: [{type: h1|h2|h3|p|li|table, text, rows}], images: [data URL or base64] → PDF bytes.
     */
    // v5.40: fullPage = slides — each picture fills its own 16:9 page (no white margin);
    // blocks may also be "title", "subtitle", "caption", "pagebreak" and "image" (a chart in a report)
    fun makePdf(blocks: JSONArray, images: JSONArray, fullPage: Boolean = false): ByteArray {
        val pdf = PdfDocument()
        var pageNo = 0
        var page: PdfDocument.Page? = null
        var y = M
        val usable = PW - 2 * M
        fun newPage(w: Int = PW, h: Int = PH): Canvas {
            page?.let { pdf.finishPage(it) }
            pageNo++
            page = pdf.startPage(PdfDocument.PageInfo.Builder(w, h, pageNo).create())
            y = M
            return page!!.canvas
        }
        // photos: one per page, the page turned to the photo's shape
        for (k in 0 until images.length()) {
            val s = images.optString(k)
            val raw = Base64.decode(s.substringAfter("base64,"), Base64.DEFAULT)
            val bmp = BitmapFactory.decodeByteArray(raw, 0, raw.size) ?: continue
            if (fullPage) {
                val w = PH; val h = (PH.toFloat() * bmp.height / bmp.width).toInt().coerceAtLeast(1)
                newPage(w, h).drawBitmap(bmp, null, android.graphics.RectF(0f, 0f, w.toFloat(), h.toFloat()), Paint(Paint.FILTER_BITMAP_FLAG))
                bmp.recycle()
                continue
            }
            val land = bmp.width > bmp.height
            val (w, h) = if (land) PH to PW else PW to PH
            val c = newPage(w, h)
            val k2 = minOf((w - 48f) / bmp.width, (h - 48f) / bmp.height)
            val dw = bmp.width * k2; val dh = bmp.height * k2
            c.drawBitmap(bmp, null, android.graphics.RectF((w - dw) / 2, (h - dh) / 2, (w + dw) / 2, (h + dh) / 2), Paint(Paint.FILTER_BITMAP_FLAG))
            bmp.recycle()
        }
        if (blocks.length() > 0) {
            var c = newPage()
            fun paint(size: Float, bold: Boolean) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                textSize = size; color = Color.rgb(20, 20, 20); typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            }
            fun layout(text: String, p: TextPaint, width: Int): StaticLayout =
                StaticLayout.Builder.obtain(text, 0, text.length, p, width.coerceAtLeast(20))
                    .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                    .setTextDirection(TextDirectionHeuristics.FIRSTSTRONG_LTR)   // Arabic lines start from the right
                    .setLineSpacing(0f, 1.15f).build()
            // draws a layout line by line, starting a new page when one is full
            fun draw(l: StaticLayout, x: Float) {
                for (line in 0 until l.lineCount) {
                    val top = l.getLineTop(line); val bottom = l.getLineBottom(line)
                    if (y + (bottom - top) > PH - M) c = newPage()
                    c.save(); c.translate(x, y - top); c.clipRect(0f, top.toFloat(), l.width.toFloat(), bottom.toFloat()); l.draw(c); c.restore()
                    y += (bottom - top)
                }
            }
            val grid = Paint().apply { color = Color.rgb(150, 150, 150); strokeWidth = 0.6f; style = Paint.Style.STROKE }
            for (i in 0 until blocks.length()) {
                val b = blocks.optJSONObject(i) ?: continue
                val type = b.optString("type", "p")
                val text = b.optString("text")
                when (type) {
                    "h1", "h2", "h3" -> {
                        y += if (type == "h1") 10 else 6
                        draw(layout(text, paint(if (type == "h1") 19f else if (type == "h2") 15.5f else 13f, true), usable.toInt()), M)
                        y += 6
                    }
                    "li" -> { val num = b.optString("num", ""); draw(layout((if (num.isNotEmpty()) "$num.  " else "•  ") + text, paint(11f, false), usable.toInt() - 12), M + 12); y += 3 }
                    "title" -> { y += 150; draw(layout(text, paint(28f, true), usable.toInt()), M); y += 10 }
                    "subtitle" -> { draw(layout(text, paint(15f, false).apply { color = Color.rgb(90, 90, 90) }, usable.toInt()), M); y += 24 }
                    "caption" -> { draw(layout(text, paint(9.5f, false).apply { color = Color.rgb(90, 90, 90) }, usable.toInt()), M); y += 10 }
                    "pagebreak" -> { if (y > M) c = newPage() }
                    "image" -> {
                        val raw = Base64.decode(b.optString("b64").substringAfter("base64,"), Base64.DEFAULT)
                        val bmp = BitmapFactory.decodeByteArray(raw, 0, raw.size)
                        if (bmp != null) {
                            val dw = usable; val dh = minOf(dw * bmp.height / bmp.width, PH - 2 * M)
                            if (y + dh > PH - M) c = newPage()
                            c.drawBitmap(bmp, null, android.graphics.RectF(M, y, M + dh * bmp.width / bmp.height, y + dh), Paint(Paint.FILTER_BITMAP_FLAG))
                            bmp.recycle()
                            y += dh + 6
                        }
                    }
                    "table" -> {
                        val rows = b.optJSONArray("rows") ?: JSONArray()
                        if (rows.length() == 0) continue
                        val cols = (0 until rows.length()).maxOfOrNull { rows.optJSONArray(it)?.length() ?: 0 }?.coerceAtLeast(1) ?: 1
                        val cw = usable / cols
                        for (r in 0 until rows.length()) {
                            val row = rows.optJSONArray(r) ?: continue
                            val ls = (0 until cols).map { ci -> layout(row.optString(ci, ""), paint(10f, r == 0), (cw - 8).toInt()) }
                            val rh = ls.maxOf { it.height } + 8f
                            if (y + rh > PH - M) c = newPage()
                            for ((ci, l) in ls.withIndex()) {
                                val x = M + ci * cw
                                c.drawRect(x, y, x + cw, y + rh, grid)
                                c.save(); c.translate(x + 4, y + 4); l.draw(c); c.restore()
                            }
                            y += rh
                        }
                        y += 10
                    }
                    else -> { draw(layout(text, paint(11f, false), usable.toInt()), M); y += 7 }
                }
            }
        }
        if (page == null) newPage()
        page?.let { pdf.finishPage(it) }
        val out = ByteArrayOutputStream()
        pdf.writeTo(out); pdf.close()
        return out.toByteArray()
    }
}
