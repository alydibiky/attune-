# python3 tools/i18n/import_gemini.py — reads Gemini's replies in tools/i18n/back/<lang>-<n>.(json|txt) (any ```json blocks, several
# replies may be pasted one after another), puts each line into out/<lang>/NN.json of its chunk, then runs check.mjs for that language.
import json, os, re, glob, subprocess
B = os.path.dirname(os.path.abspath(__file__))
for p in sorted(glob.glob(B + "/back/*.*")):
    m = re.match(r"([a-z]+)-\d+\.(json|txt)$", os.path.basename(p))
    if not m: continue
    lang, raw, got = m.group(1), open(p, encoding="utf8").read(), {}
    blocks = re.findall(r"```(?:json)?\s*(.*?)```", raw, re.S) or [raw]
    for b in blocks:
        b = b.strip().rstrip(",")
        try: got.update(json.loads(b))
        except Exception:
            try: got.update(json.loads(b + "}"))
            except Exception: print(p, "a block is not valid JSON")
    for f in sorted(glob.glob(f"{B}/todo/{lang}/[0-9]*.json")):
        todo = [x["en"] for x in json.load(open(f))]
        if not any(k in got for k in todo): continue
        o = f.replace("/todo/", "/out/"); old = json.load(open(o)) if os.path.exists(o) else {}
        old.update({k: got[k] for k in todo if isinstance(got.get(k), str)})
        os.makedirs(os.path.dirname(o), exist_ok=True); json.dump(old, open(o, "w"), ensure_ascii=False, indent=0)
    print(os.path.basename(p), len(got), "lines")
for lang in sorted({re.match(r"([a-z]+)-", os.path.basename(p)).group(1) for p in glob.glob(B + "/back/*-*.*")}):
    print(subprocess.run(["node", B + "/check.mjs", lang], capture_output=True, text=True).stdout.strip().splitlines()[-1])
