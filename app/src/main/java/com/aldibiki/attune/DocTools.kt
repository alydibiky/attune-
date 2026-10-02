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

    /** {pages:[{n, text, scan, lines, w, h, imgs}], count} */
    /**
     * v5.41 (Ali: "PDF → Word changed the format" — headings glued to paragraphs, tables as plain lines,
     * numbered questions lost their numbers): while the text is read, every word's position, size and
     * boldness is kept, so the page can rebuild headings, lists and real tables (convert.js pdfLinesToBlocks).
     * v6.8 (Ali: "not just convert but with formatting and spacing and everything"): every WORD keeps its
     * own bold / italic / colour, each line its font, its right edge and its direction, and the pictures on
     * the page are sent with their place. Arabic is rebuilt from its letters right to left (PDFBox's own
     * reversal turned «لا» into «ال»: «ملاحظة» → «مالحظة»), with numbers and English words inside it kept
     * left to right. tests/convert/PdfLayout.java is this code on desktop PDFBox — keep the two in step.
     */
    private class LayoutStripper : com.tom_roush.pdfbox.text.PDFTextStripper() {
        val words = ArrayList<FloatArray>()   // x, xEnd, y, size, bold, italic, Arabic letters, other letters, colour (rgb)
        val texts = ArrayList<String>()
        val fonts = ArrayList<String>()
        val colours = java.util.IdentityHashMap<com.tom_roush.pdfbox.text.TextPosition, Int>()
        init {
            // the text colour (PDFTextStripper doesn't follow it on its own)
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingColorSpace())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingColorSpace())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingDeviceCMYKColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingDeviceCMYKColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingDeviceRGBColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingDeviceRGBColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingDeviceGrayColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingDeviceGrayColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingColorN())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingColorN())
        }
        override fun processTextPosition(text: com.tom_roush.pdfbox.text.TextPosition?) {
            try { if (text != null) rgbOf(graphicsState.nonStrokingColor)?.let { colours[text] = it } } catch (e: Exception) { }
            super.processTextPosition(text)
        }
        override fun writeString(text: String?, textPositions: MutableList<com.tom_roush.pdfbox.text.TextPosition>?) {
            super.writeString(text, textPositions)
            try {
                val tp = textPositions ?: return
                if (tp.isEmpty() || text.isNullOrBlank()) return
                // PDFBox often hands a whole line over in one piece — split it into its words (at spaces, gaps
                // and font changes, left to right on the page) so each keeps its own bold / colour / place
                val g = tp.sortedBy { it.xDirAdj }
                var cur = ArrayList<com.tom_roush.pdfbox.text.TextPosition>()
                for (p in g) {
                    val u = p.unicode ?: ""
                    val last = cur.lastOrNull()
                    val gap = last != null && p.xDirAdj - (last.xDirAdj + last.widthDirAdj) > p.fontSizeInPt * 0.18f
                    val fontChange = last != null && last.font !== p.font
                    // v6.10: a smaller or lowered / raised character starts its own word (the X of Y_X/S, the −1 of h⁻¹)
                    val script = last != null && (Math.abs(p.yDirAdj - last.yDirAdj) > 0.9f || minOf(p.fontSizeInPt, last.fontSizeInPt) < maxOf(p.fontSizeInPt, last.fontSizeInPt) * 0.85f)
                    if (u.isBlank() || gap || fontChange || script) { if (cur.isNotEmpty()) addWord(cur); cur = ArrayList(); if (u.isBlank()) continue }
                    cur.add(p)
                }
                if (cur.isNotEmpty()) addWord(cur)
            } catch (e: Exception) { }
        }
        private fun addWord(tp: List<com.tom_roush.pdfbox.text.TextPosition>) {
            val raw = tp.joinToString("") { it.unicode ?: "" }
            // a number in an Arabic line: "50%" is drawn «%50» — the sign goes back after the number
            val text = if (hasRtl(raw)) rtlText(tp) else raw.replace(Regex("^([%٪])(\\d[\\d.,]*)$"), "$2$1")
            if (text.isBlank()) return
            val a = tp[0]
            val fname = try { a.font?.name ?: "" } catch (e: Exception) { "" }
            val bold = Regex("(?i)bold|black|heavy|semibold").containsMatchIn(fname)
            val italic = Regex("(?i)italic|oblique").containsMatchIn(fname)
            // the word's left and right edge whatever the writing direction (an Arabic word's first letter is on its right)
            var x0 = Float.MAX_VALUE; var x1 = -Float.MAX_VALUE
            for (p in tp) { x0 = minOf(x0, p.xDirAdj); x1 = maxOf(x1, p.xDirAdj + p.widthDirAdj) }
            val ar = text.count { it.code in 0x0590..0x08FF }
            val la = text.count { it.isLetter() } - ar
            // the size as drawn: fontSizeInPt ignores the page's scaling (a Chrome / Skia PDF draws at 3/4:
            // 11 pt came out as 14.7) — the text's y-scale includes it
            val sz = if (a.yScale > 0.5f) Math.round(a.yScale * 2) / 2f else a.fontSizeInPt
            words.add(floatArrayOf(x0, x1, a.yDirAdj, sz, if (bold) 1f else 0f, if (italic) 1f else 0f, ar.toFloat(), la.toFloat(), (colours[a] ?: 0).toFloat()))
            texts.add(text); fonts.add(fname)
        }
    }

    /** A PDF colour → 0xRRGGBB (grey, RGB and CMYK; null for others). */
    private fun rgbOf(c: com.tom_roush.pdfbox.pdmodel.graphics.color.PDColor?): Int? {
        val v = c?.components ?: return null
        fun b(x: Float) = (x.coerceIn(0f, 1f) * 255 + 0.5f).toInt()
        return when (v.size) {
            1 -> b(v[0]).let { (it shl 16) or (it shl 8) or it }
            3 -> (b(v[0]) shl 16) or (b(v[1]) shl 8) or b(v[2])
            4 -> { val k = v[3]; (b((1 - v[0]) * (1 - k)) shl 16) or (b((1 - v[1]) * (1 - k)) shl 8) or b((1 - v[2]) * (1 - k)) }
            else -> null
        }
    }
    private fun isRtlChar(c: Int) = c in 0x0590..0x08FF || c in 0xFB1D..0xFEFC
    private fun hasRtl(t: String) = t.codePoints().anyMatch { isRtlChar(it) }
    private fun strongLtr(u: String) = u.codePoints().anyMatch { Character.isDigit(it) || (Character.isLetter(it) && !isRtlChar(it)) }
    private fun ltrish(t: String) = !hasRtl(t) && strongLtr(t)   // (a lone "%" is not: Arabic shows "50%" as «%50»)

    /** An Arabic word rebuilt from its letters, right to left; numbers and Latin inside stay left to right. */
    private fun rtlText(tp: List<com.tom_roush.pdfbox.text.TextPosition>): String {
        val g = tp.sortedByDescending { it.xDirAdj + it.widthDirAdj / 2 }
        val u = ArrayList<String>()
        var prev: com.tom_roush.pdfbox.text.TextPosition? = null
        for (p in g) {
            val c = java.text.Normalizer.normalize(p.unicode ?: "", java.text.Normalizer.Form.NFKC)
            val pv = prev
            if (pv != null && c.isNotBlank() && !(u.isNotEmpty() && u.last().isBlank()) && pv.xDirAdj - (p.xDirAdj + p.widthDirAdj) > p.fontSizeInPt * 0.18f) u.add(" ")
            u.add(c); prev = p
        }
        val out = StringBuilder()
        var i = 0
        while (i < u.size) {
            // a sign stuck to a number ("50%", "$20") belongs to the number's run
            val lead = Regex("[%\$€£+\\-]").matches(u[i]) && i + 1 < u.size && strongLtr(u[i + 1])
            if (!strongLtr(u[i]) && !lead) { out.append(u[i]); i++; continue }
            var j = i
            while (j + 1 < u.size && (strongLtr(u[j + 1]) || (Regex("[.,:%/+\\-]").matches(u[j + 1]) && j + 2 < u.size && strongLtr(u[j + 2])))) j++
            for (k in j downTo i) out.append(u[k])
            i = j + 1
        }
        return out.toString().replace(Regex(" {2,}"), " ")
    }

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
                val scriptPair = minOf(w[3], f[3]) < maxOf(w[3], f[3]) * 0.85f   // v6.10: a sub / superscript belongs to its line
                if (Math.abs(w[2] - f[2]) <= maxOf(2f, if (scriptPair) maxOf(w[3], f[3]) * 0.55f else minOf(w[3], f[3]) * 0.45f)) { g.add(i); continue }
            }
            groups.add(arrayListOf(i))
        }
        for (g0 in groups) {
            // a right-to-left line (more Arabic letters than others) is read from its right edge
            val rtlLine = g0.sumOf { st.words[it][6].toDouble() } > g0.sumOf { st.words[it][7].toDouble() }
            val g = ArrayList(g0.sortedBy { st.words[it][0] })
            if (rtlLine) {
                g.reverse()
                // English words and numbers inside an Arabic line keep their own left-to-right order
                // ("Liebherr LTM 1090") — each run put back, never across a column gap
                var k = 0
                while (k < g.size) {
                    if (!ltrish(st.texts[g[k]])) { k++; continue }
                    var m = k; var strong = false
                    while (m < g.size && ltrish(st.texts[g[m]]) && (m == k || st.words[g[m - 1]][0] - st.words[g[m]][1] < st.words[g[m]][3] * 1.6f)) { strong = strong || strongLtr(st.texts[g[m]]); m++ }
                    if (strong && m - k > 1) g.subList(k, m).reverse()
                    k = m
                }
            }
            val sizes = g.map { st.words[it][3] }.sorted()
            val size = sizes[sizes.size / 2]
            val baseYs = g.filter { st.words[it][3] >= size * 0.9f }.map { st.words[it][2] }.sorted()
            val base = if (baseYs.isEmpty()) st.words[g[0]][2] else baseYs[baseYs.size / 2]
            val spans = JSONArray()
            var spanX = -1f; var spanEnd = 0f; val sb = StringBuilder(); var spanSize = 0f
            var wordsOf = JSONArray()   // each word: x, text, bold, italic, colour, xEnd, script
            var allBold = true; var allItalic = true
            var lineX0 = Float.MAX_VALUE; var lineX1 = -Float.MAX_VALUE
            val fontVotes = HashMap<String, Int>(); val colVotes = HashMap<Int, Int>()
            for (i in g) {
                val w = st.words[i]; val t = st.texts[i]
                if (w[4] < 0.5f) allBold = false
                if (w[5] < 0.5f) allItalic = false
                lineX0 = minOf(lineX0, w[0]); lineX1 = maxOf(lineX1, w[1])
                fontVotes[st.fonts[i]] = (fontVotes[st.fonts[i]] ?: 0) + t.length
                colVotes[w[8].toInt()] = (colVotes[w[8].toInt()] ?: 0) + t.length
                // the gap to the previous word, measured in reading order
                val gap = if (spanX < 0f) 0f else if (rtlLine) spanEnd - w[1] else w[0] - spanEnd
                if (spanX >= 0f && gap > size * 1.6f) { spans.put(JSONArray().put(spanX.toDouble()).put(sb.toString()).put(spanSize.toDouble()).put(wordsOf)); sb.setLength(0); spanX = -1f; wordsOf = JSONArray() }
                if (spanX < 0f) { spanX = if (rtlLine) w[1] else w[0]; spanSize = w[3] }
                else if (!(w[3] < size * 0.85f && w[2] < base - 0.5f) && gap > size * 0.12f) sb.append(' ')
                // v6.10: a smaller word raised above the line is a superscript (2^−ΔΔCt), one lowered is a subscript (Y_X/S)
                val v = if (w[3] < size * 0.85f) (if (w[2] < base - 0.5f) 1 else if (w[2] > base + 0.5f) -1 else 0) else 0
                if (v == 1 && spanX >= 0f && sb.isNotEmpty()) sb.append("^(").append(t).append(")") else sb.append(t)
                spanEnd = if (rtlLine) w[0] else w[1]
                // each word: x, text, bold, italic, colour, xEnd, script (+1 super, −1 sub)
                wordsOf.put(JSONArray().put((if (rtlLine) w[1] else w[0]).toDouble()).put(t).put(w[4].toInt()).put(w[5].toInt()).put(w[8].toInt()).put((if (rtlLine) w[0] else w[1]).toDouble()).put(v))
            }
            if (spanX >= 0f) spans.put(JSONArray().put(spanX.toDouble()).put(sb.toString()).put(spanSize.toDouble()).put(wordsOf))
            val first = st.words[g[0]]
            out.put(JSONObject().put("y", first[2].toDouble()).put("x", lineX0.toDouble()).put("e", lineX1.toDouble()).put("s", size.toDouble())
                .put("b", allBold).put("i", allItalic).put("r", rtlLine)
                .put("f", fontVotes.maxByOrNull { it.value }?.key ?: "").put("c", colVotes.maxByOrNull { it.value }?.key ?: 0)
                .put("sp", spans))
        }
        return out
    }

    /**
     * v6.8: the pictures on a page — where they sit (top-left, points) and how big — as JPEG / PNG data
     * URLs (at most `budget`, each ≤ 1600 px). Pictures inside forms are found too.
     */
    private class ImageFinder(val pageH: Float, var budget: Int) : com.tom_roush.pdfbox.contentstream.PDFStreamEngine() {
        val found = JSONArray()
        init {
            addOperator(com.tom_roush.pdfbox.contentstream.operator.state.Concatenate())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.DrawObject())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.state.SetGraphicsStateParameters())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.state.Save())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.state.Restore())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.state.SetMatrix())
        }
        override fun processOperator(operator: com.tom_roush.pdfbox.contentstream.operator.Operator?, operands: MutableList<com.tom_roush.pdfbox.cos.COSBase>?) {
            if (operator?.name == "Do" && !operands.isNullOrEmpty() && operands[0] is com.tom_roush.pdfbox.cos.COSName) {
                val xo = try { resources.getXObject(operands[0] as com.tom_roush.pdfbox.cos.COSName) } catch (e: Exception) { null }
                if (xo is com.tom_roush.pdfbox.pdmodel.graphics.image.PDImageXObject) {
                    if (budget > 0) try {
                        val m = graphicsState.currentTransformationMatrix
                        val w = Math.abs(m.scalingFactorX); val h = Math.abs(m.scalingFactorY)
                        if (w >= 24f && h >= 24f) {
                            var bmp: Bitmap = xo.image
                            val k = minOf(1.0, 1600.0 / maxOf(bmp.width, bmp.height))
                            if (k < 1.0) bmp = Bitmap.createScaledBitmap(bmp, (bmp.width * k).toInt().coerceAtLeast(1), (bmp.height * k).toInt().coerceAtLeast(1), true)
                            val bo = ByteArrayOutputStream()
                            val png = bmp.hasAlpha()
                            bmp.compress(if (png) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG, 85, bo)
                            found.put(JSONObject().put("x", m.translateX.toDouble()).put("y", (pageH - m.translateY - h).toDouble()).put("w", w.toDouble()).put("h", h.toDouble())
                                .put("b64", "data:image/" + (if (png) "png" else "jpeg") + ";base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP)))
                            budget--
                        }
                    } catch (e: Exception) { } catch (e: OutOfMemoryError) { budget = 0 }
                    return
                }
            }
            super.processOperator(operator, operands)
        }
    }

    /**
     * v6.10: the page's filled rectangles and ruled lines (table shading and borders, boxes): [x, top, w, h, fill, stroke]
     * in points, top-left origin; fill / stroke are 0xRRGGBB or -1 for none. A ruled line is a thin rectangle. At most 400 a page.
     * Watches the drawing operators itself (re, m, l, f, S, B …) like ImageFinder watches Do. tests/convert/PdfLayout.java is
     * this code on desktop PDFBox — keep the two in step.
     */
    private class PathFinder(val pageW: Float, val pageH: Float) : com.tom_roush.pdfbox.contentstream.PDFStreamEngine() {
        val found = JSONArray()
        private var count = 0
        private val rects = ArrayList<FloatArray>()     // the path being built: x0, y0, x1, y1 (page space)
        private val segs = ArrayList<FloatArray>()
        private var cx = 0f; private var cy = 0f
        init {
            addOperator(com.tom_roush.pdfbox.contentstream.operator.state.Concatenate())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.state.Save())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.state.Restore())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.state.SetMatrix())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.state.SetLineWidth())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.state.SetGraphicsStateParameters())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingColorSpace())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingColorSpace())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingDeviceCMYKColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingDeviceCMYKColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingDeviceRGBColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingDeviceRGBColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingDeviceGrayColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingDeviceGrayColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetStrokingColorN())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingColor())
            addOperator(com.tom_roush.pdfbox.contentstream.operator.color.SetNonStrokingColorN())
        }
        private fun tx(x: Float, y: Float): FloatArray {
            val m = graphicsState.currentTransformationMatrix
            return floatArrayOf(m.scaleX * x + m.shearX * y + m.translateX, m.shearY * x + m.scaleY * y + m.translateY)
        }
        private fun rgb(fill: Boolean): Int = try { (rgbOf(if (fill) graphicsState.nonStrokingColor else graphicsState.strokingColor) ?: -1).let { if (it < 0) -1 else it and 0xFFFFFF } } catch (e: Exception) { -1 }
        private fun emit(x0: Float, y0: Float, x1: Float, y1: Float, fill: Int, stroke: Int) {
            if (count >= 400) return
            val x = minOf(x0, x1); val w = Math.abs(x1 - x0); val yb = minOf(y0, y1); val h = Math.abs(y1 - y0)
            if (w < 0.3f && h < 0.3f) return
            if (w >= pageW * 0.95f && h >= pageH * 0.95f && (fill == 0xFFFFFF || fill == -1)) return   // the page background
            found.put(JSONArray().put(x.toDouble()).put((pageH - (yb + h)).toDouble()).put(w.toDouble()).put(h.toDouble()).put(fill).put(stroke))
            count++
        }
        private fun paint(f: Boolean, s: Boolean) {
            val fc = if (f) rgb(true) else -1; val sc = if (s) rgb(false) else -1
            val lw = maxOf(0.4f, graphicsState.lineWidth * Math.abs(graphicsState.currentTransformationMatrix.scaleX))
            for (r in rects) emit(r[0], r[1], r[2], r[3], fc, sc)
            if (s) for (g in segs) {
                if (Math.abs(g[1] - g[3]) < 0.5f) emit(g[0], g[1] - lw / 2, g[2], g[1] + lw / 2, sc, -1)         // a horizontal rule
                else if (Math.abs(g[0] - g[2]) < 0.5f) emit(g[0] - lw / 2, g[1], g[0] + lw / 2, g[3], sc, -1)    // a vertical rule
            }
            rects.clear(); segs.clear()
        }
        private fun num(b: com.tom_roush.pdfbox.cos.COSBase?): Float = (b as? com.tom_roush.pdfbox.cos.COSNumber)?.floatValue() ?: 0f
        override fun processOperator(operator: com.tom_roush.pdfbox.contentstream.operator.Operator?, operands: MutableList<com.tom_roush.pdfbox.cos.COSBase>?) {
            val a = operands ?: return
            when (operator?.name) {
                "re" -> if (a.size >= 4) { val x = num(a[0]); val y = num(a[1]); val w = num(a[2]); val h = num(a[3]); val p0 = tx(x, y); val p1 = tx(x + w, y + h); rects.add(floatArrayOf(p0[0], p0[1], p1[0], p1[1])) }
                "m" -> if (a.size >= 2) { val p = tx(num(a[0]), num(a[1])); cx = p[0]; cy = p[1] }
                "l" -> if (a.size >= 2) { val p = tx(num(a[0]), num(a[1])); segs.add(floatArrayOf(cx, cy, p[0], p[1])); cx = p[0]; cy = p[1] }
                "c" -> if (a.size >= 6) { val p = tx(num(a[4]), num(a[5])); cx = p[0]; cy = p[1] }
                "v", "y" -> if (a.size >= 4) { val p = tx(num(a[2]), num(a[3])); cx = p[0]; cy = p[1] }
                "h", "W", "W*" -> { }
                "f", "F", "f*" -> paint(true, false)
                "S", "s" -> paint(false, true)
                "B", "B*", "b", "b*" -> paint(true, true)
                "n" -> { rects.clear(); segs.clear() }
                else -> super.processOperator(operator, operands)
            }
        }
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
            var picBudget = 40   // pictures in the whole file (each page at most 12)
            for (i in 1..n) {
                strip.startPage = i; strip.endPage = i
                strip.words.clear(); strip.texts.clear(); strip.fonts.clear(); strip.colours.clear()
                val t = try { strip.getText(d) } catch (e: Exception) { "" }
                val clean = t.replace("\r", "").trim()
                val page = JSONObject().put("n", i).put("text", clean).put("scan", clean.replace(Regex("\\s"), "").length < 25)
                try {
                    page.put("lines", layoutLines(strip))
                    val box = d.getPage(i - 1).mediaBox
                    page.put("w", box.width.toDouble()).put("h", box.height.toDouble())
                } catch (e: Exception) { }   // no layout: the page falls back to the plain text
                // v6.10: table borders, rules and shaded rows
                try {
                    val box = d.getPage(i - 1).mediaBox
                    val pf = PathFinder(box.width, box.height)
                    pf.processPage(d.getPage(i - 1))
                    page.put("rects", pf.found)
                } catch (e: Exception) { } catch (e: OutOfMemoryError) { }
                if (picBudget > 0) try {
                    val f = ImageFinder(d.getPage(i - 1).mediaBox.height, minOf(12, picBudget))
                    f.processPage(d.getPage(i - 1))
                    picBudget -= f.found.length()
                    page.put("imgs", f.found)
                } catch (e: Exception) { } catch (e: OutOfMemoryError) { picBudget = 0 }
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
