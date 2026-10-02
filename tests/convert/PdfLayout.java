// v6.8 — the phone's PDF reader (app/src/main/java/com/aldibiki/attune/DocTools.kt: LayoutStripper +
// layoutLines + pdfText) ported line for line to desktop PDFBox 2.0.27 (the version pdfbox-android
// 2.0.27.0 is ported from), so the PDF → Word bench feeds convert.js exactly what the phone sends.
// Keep it in step with DocTools.kt.   java -cp pdfbox-app.jar PdfLayout.java file.pdf → JSON on stdout
import java.io.File;
import java.util.*;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.apache.pdfbox.contentstream.PDFStreamEngine;
import org.apache.pdfbox.contentstream.operator.Operator;
import org.apache.pdfbox.contentstream.operator.DrawObject;
import org.apache.pdfbox.contentstream.operator.state.*;
import org.apache.pdfbox.contentstream.operator.color.*;
import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.graphics.PDXObject;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.util.Matrix;

public class PdfLayout {
    static class LayoutStripper extends PDFTextStripper {
        final List<float[]> words = new ArrayList<>();   // x, xEnd, y, size, bold, italic, rtl, colour (rgb)
        final List<String> texts = new ArrayList<>();
        final List<String> fonts = new ArrayList<>();
        final Map<TextPosition, Integer> colours = new IdentityHashMap<>();
        LayoutStripper() throws java.io.IOException {
            super();
            // the text colour (PDFTextStripper doesn't track it on its own)
            addOperator(new SetStrokingColorSpace()); addOperator(new SetNonStrokingColorSpace());
            addOperator(new SetStrokingDeviceCMYKColor()); addOperator(new SetNonStrokingDeviceCMYKColor());
            addOperator(new SetNonStrokingDeviceRGBColor()); addOperator(new SetStrokingDeviceRGBColor());
            addOperator(new SetNonStrokingDeviceGrayColor()); addOperator(new SetStrokingDeviceGrayColor());
            addOperator(new SetStrokingColor()); addOperator(new SetStrokingColorN());
            addOperator(new SetNonStrokingColor()); addOperator(new SetNonStrokingColorN());
        }
        @Override protected void processTextPosition(TextPosition text) {
            try { colours.put(text, getGraphicsState().getNonStrokingColor().toRGB()); } catch (Exception e) { }
            super.processTextPosition(text);
        }
        @Override protected void writeString(String text0, List<TextPosition> tp) throws java.io.IOException {
            super.writeString(text0, tp);
            try {
                if (tp == null || tp.isEmpty() || text0 == null || text0.isBlank()) return;
                // v6.8: PDFBox often hands a whole line over in one piece — split it into its words (at spaces,
                // gaps and font changes, left to right on the page) so each keeps its own bold / colour / place
                List<TextPosition> g = new ArrayList<>(tp);
                g.sort(Comparator.comparingDouble(p -> p.getXDirAdj()));
                List<TextPosition> cur = new ArrayList<>();
                for (TextPosition p : g) {
                    String u = p.getUnicode() == null ? "" : p.getUnicode();
                    TextPosition last = cur.isEmpty() ? null : cur.get(cur.size() - 1);
                    boolean gap = last != null && p.getXDirAdj() - (last.getXDirAdj() + last.getWidthDirAdj()) > p.getFontSizeInPt() * 0.18f;
                    boolean fontChange = last != null && last.getFont() != p.getFont();
                    // v6.10: a smaller or lowered / raised character starts its own word (the X of Y_X/S, the −1 of h⁻¹)
                    boolean script = last != null && (Math.abs(p.getYDirAdj() - last.getYDirAdj()) > 0.9f || Math.min(p.getFontSizeInPt(), last.getFontSizeInPt()) < Math.max(p.getFontSizeInPt(), last.getFontSizeInPt()) * 0.85f);
                    if (u.isBlank() || gap || fontChange || script) { if (!cur.isEmpty()) addWord(null, cur); cur = new ArrayList<>(); if (u.isBlank()) continue; }
                    cur.add(p);
                }
                if (!cur.isEmpty()) addWord(null, cur);
            } catch (Exception e) { }
        }
        private void addWord(String text0, List<TextPosition> tp) {
            String text = text0 != null ? text0 : hasRtl(tp.stream().map(p -> p.getUnicode() == null ? "" : p.getUnicode()).reduce("", String::concat)) ? rtlText(tp)
                // a number in an Arabic line: "50%" is drawn «%50» — the sign goes back after the number
                : tp.stream().map(p -> p.getUnicode() == null ? "" : p.getUnicode()).reduce("", String::concat).replaceAll("^([%٪])(\\d[\\d.,]*)$", "$2$1");
            if (text.isBlank()) return;
            TextPosition a = tp.get(0);
            String fname = a.getFont() != null && a.getFont().getName() != null ? a.getFont().getName() : "";
            boolean bold = fname.matches("(?i).*(bold|black|heavy|semibold).*");
            boolean italic = fname.matches("(?i).*(italic|oblique).*");
            // the word's left and right edge whatever the writing direction (an Arabic word's first letter is on its right)
            float x0 = Float.MAX_VALUE, x1 = -Float.MAX_VALUE;
            for (TextPosition p : tp) { x0 = Math.min(x0, p.getXDirAdj()); x1 = Math.max(x1, p.getXDirAdj() + p.getWidthDirAdj()); }
            long ar = text.codePoints().filter(c -> c >= 0x0590 && c <= 0x08FF).count();
            long la = text.codePoints().filter(Character::isLetter).count() - ar;
            Integer rgb = colours.get(a);
            // the size as drawn: getFontSizeInPt ignores the page's scaling (a Chrome / Skia PDF draws at 3/4:
            // 11 pt came out as 14.7) — the text's y-scale includes it
            float sz = a.getYScale() > 0.5f ? Math.round(a.getYScale() * 2) / 2f : a.getFontSizeInPt();
            words.add(new float[]{x0, x1, a.getYDirAdj(), sz, bold ? 1 : 0, italic ? 1 : 0, ar, la, rgb == null ? 0 : rgb});
            texts.add(text); fonts.add(fname);
        }
    }

