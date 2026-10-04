#!/usr/bin/env bash
# v6.10 — the real PDF through the phone's reader and the converter, then each line's place in the Word file's
# LibreOffice print against the original (dx / dy in points).   bash tests/convert/pos.sh [name]
set -e
cd "$(dirname "$0")"
n=${1:-biotech_assign_2}
java -Dstdout.encoding=UTF-8 -cp .cache/pdfbox-app-2.0.27.jar PdfLayout.java fixtures/real/$n.pdf 2>/dev/null > out/$n.json
node bench.mjs out/$n.json >/dev/null
python3 linepos.py fixtures/real/$n.pdf out/$n.out.docx
