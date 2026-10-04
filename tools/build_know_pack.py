#!/usr/bin/env python3
"""Builds a public Knowledge pack (v6.20) — first pack: "Egypt basics" from Wikipedia (English + Arabic).

Source: the Hugging Face dataset wikimedia/wikipedia (parquet, one config per language, e.g. 20231101.en / 20231101.ar).
Licence of the text: CC BY-SA 3.0 (and GFDL) — Wikipedia contributors. The pack keeps every article's link, says what was
changed (only the opening section of each article, cut into short passages) and is itself shared under CC BY-SA 3.0.

Which articles: Egypt-related titles (Egypt, Cairo, Nile, Giza, Luxor, Aswan, Suez, Sinai, pharaohs… and the Arabic names),
then articles whose opening mentions Egypt several times. Best matches first, up to a size budget (default 60 MB of text,
about 20 MB to download gzipped).

Output (out/):  manifest.json  +  egypt-000.jsonl.gz …   one passage per line: {"t": title, "x": text, "u": url, "l": lang}

  python3 tools/build_know_pack.py out [--langs en,ar] [--max-files N] [--budget-mb 60] [--date 20231101]
"""
import argparse, gzip, json, os, re, sys, tempfile, time, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("out")
ap.add_argument("--langs", default="en,ar")
ap.add_argument("--date", default="20231101")
ap.add_argument("--max-files", type=int, default=0, help="read only the first N parquet files per language (for a quick test)")
ap.add_argument("--budget-mb", type=float, default=60)
ap.add_argument("--per-article", type=int, default=3, help="passages kept per article (its opening section)")
ap.add_argument("--shard", type=int, default=4000)
a = ap.parse_args()

TITLE = {
  "en": re.compile(r"\b(Egypt|Egyptian|Egyptians|Cairo|Alexandria|Giza|Luxor|Aswan|Suez|Sinai|Nile|Port Said|Ismailia|Hurghada|Sharm El Sheikh|Fayoum|Faiyum|Mansoura|Tanta|Zagazig|Asyut|Sohag|Qena|Minya|Damietta|Siwa|Abu Simbel|Karnak|Saqqara|Memphis, Egypt|Thebes|Pharaoh|Pyramid|Sphinx|Ptolem|Mamluk|Fatimid|Ayyubid|Khedive|Nasser|Sadat|Mubarak|Sisi|Tutankhamun|Ramesses|Khufu|Cleopatra|Al-Azhar|Coptic|Copts)\b"),
  "ar": re.compile(r"(مصر|مصري|المصري|القاهرة|الإسكندرية|الاسكندرية|الجيزة|الأقصر|أسوان|السويس|سيناء|النيل|بورسعيد|الإسماعيلية|الغردقة|شرم الشيخ|الفيوم|المنصورة|طنطا|الزقازيق|أسيوط|سوهاج|قنا|المنيا|دمياط|سيوة|أبو سمبل|الكرنك|سقارة|فرعون|الفراعنة|الأهرامات|هرم|أبو الهول|البطالمة|المماليك|الفاطمي|الأيوبي|الخديوي|عبد الناصر|السادات|مبارك|السيسي|توت عنخ آمون|رمسيس|خوفو|كليوباترا|الأزهر|القبط|قبطي)"),
}
LEAD = {"en": re.compile(r"\bEgypt(ian)?s?\b"), "ar": re.compile(r"مصر|المصري|مصري")}

def parquet_urls(lang):
    u = f"https://huggingface.co/api/datasets/wikimedia/wikipedia/parquet/{a.date}.{lang}/train"
    urls = json.load(urllib.request.urlopen(u, timeout=60))
    return urls[: a.max_files] if a.max_files else urls

def fetch(url, path):
    for i in range(5):
        try:
            with urllib.request.urlopen(url, timeout=120) as r, open(path, "wb") as f:
                while True:
                    b = r.read(1 << 20)
                    if not b: break
                    f.write(b)
            return
        except Exception as e:
            print("retry", url, e, file=sys.stderr); time.sleep(5 * (i + 1))
    raise SystemExit("download failed: " + url)

