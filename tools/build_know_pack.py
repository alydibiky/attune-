#!/usr/bin/env python3
"""Builds the public Knowledge packs (v6.20). No Wikipedia (Ali's rule, v5.22) — the sources are:

  world  "World facts"            CIA World Factbook, public domain (US government work), from the factbook/factbook.json
                                  repository (one JSON per country). One passage per section / subsection, the country's name in
                                  every passage. Egypt first and complete, then every other country.
  laws   "Egyptian laws (Arabic)" the Hugging Face dataset dataflare/egypt-legal-corpus (declared MIT by its publisher). Laws and
                                  codes only (court rulings and encyclopedias are left out; so are other countries' laws), cut at
                                  each article ("مادة N") into ~600-character passages titled "<law> — مادة N". Most-used laws first,
                                  up to a size budget. NOT legal advice: texts may be old or amended — check the official gazette.

v6.16 (Ali: "find reliable sources and make the app better in general knowledge") — six more, all reliable and open:
  science  OpenStax textbooks (Rice University; peer-reviewed; CC BY 4.0 only — NC books are left out)
  health   MedlinePlus health topics (US National Library of Medicine; public domain)
  numbers  World Bank open data: each country's latest key figures (CC BY 4.0)
  cities   GeoNames: every city over 15,000 people, with Arabic names (CC BY 4.0)
  cranes   OSHA crane, derrick, hoist and sling rules from the eCFR (US government; public domain)
  quran    the Quran's Arabic text from the Tanzil Project (verbatim, with credit — the text is never changed)

Output (out/, format 2): manifest.json + <id>.sqlite.gz — a ready search database (the phone searches it with SQLite FTS4;
nothing is indexed in the page's memory): passages(id, title, text, url, lang) + passages_fts(key) where key is the
normalised title + text (the same normalisation as the maps: tools/build_map_pack.py normalize()).

  python3 tools/build_know_pack.py <world|laws|science|health|numbers|cities|cranes|quran> out [--budget-mb N]
"""
import argparse, gzip, hashlib, io, json, os, re, shutil, sqlite3, subprocess, sys, tempfile, time, urllib.request, zipfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_map_pack import normalize

