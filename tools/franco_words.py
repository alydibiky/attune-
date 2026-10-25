"""Builds web-src/franco-words.js (Arabic → Franco, Egyptian) from the Franco keyboard's dictionary in Franco.kt (Franco →
Arabic): the first Franco spelling of each Arabic word wins (the dictionary lists the usual spelling first).
  python3 tools/franco_words.py"""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "app/src/main/java/com/aldibiki/attune/Franco.kt").read_text(encoding="utf-8")
out = {}
for fr, ar in re.findall(r'"([^"]+)" to "([^"]+)"', src):
    if " " in fr or not re.search(r"[؀-ۿ]", ar): continue
    out.setdefault(ar, fr)
js = "// Built by tools/franco_words.py from Franco.kt (the Franco keyboard's words) — Arabic → the usual Egyptian Franco spelling.\nexport const FROM_KEYBOARD = " + json.dumps(out, ensure_ascii=False) + ";\n"
(root / "web-src/franco-words.js").write_text(js, encoding="utf-8")
print(len(out), "words")
