#!/usr/bin/env python3
"""Adds new interface lines to all 20 dictionaries in one go (Ali's rule: every addition in every language, in the same change).
   python3 tools/i18n/add_lines.py lines.json
lines.json = { "<the exact English passed to tr()>": { "ar": "...", "arb": "...", "fr": "...", … all 20 … }, … }
Refuses a line whose placeholders differ or that misses a language; skips a line a dictionary already has."""
import json, re, sys, os
LANGS = "ar arb es fr de pt it ru tr id hi ur fa bn sw th vi zh ja ko".split()
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "web-src")
ph = lambda s: sorted(re.findall(r"\{\w+\}", s))
data = json.load(open(sys.argv[1], encoding="utf-8")); bad = 0
for en, d in data.items():
    for l in LANGS:
        if l not in d: print("MISSING", l, "for:", en[:60]); bad += 1
        elif ph(d[l]) != ph(en): print("PLACEHOLDERS", l, en[:60]); bad += 1
if bad: sys.exit(1)
for l in LANGS:
    f = os.path.join(ROOT, "i18n-%s.js" % l); s = open(f, encoding="utf-8").read()
    end = s.rstrip().rfind("};"); add = ""
    for en, d in data.items():
        key = json.dumps(en, ensure_ascii=False)
        if ("\n  " + key + ":") in s: continue
        add += "  %s: %s,\n" % (key, json.dumps(d[l], ensure_ascii=False))
    if add: open(f, "w", encoding="utf-8").write(s[:end] + add + s[end:])
    print(l, "+%d" % add.count("\n"))