def get(url, timeout=120, accept=None):
    for i in range(5):
        try:
            h = {"User-Agent": "attune-know-pack"}
            if accept: h["Accept"] = accept
            if "api.github.com" in url and os.environ.get("GITHUB_TOKEN"): h["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r: return r.read()
        except Exception as e:
            print("retry", url, e, file=sys.stderr); time.sleep(3 * (i + 1))
    raise SystemExit("download failed: " + url)

STOP = set("the a an of in on at to for and or is are was were be by with from as that this these those it its into about what which who whom whose when where why how do does did can could will would should may might than then there their them they he she his her you your i we our not no yes".split()) | \
       set("في من على عن إلى الى هو هي ما ماذا متى أين اين كيف كم هل التي الذي الذين و او أو ثم مع كان كانت هذا هذه ذلك تلك".split())

def write_pack(out, pid, rows, manifest):
    """Format 2: <pid>.sqlite.gz (passages + FTS4 on the normalised text) and manifest.json with its size and SHA-256."""
    if not rows: raise SystemExit(f"{pid}: no passages were built — nothing is published (the app keeps the last good pack)")
    os.makedirs(out, exist_ok=True)
    db_path = os.path.join(out, pid + ".sqlite")
    if os.path.exists(db_path): os.remove(db_path)
    db = sqlite3.connect(db_path)
    db.execute("PRAGMA journal_mode=OFF"); db.execute("PRAGMA synchronous=OFF"); db.execute("PRAGMA page_size=4096")
    db.execute("CREATE TABLE passages(id INTEGER PRIMARY KEY, title TEXT, text TEXT, url TEXT, lang TEXT)")
    db.execute('CREATE VIRTUAL TABLE passages_fts USING fts4(key, prefix="3,5")')
    raw = 0
    for i, r in enumerate(rows, 1):
        db.execute("INSERT INTO passages VALUES (?,?,?,?,?)", (i, r.get("t", ""), r["x"], r.get("u", ""), r.get("l", "")))
        db.execute("INSERT INTO passages_fts(rowid, key) VALUES (?,?)", (i, normalize((r.get("t", "") + " " + r["x"]))))
        raw += len(r["x"].encode("utf-8"))
    db.commit(); db.execute("INSERT INTO passages_fts(passages_fts) VALUES('optimize')"); db.commit(); db.execute("VACUUM"); db.close()
    gz = db_path + ".gz"
    with open(db_path, "rb") as src, gzip.open(gz, "wb", compresslevel=9) as dst: shutil.copyfileobj(src, dst)
    full = os.path.getsize(db_path); os.remove(db_path)
    h = hashlib.sha256(open(gz, "rb").read()).hexdigest()
    manifest.update({"id": pid, "format": 2, "built": time.strftime("%Y-%m-%d"), "count": len(rows), "bytes": raw,
                     "files": [{"name": os.path.basename(gz), "bytes": os.path.getsize(gz), "sha256": h, "gz": True, "unpacked": full}]})
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{manifest['name']}: {len(rows)} passages, {raw / 1e6:.1f} MB text, {os.path.getsize(gz) / 1e6:.1f} MB to download ({full / 1e6:.1f} MB on the phone)")

def chunk(text, size=650):
    """Text → pieces of about `size` characters, cut at sentence ends."""
    out, cur = [], ""
    for s in re.split(r"(?<=[.!?؟;:])\s+", re.sub(r"\s+", " ", text).strip()):
        if cur and len(cur) + len(s) > size: out.append(cur); cur = s
        else: cur = (cur + " " + s).strip()
    if cur: out.append(cur)
    return out

def write_pack_v1(out, pid, rows, manifest, shard=4000):
    os.makedirs(out, exist_ok=True); shards = []
    for i in range(0, len(rows), shard):
        name = f"{pid}-{i // shard:03d}.jsonl.gz"
        data = ("\n".join(json.dumps(r, ensure_ascii=False) for r in rows[i:i + shard]) + "\n").encode("utf-8")
        with gzip.open(os.path.join(out, name), "wb", compresslevel=9) as g: g.write(data)
        shards.append({"name": name, "bytes": os.path.getsize(os.path.join(out, name)), "raw": len(data), "count": len(rows[i:i + shard])})
    manifest.update({"id": pid, "version": 1, "built": time.strftime("%Y-%m-%d"), "count": len(rows), "bytes": sum(s["raw"] for s in shards), "shards": shards})
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{manifest['name']}: {len(rows)} passages, {manifest['bytes'] / 1e6:.1f} MB text, {sum(s['bytes'] for s in shards) / 1e6:.1f} MB to download, {len(shards)} shards")

# ---- World facts (CIA World Factbook) ---------------------------------------------------------------------------------------------
FB = "https://raw.githubusercontent.com/factbook/factbook.json/master/"
def flat(v, depth=0):
    """A Factbook value → text: {"text": …} leaves, nested labels kept ("total: 112,870,457 (2025 est.)")."""
    if isinstance(v, dict):
        if "text" in v and isinstance(v["text"], str): return re.sub(r"<[^>]+>", " ", v["text"]).strip()
        parts = []
        for k, x in v.items():
            if k in ("note",) and depth == 0: continue
            t = flat(x, depth + 1)
            if t: parts.append(f"{k}: {t}")
        return "; ".join(parts)
    if isinstance(v, list): return "; ".join(flat(x, depth + 1) for x in v)
    return str(v) if v is not None else ""

def country_rows(region, code, js, size=600):
    name = flat(js.get("Government", {}).get("Country name", {}).get("conventional short form", {})) or code.upper()
    if name.lower() == "none": name = flat(js.get("Government", {}).get("Country name", {}).get("conventional long form", {})) or code.upper()
    link = f"https://github.com/factbook/factbook.json/blob/master/{region}/{code}.json"
    rows = []
    for sec, body in js.items():
        if not isinstance(body, dict): continue
        for sub, v in body.items():
            t = re.sub(r"\s+", " ", flat(v)).strip()
            if not t or len(t) < 3: continue
            head = f"{name} — {sec} — {sub}: "
            # long entries (Introduction, Economy overview) are cut at sentences, every piece keeps the heading
            pieces, cur = [], ""
            for s in re.split(r"(?<=[.;])\s+", t):
                if cur and len(cur) + len(s) > size: pieces.append(cur); cur = s
                else: cur = (cur + " " + s).strip()
            if cur: pieces.append(cur)
            for p in pieces: rows.append({"t": f"{name} — {sub}", "x": head + p, "u": link, "l": "en"})
    return name, rows

def build_world(a):
    tree = json.load(open(a.tree)) if a.tree else json.loads(get("https://api.github.com/repos/factbook/factbook.json/git/trees/master?recursive=1"))
    files = [x["path"] for x in tree["tree"] if re.match(r"^[a-z-]+/[a-z]{2}\.json$", x["path"]) and not x["path"].startswith("meta/")]
    files.sort(key=lambda p: (p != "africa/eg.json", p))            # Egypt first
    if a.max_countries: files = files[: a.max_countries]
    rows, names = [], []
    for p in files:
        region, code = p[:-5].split("/")
        try: name, r = country_rows(region, code, json.loads(get(FB + p)))
        except Exception as e: print("skip", p, e, file=sys.stderr); continue
        rows += r; names.append(name)
    write_pack(a.out, "world", rows, {
        "name": "World facts", "name_ar": "حقائق عن دول العالم",
        "license": "Public domain",
        "attribution": "CIA World Factbook (a US government work, public domain), via github.com/factbook/factbook.json, retrieved " + time.strftime("%Y-%m-%d") + ". Cut into short passages; the country name is added to each.",
        "sources": [{"title": "CIA World Factbook", "url": "https://www.cia.gov/the-world-factbook/", "license": "Public domain"},
                    {"title": "factbook/factbook.json", "url": "https://github.com/factbook/factbook.json", "license": "Public domain"}],
        "retrieved": time.strftime("%Y-%m-%d"), "countries": len(names),
    })

# ---- Egyptian laws (Arabic) ---------------------------------------------------------------------------------------------------------
LAW_DS = "dataflare/egypt-legal-corpus"
SKIP_CAT = re.compile(r"النقض|المحكمة الادارية|موسوعات")
SKIP_NAME = re.compile(r"السعودي|السعودية|المملكة|الكويت|الإمارات|الامارات|قطر|البحرين|عمان|الأردن|الاردن|لبنان|سوريا|العراق|ليبيا|تونس|الجزائر|المغرب|اتفاقية|العهد الدولى|العهد الدولي|أخلاقيات|السلطة التأديبية"
    # every constitution in the corpus is the repealed 1971 text (no 2014 constitution) — none is kept; nor declarations, drafts, charters
    r"|دستور|الاعلان|الإعلان|إعلان|المشروع|ميثاق|بروتوكول|النظام الأساسي|مبادئ|الطوارئ")
# the most-used laws first (by name), then the rest of the codes in corpus order
PRIORITY = ["القانون المدني", "المدنى", "المرافعات", "العقوبات", "الإجراءات الجنائية", "الاجراءات الجنائية", "العمل",
            "التجارة", "الشركات", "الضريبة على القيمة المضافة", "القيمة المضافة", "ضريبة المبيعات", "الضريبة على الدخل", "المرور", "حماية المستهلك",
            "الإيجار", "الايجار", "الإيجارات", "الشهر العقاري", "التسجيل", "الأحوال الشخصية", "الاحوال الشخصية", "الطفل", "الاستثمار", "الجمارك"]
ARTICLE = re.compile(r"(?=(?:^|\s)(?:ال)?ماد[ةه]\s*(?:رقم\s*)?\(?\s*[0-9٠-٩]+)")

def law_rank(name, cats):
    for i, k in enumerate(PRIORITY):
        if k in name or any(k in c for c in cats): return i
    return len(PRIORITY)

def law_rows(name, text, size=600):
    title0 = re.sub(r"[_]+", " ", name).strip()
    t = re.sub(r"\s+", " ", text).strip()
    rows = []
    for part in ARTICLE.split(t):
        part = part.strip()
        if len(part) < 20: continue
        m = re.match(r"(?:ال)?ماد[ةه]\s*(?:رقم\s*)?\(?\s*([0-9٠-٩]+)", part)
        title = f"{title0} — مادة {m.group(1)}" if m else title0
        cur = ""
        for s in re.split(r"(?<=[.:؛])\s+", part):
            if cur and len(cur) + len(s) > size: rows.append((title, cur)); cur = s
            else: cur = (cur + " " + s).strip()
        if cur: rows.append((title, cur))
    return [{"t": ti, "x": (ti + ": " + x) if not x.startswith(ti) else x, "u": f"https://huggingface.co/datasets/{LAW_DS}", "l": "ar"} for ti, x in rows]

def build_laws(a):
    import pyarrow.parquet as pq
    path = a.parquet
    if not path:
        files = json.loads(get(f"https://huggingface.co/api/datasets/{LAW_DS}/tree/main/data"))
        path = os.path.join(tempfile.mkdtemp(), "laws.parquet")
        with open(path, "wb") as f:
            for x in files:
                if x["path"].endswith(".parquet"): f.write(get(f"https://huggingface.co/datasets/{LAW_DS}/resolve/main/{x['path']}", 600)); break
    t = pq.read_table(path, columns=["text", "categories", "law_name"]).to_pydict()
    docs = []
    for text, cats, name in zip(t["text"], t["categories"], t["law_name"]):
        cats = cats or []
        if not text or any(SKIP_CAT.search(c) for c in cats) or SKIP_NAME.search(name or "") or SKIP_NAME.search(" ".join(cats)): continue
        docs.append((law_rank(name or "", cats), name or "", text))
    docs.sort(key=lambda d: d[0])
    budget, used, rows, laws, seen = int(a.budget_mb * 1e6), 0, [], [], set()
    for rank, name, text in docs:
        if name in seen: continue
        seen.add(name); r = law_rows(name, text)
        b = sum(len(x["x"].encode()) + len(x["t"].encode()) for x in r)
        if used + b > budget: continue
        rows += r; used += b; laws.append(re.sub(r"_+", " ", name))
    write_pack(a.out, "egy-laws", rows, {
        "name": "Egyptian laws (Arabic)", "name_ar": "القوانين المصرية",
        "license": "MIT (as declared by the dataset publisher)",
        "attribution": f"Egyptian Legal Corpus by Dataflare (huggingface.co/datasets/{LAW_DS}, MIT as declared). Laws and codes only, cut at each article.",
        "notice": "Not legal advice; may be out of date; check the official gazette.",
        "notice_ar": "ليست استشارة قانونية؛ قد تكون قديمة؛ راجع الجريدة الرسمية.",
        "caveat": "The corpus holds older texts (for example the repealed 1971 constitution, which this pack leaves out); laws may since have been amended or replaced.",
        "sources": [{"title": "Egyptian Legal Corpus (Dataflare)", "url": f"https://huggingface.co/datasets/{LAW_DS}", "license": "MIT (declared)"}],
        "retrieved": time.strftime("%Y-%m-%d"), "laws": len(laws), "law_names": laws[:400],
    })

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("pack", choices=["world", "laws", "science", "health", "numbers", "cities", "cranes", "quran", "fiqh", "hadith", "cars", "math", "physics", "chemistry", "biology", "history", "geography", "coding"]); ap.add_argument("out")
    ap.add_argument("--max-countries", type=int, default=0)
    ap.add_argument("--allow-nc", action="store_true", help="subject packs: also take non-commercial (CC BY-NC-SA) books")
    ap.add_argument("--budget-mb", type=float, default=15)
    ap.add_argument("--parquet", default="")
    ap.add_argument("--tree", default="", help="world: the repository's file list (JSON from the GitHub trees API) instead of asking for it")
    a = ap.parse_args()
    from know_sources import BUILDERS
    {"world": build_world, "laws": build_laws, **BUILDERS}[a.pack](a)
