#!/usr/bin/env bash
# v6.10 — only the real-document cases of the bench (fixtures/real/*.expect.json), with a reader / converter of choice:
#   bash tests/convert/realrun.sh [dir-with-tests/convert/PdfLayout.java-and-web-src/convert.js]   (default: this checkout)
# (pass an older checkout's copy to get the "before" numbers)
set -e
cd "$(dirname "$0")"
J=$PWD/.cache/pdfbox-app-2.0.27.jar
R=${1:-$PWD/../..}
for f in fixtures/real/*.expect.json; do
  n=$(basename "$f" .expect.json)
  java -Dstdout.encoding=UTF-8 -cp "$J" "$R/tests/convert/PdfLayout.java" fixtures/real/$n.pdf 2>/dev/null > out/$n.json
  node "$R/tests/convert/bench.mjs" out/$n.json >/dev/null 2>&1
  printf '%-16s real ' "$n"; python3 realscore.py fixtures/real/$n.pdf out/$n.out.docx "$f" --png out/$n.side.png 2>/dev/null
done