def lead(text, chars=2400):
    """The opening section: text up to the first section heading / blank-line block, at most `chars`."""
    t = re.sub(r"\n{2,}", "\n\n", text.strip())
    out = []
    for para in t.split("\n\n"):
        p = para.strip()
        if not p: continue
        if len(p) < 40 and not re.search(r"[.!?؟]$", p) and out: break   # a heading: the lead ends here
        out.append(p)
        if sum(len(x) for x in out) > chars: break
    return "\n\n".join(out)[:chars]

def passages(text, size=600):
    out, cur = [], ""
    for s in re.split(r"(?<=[.!?؟])\s+", text.replace("\n\n", " \n\n ")):
        s = s.strip()
        if not s: continue
        if cur and len(cur) + len(s) + 1 > size: out.append(cur.strip()); cur = s
        else: cur = (cur + " " + s) if cur else s
    if cur.strip(): out.append(cur.strip())
    return [p for p in out if len(p) > 60]

import pyarrow.parquet as pq
picked = []                      # (score, lang, title, url, passages)
for lang in a.langs.split(","):
    T, L = TITLE[lang], LEAD[lang]
    urls = parquet_urls(lang)
    print(f"{lang}: {len(urls)} parquet files", file=sys.stderr)
    for k, url in enumerate(urls):
        with tempfile.NamedTemporaryFile(suffix=".parquet", delete=True) as tmp:
            fetch(url, tmp.name)
            f = pq.ParquetFile(tmp.name); n0 = len(picked)
            for batch in f.iter_batches(columns=["title", "text", "url"], batch_size=4000):
                d = batch.to_pydict()
                for title, text, link in zip(d["title"], d["text"], d["url"]):
                    if not text or len(text) < 300: continue
                    if re.match(r"^(List of|Lists of|قائمة)", title): continue
                    ld = lead(text)
                    hits = len(L.findall(ld))
                    # an Egypt-like title counts only when the opening also says Egypt ("هرم (هندسة)" or an Algerian town does not)
                    if hits < 1 or (hits < 3 and not T.search(title)): continue
                    score = (10 if T.search(title) else 0) + min(hits, 8)
                    ps = passages(ld)[: a.per_article]
                    if ps: picked.append((score + min(len(text), 60000) / 20000, lang, title, link, ps))
            print(f"  {lang} file {k + 1}/{len(urls)}: +{len(picked) - n0} articles", file=sys.stderr)

picked.sort(key=lambda r: -r[0])
os.makedirs(a.out, exist_ok=True)
budget = int(a.budget_mb * 1e6); used = 0; rows = []; langs = {}
for score, lang, title, link, ps in picked:
    for p in ps:
        line = json.dumps({"t": title, "x": p, "u": link, "l": lang}, ensure_ascii=False)
        b = len(line.encode("utf-8"))
        if used + b > budget: break
        rows.append(line); used += b
    else:                                  # every passage of this article fitted
        langs[lang] = langs.get(lang, 0) + 1
        continue
    break                                  # the size budget is used up

shards = []
for i in range(0, len(rows), a.shard):
    name = f"egypt-{i // a.shard:03d}.jsonl.gz"
    data = ("\n".join(rows[i:i + a.shard]) + "\n").encode("utf-8")
    with gzip.open(os.path.join(a.out, name), "wb", compresslevel=9) as g: g.write(data)
    shards.append({"name": name, "bytes": os.path.getsize(os.path.join(a.out, name)), "raw": len(data), "count": min(a.shard, len(rows) - i)})

manifest = {
    "id": "egypt", "name": "Egypt basics", "name_ar": "أساسيات مصر", "version": 1, "built": time.strftime("%Y-%m-%d"),
    "license": "CC BY-SA 3.0",
    "attribution": "Text from Wikipedia (English and Arabic) by Wikipedia contributors, via the wikimedia/wikipedia dataset " + a.date + ". Changed: only the opening section of each article, cut into short passages. Each passage keeps its article link.",
    "sources": [{"title": f"Wikipedia ({l})", "url": f"https://huggingface.co/datasets/wikimedia/wikipedia/tree/main/{a.date}.{l}", "license": "CC BY-SA 3.0 / GFDL"} for l in a.langs.split(",")],
    "articles": langs, "count": len(rows), "bytes": used, "shards": shards,
}
json.dump(manifest, open(os.path.join(a.out, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"Egypt basics: {len(rows)} passages from {sum(langs.values())} articles {langs}, {used / 1e6:.1f} MB text, {sum(s['bytes'] for s in shards) / 1e6:.1f} MB to download, {len(shards)} shards")
