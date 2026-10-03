#!/usr/bin/env python3
"""Find a GGUF on Hugging Face: python3 resolve_hf.py "<search words>" "<quant preference, comma separated>" [required words in the repo name]
Prints:  REPO FILE   (the most downloaded matching repo, the first quant in the preference list that exists, single-file builds only)."""
import sys, json, urllib.request, urllib.parse

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "attune-lab"}), timeout=60) as r:
        return json.load(r)

search, prefs = sys.argv[1], [p.strip() for p in sys.argv[2].split(",")]
need = [w.lower() for w in sys.argv[3:]]
q = urllib.parse.urlencode({"search": search, "filter": "gguf", "sort": "downloads", "direction": -1, "limit": 30})
for m in get("https://huggingface.co/api/models?" + q):
    rid = m["id"]
    if any(w not in rid.lower() for w in need):
        continue
    try:
        files = [s["rfilename"] for s in get("https://huggingface.co/api/models/" + rid)["siblings"]]
    except Exception:
        continue
    ggufs = [f for f in files if f.endswith(".gguf") and "mmproj" not in f.lower() and "-of-" not in f]
    for p in prefs:
        hit = [f for f in ggufs if p.lower() in f.lower()]
        if hit:
            print(rid, sorted(hit, key=len)[0]); sys.exit(0)
print("NOT FOUND", search, file=sys.stderr); sys.exit(1)
