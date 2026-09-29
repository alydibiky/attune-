#!/usr/bin/env bash
# v6.8 — PDF → Word fidelity bench: sample Word files with every kind of formatting (make_samples.py) →
# PDF (LibreOffice) → the phone's reader (PdfLayout.java = DocTools.kt, on PDFBox 2.0.27) → the app's
# converter (convert.js) → Word → compared with the original, part by part (compare.py), plus a
# side-by-side picture of both (out/<name>.side.png). Needs LibreOffice, Java, python-docx, pdfplumber, pypdfium2.
#   bash tests/convert/run.sh
set -e
cd "$(dirname "$0")"
mkdir -p .cache out
J=.cache/pdfbox-app-2.0.27.jar
[ -s "$J" ] || curl -sSfL -o "$J" https://repo1.maven.org/maven2/org/apache/pdfbox/pdfbox-app/2.0.27/pdfbox-app-2.0.27.jar
python3 make_samples.py >/dev/null
for f in report arabic long; do
  java -Dstdout.encoding=UTF-8 -cp "$J" PdfLayout.java out/$f.pdf 2>/dev/null > out/$f.json
  node bench.mjs out/$f.json >/dev/null 2>&1
  printf "%-8s pdf→word " "$f"; python3 compare.py out/$f.docx out/$f.out.docx --png out/$f.side.png 2>/dev/null
done
# Word → PDF: the Word file read by the app (docxRead) → the print page (blocksToPrintHtml) → printed by
# Chromium as the phone's WebView does → read back through the PDF → Word path and compared (and the
# PDFs side by side: out/<name>.w2p.png)
for f in report arabic long; do
  node bench_pdf.mjs out/$f.docx 2>/dev/null
  python3 print_pdf.py out/$f.print.html out/$f.w2p.pdf
  java -Dstdout.encoding=UTF-8 -cp "$J" PdfLayout.java out/$f.w2p.pdf 2>/dev/null > out/$f.w2p.json
  node bench.mjs out/$f.w2p.json >/dev/null 2>&1
  printf '%-8s word→pdf ' "$f"; python3 compare.py out/$f.docx out/$f.w2p.out.docx 2>/dev/null
  python3 sidepdf.py out/$f.pdf out/$f.w2p.pdf out/$f.w2p.png 2>/dev/null
done