    // (a lone "%" is not one: Arabic text shows "50%" as «%50», so reading right to left already gives "50%")
    static boolean ltrish(String t) { return !hasRtl(t) && strongLtr(t); }
    static boolean hasRtl(String t) { return t.codePoints().anyMatch(c -> c >= 0x0590 && c <= 0x08FF || c >= 0xFB1D && c <= 0xFEFC); }
    static boolean strongLtr(String u) { return u.codePoints().anyMatch(c -> Character.isDigit(c) || (Character.isLetter(c) && !(c >= 0x0590 && c <= 0x08FF || c >= 0xFB1D && c <= 0xFEFC))); }
    /** v6.8: an Arabic word rebuilt from its letters, right to left — PDFBox's own reversal turns the
     *  لا ligature into «ال» («ملاحظة» → «مالحظة»); numbers and Latin words inside stay left to right. */
    static String rtlText(List<TextPosition> tp) {
        List<TextPosition> g = new ArrayList<>(tp);
        g.sort((a, b) -> Float.compare(b.getXDirAdj() + b.getWidthDirAdj() / 2, a.getXDirAdj() + a.getWidthDirAdj() / 2));
        List<String> u = new ArrayList<>();
        TextPosition prev = null;
        for (TextPosition p : g) {
            String c = java.text.Normalizer.normalize(p.getUnicode() == null ? "" : p.getUnicode(), java.text.Normalizer.Form.NFKC);
            if (prev != null && !c.isBlank() && !(u.size() > 0 && u.get(u.size() - 1).isBlank()) && prev.getXDirAdj() - (p.getXDirAdj() + p.getWidthDirAdj()) > p.getFontSizeInPt() * 0.18f) u.add(" ");
            u.add(c); prev = p;
        }
        // runs of numbers / Latin were laid right-to-left too: put each back in its own order
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < u.size(); ) {
            // a sign stuck to a number ("50%", "$20") belongs to the number's run
            boolean lead = u.get(i).matches("[%$€£+\\-]") && i + 1 < u.size() && strongLtr(u.get(i + 1));
            if (!strongLtr(u.get(i)) && !lead) { out.append(u.get(i)); i++; continue; }
            int j = i;
            while (j + 1 < u.size() && (strongLtr(u.get(j + 1)) || (u.get(j + 1).matches("[.,:%/+\\-]") && j + 2 < u.size() && strongLtr(u.get(j + 2))))) j++;
            for (int k = j; k >= i; k--) out.append(u.get(k));
            i = j + 1;
        }
        return out.toString().replaceAll(" {2,}", " ");
    }

    static String q(String s) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\') sb.append('\\').append(c);
            else if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
            else sb.append(c);
        }
        return sb.append('"').toString();
    }
    static String n(double d) { return d == Math.rint(d) ? String.valueOf((long) d) : String.format(Locale.ROOT, "%.2f", d); }

    // == DocTools.layoutLines ==
    static String layoutLines(LayoutStripper st) {
        int n = st.words.size();
        if (n == 0) return "[]";
        Integer[] order = new Integer[n];
        for (int i = 0; i < n; i++) order[i] = i;
        Arrays.sort(order, Comparator.<Integer>comparingDouble(i -> st.words.get(i)[2]).thenComparingDouble(i -> st.words.get(i)[0]));
        List<List<Integer>> groups = new ArrayList<>();
        for (int i : order) {
            float[] w = st.words.get(i);
            List<Integer> g = groups.isEmpty() ? null : groups.get(groups.size() - 1);
            if (g != null) {
                float[] f = st.words.get(g.get(0));
                boolean scriptPair = Math.min(w[3], f[3]) < Math.max(w[3], f[3]) * 0.85f;   // v6.10: a sub / superscript belongs to its line
                if (Math.abs(w[2] - f[2]) <= Math.max(2f, scriptPair ? Math.max(w[3], f[3]) * 0.55f : Math.min(w[3], f[3]) * 0.45f)) { g.add(i); continue; }
            }
            groups.add(new ArrayList<>(List.of(i)));
        }
        StringBuilder out = new StringBuilder("[");
        for (List<Integer> g : groups) {
            // v6.8: a right-to-left line is read from its right edge — its words (and its columns) in reading order
            // (by letters: a bullet or a number has none)
            float arL = 0, laL = 0; for (int i : g) { arL += st.words.get(i)[6]; laL += st.words.get(i)[7]; }
            boolean rtlLine = arL > laL;
            g.sort(Comparator.comparingDouble(i -> st.words.get(i)[0]));
            if (rtlLine) {
                Collections.reverse(g);
                // English words and numbers inside an Arabic line keep their own left-to-right order
                // ("Liebherr LTM 1090", "50 %"): each such run is put back
                for (int k = 0; k < g.size(); ) {
                    if (!ltrish(st.texts.get(g.get(k)))) { k++; continue; }
                    int m = k; boolean strong = false;
                    while (m < g.size() && ltrish(st.texts.get(g.get(m)))
                        && (m == k || st.words.get(g.get(m - 1))[0] - st.words.get(g.get(m))[1] < st.words.get(g.get(m))[3] * 1.6f)) { strong |= strongLtr(st.texts.get(g.get(m))); m++; }   // not across a column gap
                    if (strong && m - k > 1) Collections.reverse(g.subList(k, m));
                    k = m;
                }
            }
            List<Float> sizes = new ArrayList<>(); for (int i : g) sizes.add(st.words.get(i)[3]); Collections.sort(sizes);
            float size = sizes.get(sizes.size() / 2);
            List<Float> baseYs = new ArrayList<>(); for (int i : g) if (st.words.get(i)[3] >= size * 0.9f) baseYs.add(st.words.get(i)[2]); Collections.sort(baseYs);
            float base = baseYs.isEmpty() ? st.words.get(g.get(0))[2] : baseYs.get(baseYs.size() / 2);
            StringBuilder spans = new StringBuilder("[");
            float spanX = -1f, spanEnd = 0f, spanSize = 0f, spanFar = 0f; StringBuilder sb = new StringBuilder();
            StringBuilder wordsOf = new StringBuilder("[");
            boolean allBold = true, allItalic = true;
            Map<String, Integer> fontVotes = new HashMap<>(); Map<Integer, Integer> colVotes = new HashMap<>();
            float lineX0 = Float.MAX_VALUE, lineX1 = -Float.MAX_VALUE;
            for (int i : g) {
                float[] w = st.words.get(i); String t = st.texts.get(i);
                if (w[4] < 0.5f) allBold = false;
                if (w[5] < 0.5f) allItalic = false;
                fontVotes.merge(st.fonts.get(i), t.length(), Integer::sum); colVotes.merge((int) w[8], t.length(), Integer::sum);
                lineX0 = Math.min(lineX0, w[0]); lineX1 = Math.max(lineX1, w[1]);
                // the gap to the previous word, measured in reading order
                float gap = spanX < 0f ? 0f : rtlLine ? spanEnd - w[1] : w[0] - spanEnd;
                if (spanX >= 0f && gap > size * 1.6f) {
                    spans.append(spans.length() > 1 ? "," : "").append("[").append(n(spanX)).append(",").append(q(sb.toString())).append(",").append(n(spanSize)).append(",").append(wordsOf).append("]]");
                    sb.setLength(0); spanX = -1f; wordsOf = new StringBuilder("[");
                }
                if (spanX < 0f) { spanX = rtlLine ? w[1] : w[0]; spanSize = w[3]; spanFar = rtlLine ? w[0] : w[1]; }
                else if (!(w[3] < size * 0.85f && w[2] < base - 0.5f) && gap > size * 0.12f) sb.append(' ');
                // v6.10: a smaller word raised above the line is a superscript (2^−ΔΔCt), one lowered is a subscript (Y_X/S)
                int v = w[3] < size * 0.85f ? (w[2] < base - 0.5f ? 1 : w[2] > base + 0.5f ? -1 : 0) : 0;
                if (v == 1 && spanX >= 0f && sb.length() > 0) sb.append("^(").append(t).append(")"); else sb.append(t);
                spanEnd = rtlLine ? w[0] : w[1];
                // each word: x, text, bold, italic, colour, xEnd, script (+1 super, −1 sub)
                wordsOf.append(wordsOf.length() > 1 ? "," : "").append("[").append(n(rtlLine ? w[1] : w[0])).append(",").append(q(t)).append(",").append((int) w[4]).append(",").append((int) w[5]).append(",").append((int) w[8]).append(",").append(n(rtlLine ? w[0] : w[1])).append(",").append(v).append("]");
            }
            if (spanX >= 0f) spans.append(spans.length() > 1 ? "," : "").append("[").append(n(spanX)).append(",").append(q(sb.toString())).append(",").append(n(spanSize)).append(",").append(wordsOf).append("]]");
            spans.append("]");
            float[] first = st.words.get(g.get(0));
            out.append(out.length() > 1 ? "," : "").append("{\"y\":").append(n(first[2])).append(",\"x\":").append(n(lineX0)).append(",\"e\":").append(n(lineX1))
                .append(",\"s\":").append(n(size)).append(",\"b\":").append(allBold).append(",\"i\":").append(allItalic).append(",\"r\":").append(rtlLine)
                .append(",\"f\":").append(q(Collections.max(fontVotes.entrySet(), Map.Entry.comparingByValue()).getKey()))
                .append(",\"c\":").append(Collections.max(colVotes.entrySet(), Map.Entry.comparingByValue()).getKey())
                .append(",\"sp\":").append(spans).append("}");
        }
        return out.append("]").toString();
    }

    // == DocTools.pageImages: the pictures on a page, where they sit (top-left, in points) and how big ==
    static class ImageFinder extends PDFStreamEngine {
        final List<String> found = new ArrayList<>(); final float pageH; int budget;
        ImageFinder(float pageH, int budget) {
            this.pageH = pageH; this.budget = budget;
            addOperator(new Concatenate()); addOperator(new DrawObject()); addOperator(new SetGraphicsStateParameters());
            addOperator(new Save()); addOperator(new Restore()); addOperator(new SetMatrix());
        }
        @Override protected void processOperator(Operator op, List<COSBase> operands) throws java.io.IOException {
            if ("Do".equals(op.getName()) && !operands.isEmpty() && operands.get(0) instanceof COSName) {
                PDXObject xo = getResources().getXObject((COSName) operands.get(0));
                if (xo instanceof PDImageXObject && budget > 0) {
                    Matrix m = getGraphicsState().getCurrentTransformationMatrix();
                    float w = Math.abs(m.getScalingFactorX()), h = Math.abs(m.getScalingFactorY());
                    if (w >= 24 && h >= 24) {
                        java.awt.image.BufferedImage bi = ((PDImageXObject) xo).getImage();
                        int maxPx = 1600; double k = Math.min(1.0, maxPx / (double) Math.max(bi.getWidth(), bi.getHeight()));
                        if (k < 1) { java.awt.image.BufferedImage sc = new java.awt.image.BufferedImage((int) (bi.getWidth() * k), (int) (bi.getHeight() * k), java.awt.image.BufferedImage.TYPE_INT_RGB); sc.createGraphics().drawImage(bi.getScaledInstance(sc.getWidth(), sc.getHeight(), java.awt.Image.SCALE_SMOOTH), 0, 0, null); bi = sc; }
                        java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                        javax.imageio.ImageIO.write(bi, "png", bo);
                        float top = pageH - m.getTranslateY() - h;
                        found.add("{\"x\":" + n(m.getTranslateX()) + ",\"y\":" + n(top) + ",\"w\":" + n(w) + ",\"h\":" + n(h) + ",\"b64\":\"data:image/png;base64," + Base64.getEncoder().encodeToString(bo.toByteArray()) + "\"}");
                        budget--;
                    }
                    return;
                }
            }
            super.processOperator(op, operands);
        }
    }

    /**
     * v6.10: the page's filled rectangles and ruled lines (table shading and borders, boxes): [x, top, w, h, fill, stroke]
     * in points, top-left origin; fill / stroke are 0xRRGGBB or -1 for none. A ruled line is a thin rectangle. At most 400 a page.
     * Watches the drawing operators itself (re, m, l, f, S, B …) like ImageFinder watches Do — the same code runs on the phone.
     */
    static class PathFinder extends PDFStreamEngine {
        final List<float[]> found = new ArrayList<>(); final float pageW, pageH;
        private final List<float[]> rects = new ArrayList<>();     // the path being built: x0, y0, x1, y1 (page space)
        private final List<float[]> segs = new ArrayList<>();
        private float cx, cy;
        PathFinder(float pageW, float pageH) {
            this.pageW = pageW; this.pageH = pageH;
            addOperator(new Concatenate()); addOperator(new Save()); addOperator(new Restore()); addOperator(new SetMatrix());
            addOperator(new SetLineWidth()); addOperator(new SetGraphicsStateParameters());
            addOperator(new SetStrokingColorSpace()); addOperator(new SetNonStrokingColorSpace());
            addOperator(new SetStrokingDeviceCMYKColor()); addOperator(new SetNonStrokingDeviceCMYKColor());
            addOperator(new SetNonStrokingDeviceRGBColor()); addOperator(new SetStrokingDeviceRGBColor());
            addOperator(new SetNonStrokingDeviceGrayColor()); addOperator(new SetStrokingDeviceGrayColor());
            addOperator(new SetStrokingColor()); addOperator(new SetStrokingColorN());
            addOperator(new SetNonStrokingColor()); addOperator(new SetNonStrokingColorN());
        }
        private float[] tx(float x, float y) { Matrix m = getGraphicsState().getCurrentTransformationMatrix(); return new float[]{m.getScaleX() * x + m.getShearX() * y + m.getTranslateX(), m.getShearY() * x + m.getScaleY() * y + m.getTranslateY()}; }
        private int rgb(boolean fill) { try { var c = fill ? getGraphicsState().getNonStrokingColor() : getGraphicsState().getStrokingColor(); return c == null ? -1 : c.toRGB() & 0xFFFFFF; } catch (Exception e) { return -1; } }
        private void emit(float x0, float y0, float x1, float y1, int fill, int stroke) {
            if (found.size() >= 400) return;
            float x = Math.min(x0, x1), w = Math.abs(x1 - x0), yb = Math.min(y0, y1), h = Math.abs(y1 - y0);
            if (w < 0.3f && h < 0.3f) return;
            if (w >= pageW * 0.95f && h >= pageH * 0.95f && (fill == 0xFFFFFF || fill == -1)) return;   // the page background
            found.add(new float[]{x, pageH - (yb + h), w, h, fill, stroke});
        }
        private void paint(boolean f, boolean s) {
            int fc = f ? rgb(true) : -1, sc = s ? rgb(false) : -1;
            float lw = Math.max(0.4f, getGraphicsState().getLineWidth() * Math.abs(getGraphicsState().getCurrentTransformationMatrix().getScaleX()));
            for (float[] r : rects) emit(r[0], r[1], r[2], r[3], fc, sc);
            if (s) for (float[] g : segs) {
                if (Math.abs(g[1] - g[3]) < 0.5f) emit(g[0], g[1] - lw / 2, g[2], g[1] + lw / 2, sc, -1);       // a horizontal rule
                else if (Math.abs(g[0] - g[2]) < 0.5f) emit(g[0] - lw / 2, g[1], g[0] + lw / 2, g[3], sc, -1);   // a vertical rule
            }
            rects.clear(); segs.clear();
        }
        private static float num(COSBase b) { return b instanceof org.apache.pdfbox.cos.COSNumber ? ((org.apache.pdfbox.cos.COSNumber) b).floatValue() : 0f; }
        @Override protected void processOperator(Operator op, List<COSBase> a) throws java.io.IOException {
            String n = op.getName();
            switch (n) {
                case "re": if (a.size() >= 4) { float x = num(a.get(0)), y = num(a.get(1)), w = num(a.get(2)), h = num(a.get(3)); float[] p0 = tx(x, y), p1 = tx(x + w, y + h); rects.add(new float[]{p0[0], p0[1], p1[0], p1[1]}); } return;
                case "m": if (a.size() >= 2) { float[] p = tx(num(a.get(0)), num(a.get(1))); cx = p[0]; cy = p[1]; } return;
                case "l": if (a.size() >= 2) { float[] p = tx(num(a.get(0)), num(a.get(1))); segs.add(new float[]{cx, cy, p[0], p[1]}); cx = p[0]; cy = p[1]; } return;
                case "c": if (a.size() >= 6) { float[] p = tx(num(a.get(4)), num(a.get(5))); cx = p[0]; cy = p[1]; } return;
                case "v": case "y": if (a.size() >= 4) { float[] p = tx(num(a.get(2)), num(a.get(3))); cx = p[0]; cy = p[1]; } return;
                case "h": case "W": case "W*": return;
                case "f": case "F": case "f*": paint(true, false); return;
                case "S": case "s": paint(false, true); return;
                case "B": case "B*": case "b": case "b*": paint(true, true); return;
                case "n": rects.clear(); segs.clear(); return;
                default: super.processOperator(op, a);
            }
        }
    }

    public static void main(String[] args) throws Exception {
        try (PDDocument d = PDDocument.load(new File(args[0]))) {
            int count = d.getNumberOfPages();
            LayoutStripper strip = new LayoutStripper();
            strip.setSortByPosition(true); strip.setAddMoreFormatting(true); strip.setParagraphEnd("\n");
            StringBuilder pages = new StringBuilder("[");
            for (int i = 1; i <= count; i++) {
                strip.setStartPage(i); strip.setEndPage(i);
                strip.words.clear(); strip.texts.clear(); strip.fonts.clear(); strip.colours.clear();
                String t = strip.getText(d).replace("\r", "").trim();
                boolean scan = t.replaceAll("\\s", "").length() < 25;
                var box = d.getPage(i - 1).getMediaBox();
                ImageFinder imgs = new ImageFinder(box.getHeight(), 12);
                try { imgs.processPage(d.getPage(i - 1)); } catch (Exception e) { }
                PathFinder paths = new PathFinder(box.getWidth(), box.getHeight());
                try { paths.processPage(d.getPage(i - 1)); } catch (Exception e) { }
                StringBuilder rj = new StringBuilder();
                for (float[] r : paths.found) rj.append(rj.length() > 0 ? "," : "").append("[").append(n(r[0])).append(",").append(n(r[1])).append(",").append(n(r[2])).append(",").append(n(r[3])).append(",").append((int) r[4]).append(",").append((int) r[5]).append("]");
                pages.append(pages.length() > 1 ? "," : "").append("{\"n\":").append(i).append(",\"text\":").append(q(t)).append(",\"scan\":").append(scan)
                    .append(",\"lines\":").append(layoutLines(strip)).append(",\"w\":").append(n(box.getWidth())).append(",\"h\":").append(n(box.getHeight())).append(",\"imgs\":[").append(String.join(",", imgs.found)).append("],\"rects\":[").append(rj).append("]}");
            }
            System.out.println("{\"pages\":" + pages + "],\"count\":" + count + "}");
        }
    }
}
