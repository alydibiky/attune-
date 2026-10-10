"""v6.16 — the general-knowledge Knowledge packs (Ali: "find reliable sources and make the app better in general knowledge").
Every source is reliable (a university press, a national library of medicine, the World Bank, a government rulebook, the
standard verified Quran text) and openly licensed; still no Wikipedia (Ali's rule, v5.22). Used by tools/build_know_pack.py.
Each builder returns nothing: it writes out/<id>.sqlite.gz + out/manifest.json through build_know_pack.write_pack.
Parsers are tested on small samples in tests/e2e_v724knowbuild.py.
"""
import html as htmlmod
import csv, glob, io, json, os, re, subprocess, sys, tempfile, time, zipfile
import xml.etree.ElementTree as ET

def _bk():
    import build_know_pack as B
    return B

def strip_ns(root):
    for el in root.iter():
        if isinstance(el.tag, str) and "}" in el.tag: el.tag = el.tag.split("}", 1)[1]
    return root

def text_of(el, skip=("math", "exercise", "solution", "media", "figure", "image", "problem")):
    """All the text inside an element, without formulas, exercises and pictures."""
    if el.tag in skip: return ""
    parts = [el.text or ""]
    for c in el:
        parts.append(text_of(c, skip))
        parts.append(c.tail or "")
    return "".join(parts)

# ---- science: OpenStax textbooks ---------------------------------------------------------------------------------------------------
# the most general books first; any other CC BY OpenStax book follows while the budget lasts
OPENSTAX_FIRST = ["biology-2e", "chemistry-2e", "college-physics-2e", "anatomy-and-physiology-2e", "psychology-2e", "principles-economics-3e",
                  "introduction-sociology-3e", "world-history-volume-1", "world-history-volume-2", "us-history", "introduction-business",
                  "principles-management", "astronomy-2e", "microbiology", "concepts-biology", "introduction-philosophy", "principles-marketing",
                  "entrepreneurship", "introductory-statistics-2e", "organizational-behavior", "business-ethics", "college-algebra-2e",
                  "principles-financial-accounting", "american-government-3e", "physics", "chemistry-atoms-first-2e"]

TEXT_TAGS = ("para", "item", "meaning")
SKIP_TAGS = ("exercise", "solution", "problem", "media", "figure", "math", "image")

# ---- formulas as plain text (MathML → "x^2 + 1", "(a)/(b)", "√(x)") so the subject packs keep every equation -------------------------
MO = {"\u2212": "-", "\u2061": "", "\u2062": "", "\u2063": ",", "\u00a0": " "}
def mathml_text(el):
    t = el.tag
    kids = [c for c in el if c.tag not in ("annotation", "annotation-xml")]
    if t in ("mi", "mn", "mtext", "ms"): return (el.text or "").strip()
    if t == "mo":
        o = (el.text or "").strip(); return MO.get(o, o)
    if t == "mspace": return " "
    g = lambda c: mathml_text(c)
    def grp(x):
        x = x.strip()
        return x if re.fullmatch(r"[\w.]+|\(.*\)", x) and (len(x) <= 1 or not re.search(r"[+\-*/=<> ]", x) or (x.startswith("(") and x.endswith(")"))) else f"({x})"
    if t == "semantics": return g(kids[0]) if kids else ""
    if t == "msup" and len(kids) >= 2: return grp(g(kids[0])) + "^" + grp(g(kids[1]))
    if t == "msub" and len(kids) >= 2: return g(kids[0]) + "_" + grp(g(kids[1]))
    if t == "msubsup" and len(kids) >= 3: return g(kids[0]) + "_" + grp(g(kids[1])) + "^" + grp(g(kids[2]))
    if t == "mfrac" and len(kids) >= 2: return grp(g(kids[0])) + "/" + grp(g(kids[1]))
    if t == "msqrt": return "√" + grp(" ".join(g(c) for c in kids))
    if t == "mroot" and len(kids) >= 2: return grp(g(kids[0])) + "^(1/" + g(kids[1]) + ")"
    if t in ("munder", "mover", "munderover") and kids:
        base = g(kids[0]); low = g(kids[1]) if len(kids) > 1 else ""; high = g(kids[2]) if len(kids) > 2 else ""
        if t == "mover": return base + (low if low in ("\u00af", "\u2192", "^", "\u02d9") else "^" + grp(low))
        return base + ("_" + grp(low) if low else "") + ("^" + grp(high) if high else "")
    if t == "mfenced":
        return el.get("open", "(") + el.get("separators", ",")[:1].join(g(c) for c in kids) + el.get("close", ")")
    if t == "mtable": return "; ".join(g(r) for r in kids)
    if t in ("mtr", "mlabeledtr"): return "  ".join(g(c) for c in kids)
    out = ""
    for c in kids:
        x = g(c)
        if not x: continue
        out += ("" if not out or out.endswith(("(", "[", "{", "^", "_")) or x.startswith((")", "]", "}", ",", ".", "!", "'")) else " ") + x
    return out.strip()

def text_keep(el, in_example=False):
    """Text of an element keeping formulas (as plain text) and the worked examples; end-of-chapter exercises are left out."""
    if el.tag == "math": return " " + mathml_text(el) + " "
    if el.tag in ("media", "figure", "image"): return ""
    if el.tag in ("exercise", "problem", "solution") and not in_example: return ""
    ex = in_example or el.tag == "example"
    parts = [el.text or ""]
    for c in el:
        parts.append(text_keep(c, ex)); parts.append(c.tail or "")
    return "".join(parts)

def openstax_lang(collection_path):
    """The book's language from its collection file ("en", "es", "pl"…)."""
    try: return (strip_ns(ET.parse(collection_path).getroot()).findtext(".//metadata/language") or "en").strip().lower()[:2]
    except Exception: return "en"

def openstax_book(repo_dir, collection_path, keep_math=False):
    """One OpenStax book (a collection file) → (title, license url, [(chapter title, module title, text)]).
    keep_math (the subject packs): formulas written as plain text, equations and worked examples kept."""
    col = strip_ns(ET.parse(collection_path).getroot())
    title = (col.findtext(".//metadata/title") or col.findtext(".//title") or "").strip()
    lic = ""
    for el in col.iter("license"):
        lic = el.get("url") or el.text or ""
        if lic: break
    out = []
    def walk(node, chapter):
        for c in node:
            if c.tag == "subcollection":
                walk(c.find("content") if c.find("content") is not None else c, (c.findtext("title") or chapter or "").strip())
            elif c.tag == "module":
                mid = c.get("document")
                p = os.path.join(repo_dir, "modules", mid, "index.cnxml")
                if not os.path.exists(p): continue
                doc = strip_ns(ET.parse(p).getroot())
                mt = (doc.findtext("title") or "").strip()
                body = doc.find("content")
                if body is None: continue
                paras = []
                def blocks(el):
                    # skip exercises, solutions, pictures and formulas entirely; read the innermost text blocks once
                    if el.tag in SKIP_TAGS: return
                    if el.tag in TEXT_TAGS and not any(c.tag in TEXT_TAGS for c in el.iter() if c is not el):
                        t = re.sub(r"\s+", " ", text_of(el)).strip()
                        if len(t) > 25: paras.append(t)
                        return
                    for c in el: blocks(c)
                KEEP_TAGS = ("para", "item", "meaning", "equation", "title")
                def blocks_keep(el, ex=False):
                    # the subject packs: every text block with its formulas, worked examples ("Example 3.2 … Solution …") included
                    if el.tag in ("media", "figure", "image", "glossary"): return
                    if el.tag in ("exercise", "problem", "solution") and not ex: return
                    ex2 = ex or el.tag == "example"
                    if el.tag in KEEP_TAGS and not any(c.tag in KEEP_TAGS for c in el.iter() if c is not el):
                        t = re.sub(r"\s+", " ", text_keep(el, ex2)).strip()
                        if len(t) > (3 if el.tag == "equation" else 25): paras.append(("Example: " if el.tag == "title" and ex2 else "") + t)
                        return
                    for c in el: blocks_keep(c, ex2)
                (blocks_keep if keep_math else blocks)(body)
                out.append((chapter, mt, " ".join(dict.fromkeys(paras))))
            elif c.tag == "content":
                walk(c, chapter)
    walk(col.find("content") if col.find("content") is not None else col, "")
    return title, lic, out

def build_science(a):
    B = _bk()
    budget, used, rows, books = int(a.budget_mb * 1e6), 0, [], []
    repos = []
    for page in range(1, 6):
        js = json.loads(B.get(f"https://api.github.com/orgs/openstax/repos?per_page=100&page={page}"))
        if not js: break
        repos += [r["name"] for r in js if r["name"].startswith("osbooks-") and not r.get("archived")]
    work = tempfile.mkdtemp()
    cols = []                                      # (priority, slug, repo dir, collection file)
    for repo in sorted(set(repos)):
        d = os.path.join(work, repo)
        try:
            subprocess.run(["git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--sparse", f"https://github.com/openstax/{repo}.git", d], check=True, timeout=600)
            subprocess.run(["git", "-C", d, "sparse-checkout", "set", "--no-cone", "/collections/*", "/modules/*/index.cnxml", "/META-INF/*"], check=True, timeout=1200)
        except Exception as e:
            print("skip", repo, e, file=sys.stderr); continue
        cdir = os.path.join(d, "collections")
        for fn in sorted(os.listdir(cdir)) if os.path.isdir(cdir) else []:
            if not fn.endswith(".collection.xml"): continue
            slug = fn.replace(".collection.xml", "")
            pri = OPENSTAX_FIRST.index(slug) if slug in OPENSTAX_FIRST else len(OPENSTAX_FIRST)
            cols.append((pri, slug, d, os.path.join(cdir, fn)))
    cols.sort()
    in_subjects = {x for _, _, l in SUBJECTS.values() for x in l}   # math, physics, chemistry, biology and history have their own packs
    for pri, slug, d, path in cols:
        if slug in in_subjects or openstax_lang(path) != "en": continue   # translations (Polish, Spanish…) left out
        try: title, lic, mods = openstax_book(d, path)
        except Exception as e: print("skip", slug, e, file=sys.stderr); continue
        if "/by/" not in lic or "-nc" in lic or "-nd" in lic:       # only books anyone may reuse (CC BY), so the app may be sold
            print("license", slug, lic, file=sys.stderr); continue
        url = f"https://openstax.org/details/books/{slug}"
        r = []
        for chap, mt, text in mods:
            head = f"{title} — {mt}" if mt else title
            for p in B.chunk(text):
                r.append({"t": head, "x": p, "u": url, "l": "en"})
        b = sum(len(x["x"].encode()) for x in r)
        if not r or used + b > budget: continue
        rows += r; used += b; books.append({"title": title, "url": url, "license": "CC BY 4.0"})
        print("book", title, len(r), file=sys.stderr)
    B.write_pack(a.out, "science", rows, {
        "name": "Society, economics & business (OpenStax textbooks)", "name_ar": "المجتمع والاقتصاد والأعمال (كتب أوبن ستاكس)",
        "license": "CC BY 4.0",
        "attribution": "OpenStax (Rice University), openstax.org — peer-reviewed open textbooks, CC BY 4.0. Text only, cut into passages; exercises and formulas left out.",
        "sources": books, "retrieved": time.strftime("%Y-%m-%d"), "books": len(books)})

# ---- health: MedlinePlus ----------------------------------------------------------------------------------------------------------------
def medline_rows(xml_bytes):
    root = ET.fromstring(xml_bytes)
    rows = []
    for t in root.iter("health-topic"):
        if t.get("language") != "English": continue
        title, url = t.get("title", ""), t.get("url", "")
        also = [a.text for a in t.findall("also-called") if a.text]
        summ = re.sub(r"<[^>]+>", " ", t.findtext("full-summary") or "")
        summ = re.sub(r"&nbsp;|&#160;", " ", summ)
        text = (f"{title}" + (f" (also called {', '.join(also)})" if also else "") + ". " + summ)
        for p in _bk().chunk(text):
            rows.append({"t": "Health — " + title, "x": p, "u": url, "l": "en"})
    return rows

def build_health(a):
    B = _bk()
    page = B.get("https://medlineplus.gov/xml.html").decode("utf-8", "ignore")
    names = sorted(set(re.findall(r"mplus_topics_\d{4}-\d{2}-\d{2}\.xml", page)))
    if not names: raise SystemExit("MedlinePlus: no health-topics file found")
    rows = medline_rows(B.get("https://medlineplus.gov/xml/" + names[-1], 600))
    B.write_pack(a.out, "health", rows, {
        "name": "Health (MedlinePlus)", "name_ar": "الصحة (ميدلاين بلس)",
        "license": "Public domain (US National Library of Medicine)",
        "attribution": "MedlinePlus health topics, US National Library of Medicine (NIH), " + names[-1] + ". Reviewed health information for patients.",
        "notice": "General health information, not medical advice — see a doctor for your own case.",
        "notice_ar": "معلومات صحية عامة وليست نصيحة طبية — راجع طبيبًا في حالتك.",
        "sources": [{"title": "MedlinePlus", "url": "https://medlineplus.gov/", "license": "Public domain"}], "retrieved": time.strftime("%Y-%m-%d")})

# ---- numbers: World Bank key figures ------------------------------------------------------------------------------------------------
WB = [("SP.POP.TOTL", "population", "n"), ("NY.GDP.MKTP.CD", "GDP", "usd"), ("NY.GDP.PCAP.CD", "GDP per person", "usd"),
      ("NY.GDP.MKTP.KD.ZG", "GDP growth", "pct"), ("FP.CPI.TOTL.ZG", "inflation (consumer prices)", "pct"),
      ("SL.UEM.TOTL.ZS", "unemployment", "pct"), ("SP.DYN.LE00.IN", "life expectancy at birth", "years"),
      ("SE.ADT.LITR.ZS", "adult literacy", "pct"), ("IT.NET.USER.ZS", "people using the internet", "pct"),
      ("EG.ELC.ACCS.ZS", "access to electricity", "pct"), ("SP.URB.TOTL.IN.ZS", "urban population", "pct"),
      ("SP.DYN.TFRT.IN", "births per woman", "x"), ("SP.POP.GROW", "population growth", "pct"),
      ("NE.EXP.GNFS.CD", "exports of goods and services", "usd"), ("NE.IMP.GNFS.CD", "imports of goods and services", "usd"),
      ("BX.TRF.PWKR.CD.DT", "remittances received", "usd"), ("GC.DOD.TOTL.GD.ZS", "central government debt (share of GDP)", "pct"),
      ("AG.SRF.TOTL.K2", "area", "km2"), ("EN.POP.DNST", "people per km²", "x")]

def fmt_value(v, kind):
    if v is None: return None
    if kind == "usd":
        for d, w in ((1e12, "trillion"), (1e9, "billion"), (1e6, "million")):
            if abs(v) >= d: return f"US$ {v / d:,.2f} {w}"
        return f"US$ {v:,.0f}"
    if kind == "n":
        return f"{v / 1e6:,.2f} million" if v >= 1e6 else f"{v:,.0f}"
    if kind == "pct": return f"{v:,.1f}%"
    if kind == "years": return f"{v:,.1f} years"
    if kind == "km2": return f"{v:,.0f} km²"
    return f"{v:,.2f}"

def numbers_rows(countries, values):
    """countries: {iso3: name}; values: {(iso3, indicator): (value, year)} → one passage per country."""
    rows = []
    for iso, name in sorted(countries.items(), key=lambda kv: (kv[1] != "Egypt, Arab Rep.", kv[1])):
        parts = []
        for code, label, kind in WB:
            vy = values.get((iso, code))
            if vy and vy[0] is not None: parts.append(f"{label}: {fmt_value(vy[0], kind)} ({vy[1]})")
        if not parts: continue
        nice = re.sub(r",\s*(Arab Rep\.|Islamic Rep\.|Rep\.|The)$", "", name)
        rows.append({"t": f"{nice} — key figures (World Bank)", "x": f"{nice} ({name}) — latest figures from the World Bank: " + "; ".join(parts) + ".",
                     "u": f"https://data.worldbank.org/country/{iso}", "l": "en"})
    return rows

def build_numbers(a):
    B = _bk()
    meta = json.loads(B.get("https://api.worldbank.org/v2/country?format=json&per_page=400"))[1]
    countries = {c["id"]: c["name"] for c in meta if (c.get("region") or {}).get("value") != "Aggregates"}
    values = {}
    for code, label, kind in WB:
        js = json.loads(B.get(f"https://api.worldbank.org/v2/country/all/indicator/{code}?format=json&mrnev=1&per_page=20000", 300))
        for r in (js[1] if len(js) > 1 and js[1] else []):
            iso = r.get("countryiso3code") or ""
            if iso in countries and r.get("value") is not None: values[(iso, code)] = (r["value"], r.get("date"))
    rows = numbers_rows(countries, values)
    B.write_pack(a.out, "numbers", rows, {
        "name": "Country numbers (World Bank)", "name_ar": "أرقام الدول (البنك الدولي)",
        "license": "CC BY 4.0", "attribution": "World Bank Open Data (data.worldbank.org), CC BY 4.0 — the most recent year with a value for each figure, retrieved " + time.strftime("%Y-%m-%d") + ".",
        "sources": [{"title": "World Bank Open Data", "url": "https://data.worldbank.org/", "license": "CC BY 4.0"}], "retrieved": time.strftime("%Y-%m-%d")})

# ---- cities: GeoNames --------------------------------------------------------------------------------------------------------------
AR = re.compile(r"[؀-ۿ]")

def cities_rows(cities_tsv, country_tsv, admin1_tsv):
    countries, rows = {}, []
    for line in country_tsv.splitlines():
        if not line or line.startswith("#"): continue
        f = line.split("\t")
        if len(f) < 17: continue
        iso, name, capital, area, pop, cont, curr, currname, phone, langs, neigh = f[0], f[4], f[5], f[6], f[7], f[8], f[10], f[11], f[12], f[15], f[17] if len(f) > 17 else ""
        countries[iso] = name
        rows.append({"t": f"{name} — country facts (GeoNames)", "x": f"{name}: capital {capital}; area {float(area or 0):,.0f} km²; population {int(pop or 0):,}; continent {cont}; currency {currname} ({curr}); calling code +{phone.lstrip('+')}; languages {langs}" + (f"; neighbours {neigh}" if neigh else "") + ".",
                     "u": "https://www.geonames.org/countries/" + iso + "/", "l": "en"})
    admin = {}
    for line in admin1_tsv.splitlines():
        f = line.split("\t")
        if len(f) >= 2: admin[f[0]] = f[1]
    for line in cities_tsv.splitlines():
        f = line.split("\t")
        if len(f) < 19: continue
        gid, name, alts, lat, lon, cc, a1, pop, tz = f[0], f[1], f[3], f[4], f[5], f[8], f[10], f[14], f[17]
        ar = next((x for x in alts.split(",") if AR.search(x)), "")
        region = admin.get(f"{cc}.{a1}", "")
        country = countries.get(cc, cc)
        rows.append({"t": f"{name}{' (' + ar + ')' if ar else ''} — {country}",
                     "x": f"{name}{' (' + ar + ')' if ar else ''} is a city in {country}{', ' + region if region else ''}. Population {int(pop or 0):,}. Coordinates {float(lat):.3f}, {float(lon):.3f}. Time zone {tz}.",
                     "u": "https://www.geonames.org/" + gid, "l": "en"})
    return rows

def build_cities(a):
    B = _bk()
    z = zipfile.ZipFile(io.BytesIO(B.get("https://download.geonames.org/export/dump/cities15000.zip", 600)))
    cities = z.read("cities15000.txt").decode("utf-8")
    rows = cities_rows(cities, B.get("https://download.geonames.org/export/dump/countryInfo.txt").decode("utf-8"),
                       B.get("https://download.geonames.org/export/dump/admin1CodesASCII.txt").decode("utf-8"))
    B.write_pack(a.out, "cities", rows, {
        "name": "Countries & cities (GeoNames)", "name_ar": "الدول والمدن (جيونيمز)",
        "license": "CC BY 4.0", "attribution": "GeoNames (geonames.org), CC BY 4.0 — every city over 15,000 people, with Arabic names where known.",
        "sources": [{"title": "GeoNames", "url": "https://www.geonames.org/", "license": "CC BY 4.0"}], "retrieved": time.strftime("%Y-%m-%d")})

# ---- cranes: OSHA rules (eCFR) ------------------------------------------------------------------------------------------------------
ECFR_PARTS = [("1926", "subpart=CC"), ("1926", "section=1926.251"), ("1910", "section=1910.179"), ("1910", "section=1910.180"),
              ("1910", "section=1910.184"), ("1926", "section=1926.550")]

def ecfr_rows(xml_bytes):
    root = ET.fromstring(xml_bytes)
    rows = []
    for div in root.iter("DIV8"):
        if div.get("TYPE") != "SECTION": continue
        n = div.get("N", ""); head = re.sub(r"\s+", " ", (div.findtext("HEAD") or "")).strip()
        body = " ".join(re.sub(r"\s+", " ", "".join(p.itertext())).strip() for p in div.iter() if p.tag in ("P", "FP"))
        if not body: continue
        for p in _bk().chunk(body, 700):
            rows.append({"t": "OSHA " + head, "x": f"{head}: {p}", "u": f"https://www.ecfr.gov/current/title-29/section-{n}", "l": "en"})
    return rows

# the sections kept: cranes and derricks in construction (1926.1400–1926.1442), rigging (1926.251), overhead and gantry
# cranes (1910.179), crawler / locomotive / truck cranes (1910.180), slings (1910.184)
CRANE_SECTIONS = re.compile(r"^(1926\.14(?:0\d|[1-3]\d|4[0-2])|1926\.251|1910\.179|1910\.180|1910\.184)$")

def govinfo_rows(xml_bytes):
    """The yearly CFR edition's XML (govinfo bulk data): <SECTION><SECTNO>§ n</SECTNO><SUBJECT>…</SUBJECT><P>…</P></SECTION>."""
    root = ET.fromstring(xml_bytes)
    rows = []
    for sec in root.iter("SECTION"):
        no = re.sub(r"[^\d.]", "", sec.findtext("SECTNO") or "")
        if not CRANE_SECTIONS.match(no): continue
        subj = re.sub(r"\s+", " ", sec.findtext("SUBJECT") or "").strip()
        body = " ".join(re.sub(r"\s+", " ", "".join(p.itertext())).strip() for p in sec.iter() if p.tag in ("P", "FP"))
        if not body: continue
        head = f"§ {no} {subj}"
        for p in _bk().chunk(body, 700):
            rows.append({"t": "OSHA " + head, "x": f"{head}: {p}", "u": f"https://www.ecfr.gov/current/title-29/section-{no}", "l": "en"})
    return rows

def build_cranes(a):
    B = _bk()
    rows, seen, used = [], set(), ""
    for year in range(int(time.strftime("%Y")), int(time.strftime("%Y")) - 3, -1):
        got = []
        for vol in range(1, 10):
            url = f"https://www.govinfo.gov/bulkdata/CFR/{year}/title-29/CFR-{year}-title29-vol{vol}.xml"
            try: xml = B.get(url, 300, accept="application/xml")
            except SystemExit: continue
            try: got += govinfo_rows(xml)
            except ET.ParseError as e: print("skip", url, e, file=sys.stderr)
        if got: rows, used = got, str(year); break
    rows = [r for r in rows if not (r["x"] in seen or seen.add(r["x"]))]
    B.write_pack(a.out, "cranes", rows, {
        "name": "Cranes & lifting rules (OSHA)", "name_ar": "قواعد الرافعات والرفع (أوشا)",
        "license": "Public domain (US government)",
        "attribution": f"US Code of Federal Regulations, Title 29 (OSHA), {used} edition from govinfo.gov — cranes and derricks in construction (1926.1400–1442), rigging (1926.251), overhead and gantry cranes (1910.179), crawler/locomotive/truck cranes (1910.180), slings (1910.184).",
        "notice": "US rules (OSHA) — for safety guidance; Egyptian law and the manufacturer's load chart come first.",
        "notice_ar": "قواعد أمريكية (أوشا) للإرشاد في السلامة؛ القانون المصري وجدول أحمال الشركة المصنّعة لهما الأولوية.",
        "sources": [{"title": "Code of Federal Regulations, Title 29 (govinfo.gov)", "url": "https://www.govinfo.gov/app/collection/cfr", "license": "Public domain"}], "retrieved": time.strftime("%Y-%m-%d")})

# ---- quran: Tanzil ---------------------------------------------------------------------------------------------------------------------
SURAS = [x.replace("_", " ") for x in """الفاتحة البقرة آل_عمران النساء المائدة الأنعام الأعراف الأنفال التوبة يونس هود يوسف الرعد إبراهيم الحجر النحل الإسراء الكهف مريم طه الأنبياء الحج المؤمنون النور الفرقان الشعراء النمل القصص العنكبوت الروم لقمان السجدة الأحزاب سبأ فاطر يس الصافات ص الزمر غافر فصلت الشورى الزخرف الدخان الجاثية الأحقاف محمد الفتح الحجرات ق الذاريات الطور النجم القمر الرحمن الواقعة الحديد المجادلة الحشر الممتحنة الصف الجمعة المنافقون التغابن الطلاق التحريم الملك القلم الحاقة المعارج نوح الجن المزمل المدثر القيامة الإنسان المرسلات النبأ النازعات عبس التكوير الانفطار المطففين الانشقاق البروج الطارق الأعلى الغاشية الفجر البلد الشمس الليل الضحى الشرح التين العلق القدر البينة الزلزلة العاديات القارعة التكاثر العصر الهمزة الفيل قريش الماعون الكوثر الكافرون النصر المسد الإخلاص الفلق الناس""".split()]   # the 114 surahs in order
assert len(SURAS) == 114

def quran_rows(txt):
    rows, header = [], []
    for line in txt.splitlines():
        if line.startswith("#"): header.append(line.lstrip("# ").strip()); continue
        f = line.split("|")
        if len(f) != 3: continue
        s, v, t = int(f[0]), int(f[1]), f[2].strip()
        name = SURAS[s - 1] if 0 < s <= len(SURAS) else str(s)
        rows.append({"t": f"سورة {name} — الآية {v} ({s}:{v})", "x": t, "u": f"https://tanzil.net/#{s}:{v}", "l": "ar"})
    return rows, header

# التفسير الميسر (King Fahd Complex), as published in Quran.com's library (QUL tafsir 38), one JSON file per surah:
# [{surah, ayah, text}]. A surah's first verse also carries the surah's introduction (تسمية السورة، مقاصد السورة) before
# "[التفسير]" — kept as its own passage. Every word is kept as published.
MUYASSAR = "https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/ar-tafsir-muyassar/{}.json"

def split_intro(t):
    """The surah introduction (تسمية السورة / من مقاصد السورة and their • points) from the tafsir that follows it."""
    if "[التفسير]" in t: return tuple(x.strip() for x in t.split("[التفسير]", 1))
    if not t.startswith("تسمية السورة"): return "", t
    paras = [p.strip() for p in re.split(r"\n\s*\n", t) if p.strip()]
    k = 0
    while k < len(paras) and (paras[k].startswith("•") or paras[k] in ("تسمية السورة", "من مقاصد السورة")): k += 1
    return "\n\n".join(paras[:k]), "\n\n".join(paras[k:])

def tafsir_rows(s, items, verses):
    """One surah's تفسير ميسر → passages: the surah's introduction once, then the tafsir with its verse(s). When the tafsir
    explains several verses together the source repeats it on each; those become one passage (الآيات ١–٦)."""
    rows, name, intro_done, groups = [], SURAS[s - 1], False, []
    for it in sorted(items, key=lambda i: int(i["ayah"])):
        v = int(it["ayah"])
        intro, t = split_intro((it.get("text") or "").strip())
        if intro and not intro_done:
            rows.append({"t": f"التفسير الميسر — مقدمة سورة {name}", "x": intro, "u": f"https://quran.com/{s}", "l": "ar"}); intro_done = True
        if not t: continue
        if groups and groups[-1][1] == t and groups[-1][0][-1] == v - 1: groups[-1][0].append(v)
        else: groups.append(([v], t))
    for vs, t in groups:
        a, b = vs[0], vs[-1]
        quote = " ".join(f"﴿{verses[(s, v)]}﴾ ({v})" for v in vs if verses.get((s, v)))
        label = f"الآية {a} ({s}:{a})" if a == b else f"الآيات {a}–{b} ({s}:{a}-{b})"
        rows.append({"t": f"التفسير الميسر — سورة {name}، {label}", "x": (quote + " " if quote else "") + t,
                     "u": f"https://quran.com/{s}:{a}/tafsirs/ar-tafsir-muyassar", "l": "ar", "_n": len(vs)})
    return rows

def build_quran(a):
    B = _bk()
    txt = B.get("https://tanzil.net/pub/download/index.php?quranType=simple&outType=txt-2&agree=true", 300).decode("utf-8")
    rows, header = quran_rows(txt)
    if len(rows) != 6236: raise SystemExit(f"Quran text: expected 6236 verses, got {len(rows)}")
    verses = {}
    for line in txt.splitlines():
        f = line.split("|")
        if len(f) == 3 and f[0].isdigit(): verses[(int(f[0]), int(f[1]))] = f[2].strip()
    tafsir = []
    for s in range(1, 115):
        tafsir += tafsir_rows(s, json.loads(B.get(MUYASSAR.format(s), 120).decode("utf-8")), verses)
    n = sum(r.pop("_n", 0) for r in tafsir)
    if n != 6236: raise SystemExit(f"Tafsir al-Muyassar: expected 6236 verses, got {n}")
    print(f"quran: {len(rows)} verses + {len(tafsir)} tafsir passages")
    B.write_pack(a.out, "quran", rows + tafsir, {
        "name": "The Quran + Tafsir al-Muyassar", "name_ar": "القرآن الكريم مع التفسير الميسر",
        "license": "Quran text: Tanzil Project, verbatim with credit. Tafsir: King Fahd Complex, free to share, with credit",
        "attribution": "Quran text from the Tanzil Project (tanzil.net), verbatim, one passage per verse. " + " ".join(h for h in header if h)[:600]
                       + " — التفسير الميسر: نخبة من العلماء، مجمع الملك فهد لطباعة المصحف الشريف، كما نشرته مكتبة Quran.com (QUL).",
        "sources": [{"title": "Tanzil Project", "url": "https://tanzil.net/", "license": "Verbatim copies with credit"},
                    {"title": "التفسير الميسر — مجمع الملك فهد (Quran.com QUL, tafsir 38)", "url": "https://qul.tarteel.ai/resources/tafsir/38", "license": "Free to share, with credit"}],
        "retrieved": time.strftime("%Y-%m-%d")})

# ---- fiqh: الفقه الميسر, the full books from turath.io (the Shamela library's texts) -----------------------------------------------
# files.turath.io/books/<id>.json → {meta: {name, …}, indexes: {headings: [{title, level, page}], …}, pages: [{text, vol, page}]}
FIQH_BOOKS = [   # (exact book title on turath, a word that must NOT be in it, author hint, credit)
    ("الفقه الميسر", "ضوء", "الطيار", "عبد الله الطيار، عبد الله المطلق، محمد الموسى (مدار الوطن، ١٣ جزءًا)"),
    ("الفقه الميسر في ضوء الكتاب والسنة", "", "", "نخبة من العلماء، مجمع الملك فهد لطباعة المصحف الشريف"),
]
TURATH_API = "https://api.turath.io/"

def turath_json(B, path, **q):
    from urllib.parse import urlencode
    try: return json.loads(B.get(TURATH_API + path + "?" + urlencode({**q, "ver": 3}), 120).decode("utf-8"))
    except BaseException as e: print(f"turath: {path} {q} failed ({e})"); return None

def turath_pick(hits, title, avoid, author):
    """Search hits → the book whose name is the title (not a longer book that only mentions it)."""
    for h in hits or []:
        m = h.get("meta"); m = json.loads(m) if isinstance(m, str) else (m or {})
        name, by = (m.get("book_name") or "").strip(), (m.get("author_name") or "")
        if name.startswith(title) and len(name) <= len(title) + 12 and not (avoid and avoid in name) and (not author or author in by):
            return h.get("book_id"), name
    return None, None

def turath_book(B, bid):
    """The whole book: the ready file if turath has one, else page by page through its API."""
    try: return json.loads(B.get(f"https://files.turath.io/books/{bid}.json", 300).decode("utf-8"))
    except BaseException as e: print(f"turath: no book file for {bid} ({e}); reading it page by page")
    info = turath_json(B, "book", id=bid, include="indexes") or {}
    idx = info.get("indexes") or {}
    n = len(idx.get("page_map") or [])
    if not n: return None
    pages = []
    for pg in range(1, n + 1):
        r = turath_json(B, "page", book_id=bid, pg=pg) or {}
        m = r.get("meta"); m = json.loads(m) if isinstance(m, str) else (m or {})
        pages.append({"text": r.get("text") or "", "vol": m.get("vol"), "page": m.get("page")})
        time.sleep(0.15)   # gently
    return {"meta": info.get("meta") or {}, "indexes": {"headings": idx.get("headings") or []}, "pages": pages}

def turath_text(html):
    """A turath page → plain text: tags out, entities decoded; every word kept (footnotes too)."""
    t = re.sub(r"<br\s*/?>|</p>", "\n", html or "")
    t = re.sub(r"<[^>]+>", "", t)
    return htmlmod.unescape(t).replace("\u200f", "").strip()

def fiqh_rows(book, title, by):
    """A turath book → passages titled with the book, the chapter path and the printed volume/page."""
    pages = book.get("pages") or []
    heads = sorted(((h.get("page") or 0, h.get("level") or 1, (h.get("title") or "").strip()) for h in (book.get("indexes") or {}).get("headings") or []), key=lambda h: h[0])
    rows, path, hi = [], {}, 0
    for i, pg in enumerate(pages, 1):
        while hi < len(heads) and heads[hi][0] <= i:
            _, lvl, t = heads[hi]; hi += 1
            path = {k: v for k, v in path.items() if k < lvl}; path[lvl] = t
        text = turath_text(pg.get("text"))
        if not text: continue
        where = " › ".join(path[k] for k in sorted(path))[-160:]
        ref = f"ج{pg.get('vol')} ص{pg.get('page')}" if pg.get("vol") else f"ص{pg.get('page', i)}"
        for j, piece in enumerate(_bk().chunk(text, 900)):
            rows.append({"t": f"{title} — {where} ({ref})" if where else f"{title} ({ref})", "x": piece, "u": f"https://app.turath.io/book/{book['_id']}?page={i}", "l": "ar"})
    return rows

def build_fiqh(a):
    B = _bk(); rows, used = [], []
    for title, avoid, author, credit in FIQH_BOOKS:
        bid = name = None
        for q in (title, title + " " + author if author else title):
            for page in (1, 2, 3):
                r = turath_json(B, "search", q=q, page=page)
                bid, name = turath_pick((r or {}).get("data"), title, avoid, author)
                if bid: break
            if bid: break
        if not bid: print(f"fiqh: «{title}» was not found on turath"); continue
        book = turath_book(B, bid)
        if not book or not book.get("pages"): print(f"fiqh: «{name}» ({bid}) could not be read"); continue
        book["_id"] = bid; r = fiqh_rows(book, title, credit)
        print(f"fiqh: {bid} «{name}»: {len(book['pages'])} pages → {len(r)} passages")
        rows += r; used.append({"title": f"{title} — {credit}", "url": f"https://app.turath.io/book/{bid}", "license": "Shared freely for learning, with credit"})
    B.write_pack(a.out, "fiqh", rows, {
        "name": "Islamic jurisprudence (al-Fiqh al-Muyassar)", "name_ar": "الفقه الميسر",
        "license": "The publishers' texts as shared by the Shamela library (turath.io), for learning, with credit",
        "attribution": "الفقه الميسر — النص كاملًا كما في المكتبة الشاملة (turath.io)، مع اسم الكتاب والباب والجزء والصفحة لكل فقرة.",
        "notice": "For learning; for a ruling on your own case, ask a qualified scholar or Dar al-Ifta.",
        "notice_ar": "للتعلّم؛ وفي مسألتك الخاصة اسأل عالمًا موثوقًا أو دار الإفتاء.",
        "sources": used, "retrieved": time.strftime("%Y-%m-%d")})

# ---- hadith: the main books with the scholars' rulings (fawazahmed0/hadith-api, public domain / Unlicense) -----------------------------
HADITH_API = "https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions/ara-{}.json"
HADITH_BOOKS = [("bukhari", "صحيح البخاري"), ("muslim", "صحيح مسلم"), ("abudawud", "سنن أبي داود"), ("tirmidhi", "جامع الترمذي"),
                ("nasai", "سنن النسائي"), ("ibnmajah", "سنن ابن ماجه"), ("malik", "موطأ مالك"), ("nawawi", "الأربعون النووية"),
                ("qudsi", "الأربعون القدسية"), ("dehlawi", "أربعون الشاه ولي الله الدهلوي")]
SCHOLARS = {"Al-Albani": "الألباني", "Zubair Ali Zai": "زبير علي زئي", "Shuaib Al Arnaut": "شعيب الأرناؤوط", "Abu Ghuddah": "عبد الفتاح أبو غدة",
            "Muhammad Muhyi Al-Din Abdul Hamid": "محمد محيي الدين عبد الحميد", "Muhammad Fouad Abd al-Baqi": "محمد فؤاد عبد الباقي",
            "Ahmad Muhammad Shakir": "أحمد شاكر", "Bashar Awad Maarouf": "بشار عواد معروف", "Salim al-Hilali": "سليم الهلالي"}
# longest first; what is not listed stays as written
GRADE_WORDS = [("Sahih - Bukhari And Muslim", "صحيح — رواه البخاري ومسلم"), ("Sahih - Agreed Upon", "صحيح — متفق عليه"), ("Agreed Upon", "متفق عليه"),
    ("Sahih Bukhari", "صحيح البخاري"), ("Sahih Muslim", "صحيح مسلم"), ("Bukhari And Muslim", "البخاري ومسلم"), ("Very Daif", "ضعيف جدًا"),
    ("Isnaad Sahih", "إسناده صحيح"), ("Isnaad Hasan", "إسناده حسن"), ("Sahih Isnaad", "صحيح الإسناد"), ("Daif Isnaad", "ضعيف الإسناد"),
    ("Hasan Isnaad", "حسن الإسناد"), ("Sanad Daif", "سنده ضعيف"), ("Sahih Hadith", "حديث صحيح"), ("Sahih Matn", "صحيح المتن"),
    ("Lighairihi", "لغيره"), ("Mutawatir", "متواتر"), ("Hasan", "حسن"), ("Sahih", "صحيح"), ("Daif", "ضعيف"), ("Mauquf", "موقوف"), ("Muquf", "موقوف"),
    ("Maqtu", "مقطوع"), ("Shadh", "شاذ"), ("Munkar", "منكر"), ("Mawdu", "موضوع"), ("Mursal", "مرسل"), ("Batil", "باطل"), ("Isnaad", "الإسناد")]

def grade_ar(g):
    """'Isnaad Sahih' → 'إسناده صحيح', 'Sahih Muslim (1480)' → 'صحيح مسلم (1480)'; an unknown wording stays as written."""
    g = (g or "").strip()
    if g in ("", "-"): return ""
    out = g
    for en, ar in GRADE_WORDS: out = re.sub(r"\b" + re.escape(en) + r"\b", ar, out)
    return out if not re.search(r"[A-Za-z]", out) else f"{out} ({g})"

def hadith_rows(key, title, data):
    """One book → a passage per hadith: the Arabic text exactly as published, then each scholar's ruling."""
    rows = []
    for h in data.get("hadiths") or []:
        t = (h.get("text") or "").strip()
        if not t: continue
        n = h.get("hadithnumber")
        rulings = [f"{SCHOLARS.get(g.get('name'), g.get('name'))}: {grade_ar(g.get('grade'))}" for g in h.get("grades") or [] if grade_ar(g.get("grade"))]
        if not rulings and key in ("bukhari", "muslim"): rulings = [f"صحيح — من {title}"]
        x = t + ("\nالحكم: " + "؛ ".join(rulings) if rulings else "")
        rows.append({"t": f"{title} — الحديث {n:g}" if isinstance(n, (int, float)) else f"{title} — الحديث {n}", "x": x,
                     "u": f"https://sunnah.com/{key if key != 'abudawud' else 'abudawud'}:{n:g}" if isinstance(n, (int, float)) else "", "l": "ar"})
    return rows

def build_hadith(a):
    B = _bk(); rows = []
    for key, title in HADITH_BOOKS:
        r = hadith_rows(key, title, json.loads(B.get(HADITH_API.format(key), 300).decode("utf-8")))
        print(f"hadith: {title}: {len(r)}"); rows += r
    if len(rows) < 30000: raise SystemExit(f"hadith: only {len(rows)} hadiths — something is missing")
    B.write_pack(a.out, "hadith", rows, {
        "name": "Hadith (the main books, with rulings)", "name_ar": "الحديث النبوي (الكتب الأساسية مع الأحكام)",
        "license": "Public domain (Unlicense) — fawazahmed0/hadith-api",
        "attribution": "نصوص صحيح البخاري ومسلم والسنن الأربع وموطأ مالك والأربعين، مع أحكام الألباني وزبير علي زئي وشعيب الأرناؤوط وأحمد شاكر وغيرهم كما وردت في hadith-api (ملكية عامة).",
        "notice": "Rulings are quoted from the scholars named; for a doubtful hadith, check Dorar (dorar.net).",
        "notice_ar": "الأحكام منقولة عن العلماء المذكورين؛ وللتحقق من حديث مشكوك فيه راجع الدرر السنية.",
        "sources": [{"title": "hadith-api (fawazahmed0)", "url": "https://github.com/fawazahmed0/hadith-api", "license": "Unlicense (public domain)"}],
        "retrieved": time.strftime("%Y-%m-%d")})

# ---- cars: specs of every car sold in the US (EPA, 2000–now) and in Europe (EEA, 2010–now, incl. the Chinese brands sold there) ----------------
EPA_CARS = "https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip"
CARS_FROM = 2000   # Ali: cars from 2000 to today (the EU's records start in 2010)
EEA_SQL = "https://discodata.eea.europa.eu/sql"
MAKES_AR = {"TOYOTA": "تويوتا", "LEXUS": "لكزس", "HONDA": "هوندا", "NISSAN": "نيسان", "MAZDA": "مازدا", "MITSUBISHI": "ميتسوبيشي", "SUZUKI": "سوزوكي",
    "SUBARU": "سوبارو", "HYUNDAI": "هيونداي", "KIA": "كيا", "GENESIS": "جينيسيس", "CHEVROLET": "شيفروليه", "FORD": "فورد", "JEEP": "جيب",
    "DODGE": "دودج", "CHRYSLER": "كرايسلر", "CADILLAC": "كاديلاك", "GMC": "جي إم سي", "TESLA": "تسلا", "BMW": "بي إم دبليو", "MERCEDES-BENZ": "مرسيدس",
    "MERCEDES": "مرسيدس", "AUDI": "أودي", "VOLKSWAGEN": "فولكس فاجن", "VW": "فولكس فاجن", "PORSCHE": "بورشه", "OPEL": "أوبل", "PEUGEOT": "بيجو",
    "CITROEN": "ستروين", "RENAULT": "رينو", "DACIA": "داسيا", "FIAT": "فيات", "ALFA ROMEO": "ألفا روميو", "SKODA": "سكودا", "SEAT": "سيات",
    "CUPRA": "كوبرا", "VOLVO": "فولفو", "LAND ROVER": "لاند روفر", "JAGUAR": "جاكوار", "MINI": "ميني", "FERRARI": "فيراري", "LAMBORGHINI": "لامبورغيني",
    "MASERATI": "مازيراتي", "BENTLEY": "بنتلي", "ROLLS-ROYCE": "رولز رويس", "BYD": "بي واي دي", "MG": "إم جي", "SAIC": "سايك", "CHERY": "شيري",
    "OMODA": "أومودا", "JAECOO": "جيكو", "GEELY": "جيلي", "ZEEKR": "زيكر", "LYNK & CO": "لينك آند كو", "POLESTAR": "بولستار", "NIO": "نيو",
    "XPENG": "إكس بنغ", "LEAPMOTOR": "ليب موتور", "GWM": "جريت وول", "GREAT WALL": "جريت وول", "ORA": "أورا", "HAVAL": "هافال", "WEY": "وي",
    "DONGFENG": "دونغ فنغ", "VOYAH": "فوياه", "HONGQI": "هونشي", "AIWAYS": "أيويز", "SERES": "سيريس", "DFSK": "دي إف إس كيه", "JAC": "جاك",
    "CHANGAN": "شانجان", "BAIC": "بايك", "GAC": "جي إيه سي", "SMART": "سمارت", "LOTUS": "لوتس", "SSANGYONG": "سانج يونج", "KGM": "كيه جي إم",
    "ISUZU": "إيسوزو", "RAM": "رام", "BUICK": "بيوك", "LINCOLN": "لينكون", "INFINITI": "إنفينيتي", "ACURA": "أكيورا", "RIVIAN": "ريفيان", "LUCID": "لوسيد",
    "DS": "دي إس", "ABARTH": "أبارث", "LANCIA": "لانشيا", "XEV": "إكس إي في", "BESTUNE": "بستيون", "JETOUR": "جيتور", "EXEED": "إكسيد", "TANK": "تانك",
    "SKYWELL": "سكاي ويل", "MAXUS": "ماكسوس", "FORTHING": "فورثينج", "KAIYI": "كايي", "SWM": "إس دبليو إم", "BAW": "باو"}
CHINESE = {"BYD", "MG", "SAIC", "CHERY", "OMODA", "JAECOO", "GEELY", "ZEEKR", "LYNK & CO", "POLESTAR", "NIO", "XPENG", "LEAPMOTOR", "GWM", "GREAT WALL",
    "ORA", "HAVAL", "WEY", "DONGFENG", "VOYAH", "HONGQI", "AIWAYS", "SERES", "DFSK", "JAC", "CHANGAN", "BAIC", "GAC", "MAXUS", "XEV", "BESTUNE", "JETOUR",
    "EXEED", "TANK", "SKYWELL", "FORTHING", "KAIYI", "SWM", "BAW", "SMART", "LOTUS"}

_MAKE_KEYS = sorted(MAKES_AR, key=len, reverse=True)
def make_key(mk):
    """'BYD AUTO' → 'BYD', 'MG. ROEWE' → 'MG', 'Mercedes-Benz' → 'MERCEDES-BENZ' (the longest known brand the name starts with)."""
    u = re.sub(r"\s+", " ", (mk or "").strip().upper())
    return next((k for k in _MAKE_KEYS if u == k or (u.startswith(k) and not u[len(k)].isalnum())), u)

def make_label(mk):
    m = (mk or "").strip(); u = make_key(m)
    ar = MAKES_AR.get(u, ""); cn = " — صيني" if u in CHINESE else ""
    return f"{m} ({ar}{cn})" if ar else m

def _f(x):
    try: v = float(x); return v if v == v else None
    except (TypeError, ValueError): return None

def epa_line(r):
    """One EPA vehicle row → a spec line (metric next to US units)."""
    g = lambda k: (r.get(k) or "").strip()
    bits = []
    displ, cyl = _f(g("displ")), _f(g("cylinders"))
    eng = ", ".join(x for x in [f"{displ:g} L" if displ else "", f"{cyl:g} cyl" if cyl else "", "turbo" if g("tCharger") in ("T", "True", "1") else "",
                                "supercharged" if g("sCharger") == "S" else "", g("eng_dscr")] if x)
    if eng: bits.append("engine " + eng)
    if g("evMotor"): bits.append("electric motor " + g("evMotor"))
    for k, lab in (("trany", "gearbox"), ("drive", "drive"), ("VClass", "class"), ("fuelType", "fuel"), ("atvType", "type")):
        if g(k): bits.append(f"{lab} {g(k)}")
    c, h, cb = _f(g("city08")), _f(g("highway08")), _f(g("comb08"))
    if cb:
        l100 = lambda mpg: f"{235.215 / mpg:.1f}" if mpg else "?"
        unit = "MPGe" if g("atvType") == "EV" else "mpg"
        bits.append(f"economy {c:g}/{h:g}/{cb:g} {unit} city/highway/combined" + ("" if unit == "MPGe" else f" ({l100(c)}/{l100(h)}/{l100(cb)} L/100 km)"))
    rng = _f(g("range")) or _f(g("rangeA"))
    if rng and rng > 0: bits.append(f"electric range {rng:g} mi ({rng * 1.609:.0f} km)")
    co2 = _f(g("co2TailpipeGpm"))
    if co2 and co2 > 0: bits.append(f"CO2 {co2 / 1.609:.0f} g/km")
    cost = _f(g("fuelCost08"))
    if cost: bits.append(f"US fuel cost about ${cost:,.0f} a year")
    return "; ".join(bits)

def epa_rows(csv_text):
    """vehicles.csv → one passage per (make, model, year) listing every version."""
    groups = {}
    for r in csv.DictReader(io.StringIO(csv_text)):
        mk, mo, yr = (r.get("make") or "").strip(), (r.get("model") or "").strip(), (r.get("year") or "").strip()
        if not (mk and mo and yr) or not yr.isdigit() or int(yr) < CARS_FROM: continue
        line = epa_line(r)
        if line: groups.setdefault((mk, mo, yr), []).append(line)
    rows = []
    for (mk, mo, yr), lines in sorted(groups.items()):
        lines = list(dict.fromkeys(lines))
        text = f"{mk} {mo} {yr} — US versions (EPA tests): " + " | ".join(f"({i + 1}) {l}" for i, l in enumerate(lines))
        for j, piece in enumerate(_bk().chunk(text, 1400)):
            rows.append({"t": f"{make_label(mk)} {mo} {yr} — specs (US, EPA)", "x": piece, "u": "https://www.fueleconomy.gov/feg/findacar.shtml", "l": "en"})
    return rows

FUEL = {"petrol": "petrol", "diesel": "diesel", "electric": "electric", "petrol/electric": "plug-in hybrid (petrol)", "diesel/electric": "plug-in hybrid (diesel)",
        "lpg": "LPG", "ng": "natural gas", "e85": "E85", "hydrogen": "hydrogen"}

def eea_rows(groups):
    """EEA groups [{Mk, Cn, Ft, Fm, ec, ep, m, ew, er, z, w, n, y0, y1}] → one passage per (make, model) with its versions."""
    models = {}
    for g in groups:
        mk = make_key(g.get("Mk")); cn = re.sub(r"\s+", " ", (g.get("Cn") or "").strip().upper())
        for pre in (mk + " ", re.sub(r"\s+", " ", (g.get("Mk") or "").strip().upper()) + " "):
            if cn.startswith(pre) and len(cn) > len(pre): cn = cn[len(pre):]
        if not mk or not cn or cn in ("?", "-"): continue
        bits = []
        ft = (g.get("Ft") or "").strip().lower(); bits.append(FUEL.get(ft, ft) + (" hybrid" if (g.get("Fm") or "") == "H" and "electric" not in ft else ""))
        ep, ec = _f(g.get("ep")), _f(g.get("ec"))
        if ep: bits.append(f"{ep:.0f} kW ({ep * 1.341:.0f} hp)")
        if ec: bits.append(f"{ec:.0f} cc")
        m, w = _f(g.get("m")), _f(g.get("w"))
        if m: bits.append(f"weight {m:.0f} kg")
        if w: bits.append(f"wheelbase {w:.0f} mm")
        ew, er, z = _f(g.get("ew")), _f(g.get("er")), _f(g.get("z"))
        if ew is not None and ew > 0: bits.append(f"CO2 {ew:.0f} g/km (WLTP)")
        if er: bits.append(f"electric range {er:.0f} km (WLTP)")
        if z: bits.append(f"uses {z / 10:.1f} kWh/100 km")
        y0, y1, n = g.get("y0"), g.get("y1"), _f(g.get("n")) or 0
        bits.append(f"registered {y0}" + (f"–{y1}" if y1 and y1 != y0 else "") + f" ({n:,.0f} cars)")
        models.setdefault((mk, cn), []).append((n, ", ".join(b for b in bits if b)))
    rows = []
    for (mk, cn), vs in sorted(models.items()):
        vs.sort(key=lambda v: -v[0])
        name = cn if cn.startswith(mk) else f"{mk} {cn}"
        text = f"{name} — versions sold in Europe (EU registrations): " + " | ".join(f"({i + 1}) {v}" for i, (_, v) in enumerate(vs[:40]))
        for piece in _bk().chunk(text, 1400):
            rows.append({"t": f"{make_label(mk)} {cn.title() if cn.isupper() else cn} — specs (Europe, EEA)", "x": piece, "u": "https://www.eea.europa.eu/en/datahub/datahubitem-view/fa8b1229-3db6-495d-b18e-9c9b3267c02b", "l": "en"})
    return rows

def eea_query(B, sql, page=1):
    from urllib.parse import urlencode
    raw = B.get(EEA_SQL + "?" + urlencode({"query": sql, "p": page, "nrOfHits": 10000}), 300).decode("utf-8")
    j = json.loads(raw)
    if "results" not in j: print("cars: EEA said", raw[:300])
    return j.get("results") or []

def eea_probe(sql):
    """One quick try, no retries (most tried table names don't exist): → rows or None."""
    import urllib.request
    from urllib.parse import urlencode
    try:
        with urllib.request.urlopen(urllib.request.Request(EEA_SQL + "?" + urlencode({"query": sql}), headers={"User-Agent": "attune-knowledge-builder"}), timeout=30) as r:
            return json.loads(r.read().decode("utf-8")).get("results") or None
    except Exception: return None

def eea_merge(parts):
    """Per-year groups → one row per version (make, model, fuel, mode, engine, power): averages weighted by cars, years spanned."""
    out = {}
    for g in parts:
        k = tuple((str(g.get(x) or "")).strip().upper() for x in ("Mk", "Cn", "Ft", "Fm")) + (_f(g.get("ec")), _f(g.get("ep")))
        n = _f(g.get("n")) or 0; y = int(_f(g.get("y")) or 0)
        o = out.setdefault(k, {"Mk": g.get("Mk"), "Cn": g.get("Cn"), "Ft": g.get("Ft"), "Fm": g.get("Fm"), "ec": g.get("ec"), "ep": g.get("ep"), "n": 0, "y0": y, "y1": y, "_s": {}})
        o["n"] += n; o["y0"] = min(o["y0"], y); o["y1"] = max(o["y1"], y)
        for f in ("m", "w", "ew", "z"):
            v = _f(g.get(f))
            if v is not None: s0 = o["_s"].setdefault(f, [0.0, 0.0]); s0[0] += v * max(n, 1); s0[1] += max(n, 1)
    for o in out.values():
        for f, (t, w) in o.pop("_s").items(): o[f] = t / w if w else None
    return list(out.values())

def build_cars(a):
    B = _bk(); rows = []
    try:
        z = zipfile.ZipFile(io.BytesIO(B.get(EPA_CARS, 300)))
        r = epa_rows(z.read(z.namelist()[0]).decode("utf-8", "replace")); print(f"cars: EPA {len(r)} passages"); rows += r
    except BaseException as e: print(f"cars: EPA failed ({e})")
    try:
        T = "[CO2Emission].[latest].[co2cars]"
        cols = list((eea_query(B, f"SELECT TOP 1 * FROM {T}") or [{}])[0].keys())
        col = lambda *names: next((f"[{c}]" for n in names for c in cols if c.lower() == n.lower()), "NULL")
        yr, st = col("Year"), col("Status")
        years = eea_query(B, f"SELECT {yr} AS y, {st} AS s, COUNT(*) AS c FROM {T} GROUP BY {yr}, {st}")
        print("cars: EEA years", sorted((r.get("y"), r.get("s"), r.get("c")) for r in years))
        have = {}
        for r in years:
            y = int(_f(r.get("y")) or 0)
            if y >= max(CARS_FROM, 2010) and (r.get("s") == "F" or y not in have): have[y] = (T, r.get("s"))
        # newer years are published as their own tables (co2cars_2024Fv29, co2cars_2025Pv31…); the list of tables can't be read, so the
        # likely names are tried, newest version first: the final table of a year, else its newest provisional one
        best = {}
        for y in range(max(have or [2022]) + 1, int(time.strftime("%Y")) + 1):
            for fp in ("F", "P"):
                for v in range(45, 0, -1):
                    tab = f"[CO2Emission].[latest].[co2cars_{y}{fp}v{v}]"
                    ok = eea_probe(f"SELECT TOP 1 {yr} AS y FROM {tab}")
                    if ok: best[y] = ((fp == "F", v), tab, fp); break
                if y in best: break
        print("cars: EEA year tables", {y: b[1] for y, b in best.items()})
        for y, (_, tab, fp) in best.items():
            if y not in have or (have[y][1] != "F" and fp == "F"): have[y] = (tab, fp)
        ec, ep = col("Ec (cm3)", "ec"), col("Ep (KW)", "ep")
        parts = []
        for y, (tab, status) in sorted(have.items()):
            sql = (f"SELECT {col('Mk')} AS Mk, {col('Cn')} AS Cn, {col('Ft')} AS Ft, {col('Fm')} AS Fm, ROUND({ec}, -1) AS ec, ROUND({ep}, 0) AS ep, "
                   f"AVG(CAST({col('M (kg)', 'm')} AS float)) AS m, AVG(CAST({col('W (mm)', 'W')} AS float)) AS w, AVG(CAST({col('Ewltp (g/km)', 'Ewltp')} AS float)) AS ew, "
                   f"AVG(CAST({col('Z (Wh/km)', 'z')} AS float)) AS z, SUM(CAST({col('R', 'r')} AS float)) AS n, {y} AS y "
                   f"FROM {tab} WHERE {yr} = {y}" + (f" AND {st} = '{status}' " if tab == T else " ") +
                   f"GROUP BY {col('Mk')}, {col('Cn')}, {col('Ft')}, {col('Fm')}, ROUND({ec}, -1), ROUND({ep}, 0) HAVING SUM(CAST({col('R', 'r')} AS float)) >= 20")
            page = 1
            while True:
                part = eea_query(B, sql, page); parts += part; print(f"cars: EEA {y} ({status}) page {page}: {len(part)}")
                if len(part) < 10000 or page >= 30: break
                page += 1
        groups = eea_merge(parts)
        r = eea_rows(groups); print(f"cars: EEA {len(groups)} versions → {len(r)} passages"); rows += r
    except BaseException as e: print(f"cars: EEA failed ({e})")
    B.write_pack(a.out, "cars", rows, {
        "name": "Cars — specs (US & Europe, incl. Chinese brands)", "name_ar": "السيارات — المواصفات (أمريكا وأوروبا، ومنها الصينية)",
        "license": "US EPA data: public domain. EEA data: CC BY 4.0",
        "attribution": "US: fueleconomy.gov (US EPA / Department of Energy), every model sold in the US since 2000. Europe: CO2 monitoring data of new passenger cars, European Environment Agency (EEA), CC BY 4.0 — every version registered in the EU since 2010, Chinese brands included.",
        "notice": "Official test figures (EPA / WLTP); prices are not in these sources — ask online for today's price.",
        "notice_ar": "أرقام الاختبارات الرسمية (EPA / WLTP)؛ الأسعار ليست في هذه المصادر — اسأل عبر الإنترنت عن السعر الحالي.",
        "sources": [{"title": "fueleconomy.gov (US EPA)", "url": "https://www.fueleconomy.gov/feg/download.shtml", "license": "Public domain"},
                    {"title": "EEA — CO2 emissions from new passenger cars", "url": "https://www.eea.europa.eu/en/datahub", "license": "CC BY 4.0"}],
        "retrieved": time.strftime("%Y-%m-%d")})

# ---- subject packs (Ali): math, physics, chemistry, biology, history — OpenStax CC BY books, formulas and worked examples kept ----------
SUBJECTS = {
    "math": ("Mathematics", "الرياضيات", ["calculus-volume-1", "calculus-volume-2", "calculus-volume-3", "algebra-and-trigonometry-2e", "precalculus-2e",
             "college-algebra-2e", "introductory-statistics-2e", "prealgebra-2e", "elementary-algebra-2e", "intermediate-algebra-2e",
             "contemporary-mathematics", "statistics", "introductory-business-statistics-2e"]),
    "physics": ("Physics", "الفيزياء", ["university-physics-volume-1", "university-physics-volume-2", "university-physics-volume-3", "college-physics-2e",
                "physics", "astronomy-2e"]),
    "chemistry": ("Chemistry", "الكيمياء", ["chemistry-2e", "chemistry-atoms-first-2e", "organic-chemistry"]),
    "biology": ("Biology", "الأحياء", ["biology-2e", "concepts-biology", "anatomy-and-physiology-2e", "microbiology", "biology-ap-courses"]),
    "history": ("History", "التاريخ", ["world-history-volume-1", "world-history-volume-2", "us-history"]),
    "business": ("Business", "الأعمال", ["introduction-business", "principles-management", "principles-marketing", "entrepreneurship", "organizational-behavior",
                 "business-ethics", "principles-financial-accounting", "principles-managerial-accounting", "business-law-i-essentials", "principles-finance",
                 "intellectual-property", "workplace-software-skills"]),
    "economics": ("Economics", "الاقتصاد", ["principles-economics-3e", "principles-microeconomics-3e", "principles-macroeconomics-3e",
                  "principles-microeconomics-ap-courses-2e", "principles-macroeconomics-ap-courses-2e", "principles-economics-2e"]),
    "society": ("Society & people", "المجتمع والإنسان", ["introduction-sociology-3e", "psychology-2e", "introduction-philosophy", "introduction-political-science",
                "american-government-3e", "introduction-anthropology", "lifespan-development", "life-liberty-and-pursuit-happiness", "college-success"]),
}

def openstax_collections():
    """Every OpenStax book on GitHub (sparse clones: the collection files and the module texts) → {slug: (repo dir, collection file)}."""
    B = _bk(); repos = []
    for page in range(1, 6):
        js = json.loads(B.get(f"https://api.github.com/orgs/openstax/repos?per_page=100&page={page}"))
        if not js: break
        repos += [r["name"] for r in js if r["name"].startswith("osbooks-") and not r.get("archived")]
    work, found = tempfile.mkdtemp(), {}
    for repo in sorted(set(repos)):
        d = os.path.join(work, repo)
        try:
            subprocess.run(["git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--sparse", f"https://github.com/openstax/{repo}.git", d], check=True, timeout=600)
            subprocess.run(["git", "-C", d, "sparse-checkout", "set", "--no-cone", "/collections/*", "/modules/*/index.cnxml", "/META-INF/*"], check=True, timeout=1200)
        except Exception as e:
            print("skip", repo, e, file=sys.stderr); continue
        cdir = os.path.join(d, "collections")
        for fn in sorted(os.listdir(cdir)) if os.path.isdir(cdir) else []:
            if fn.endswith(".collection.xml"): found[fn.replace(".collection.xml", "")] = (d, os.path.join(cdir, fn))
    return found

def subject_rows(title, url, mods):
    """A book's sections → passages titled «Book — Chapter — Section»."""
    rows = []
    for chap, mt, text in mods:
        head = " — ".join(x for x in (title, chap, mt) if x)
        for p in _bk().chunk(text, 900):
            rows.append({"t": head, "x": p, "u": url, "l": "en"})
    return rows

def build_subject(a, pid):
    B = _bk(); name, name_ar, slugs = SUBJECTS[pid]
    found = openstax_collections()
    budget, used, rows, books = int(a.budget_mb * 1e6), 0, [], []
    for slug in slugs:
        if slug not in found: print("not found", slug, file=sys.stderr); continue
        d, path = found[slug]
        if openstax_lang(path) != "en": continue
        try: title, lic, mods = openstax_book(d, path, keep_math=True)
        except Exception as e: print("skip", slug, e, file=sys.stderr); continue
        nc = "-nc" in lic
        if "-nd" in lic or ("/by" not in lic) or (nc and not getattr(a, "allow_nc", False)): print("license", slug, lic, file=sys.stderr); continue
        url = f"https://openstax.org/details/books/{slug}"
        r = subject_rows(title, url, mods)
        b = sum(len(x["x"].encode()) for x in r)
        if not r or used + b > budget: print("over budget", slug, b, file=sys.stderr); continue
        rows += r; used += b; books.append({"title": title, "url": url, "license": "CC BY-NC-SA 4.0" if nc else "CC BY 4.0"})
        print(f"{pid}: {title}: {len(r)} passages", file=sys.stderr)
    anync = any(b["license"] != "CC BY 4.0" for b in books)
    B.write_pack(a.out, pid, rows, {
        "name": f"{name} (OpenStax textbooks)", "name_ar": f"{name_ar} (كتب أوبن ستاكس الجامعية)",
        "license": "CC BY-NC-SA 4.0 — non-commercial use only" if anync else "CC BY 4.0", **({"noncommercial": True} if anync else {}),
        "attribution": "OpenStax (Rice University), openstax.org — peer-reviewed open textbooks, CC BY 4.0. Text with its formulas (as plain text) and worked examples; end-of-chapter exercises left out.",
        "sources": books, "retrieved": time.strftime("%Y-%m-%d"), "books": len(books)})

# ---- geography (Ali): each country's geography (CIA Factbook, public domain) + the world's well-known physical features (GeoNames, CC BY)
GEO_KINDS = {"MT": "mountain", "PK": "peak", "MTS": "mountain range", "VLC": "volcano", "HLL": "hill", "PLAT": "plateau", "PLN": "plain",
    "VAL": "valley", "CNYN": "canyon", "DSRT": "desert", "OAS": "oasis", "LK": "lake", "LKS": "lakes", "LKSL": "salt lake", "RSV": "reservoir",
    "STM": "river", "STMS": "rivers", "WAD": "wadi", "FLLS": "waterfall", "GLCR": "glacier", "ISL": "island", "ISLS": "islands", "ATOL": "atoll",
    "PEN": "peninsula", "CAPE": "cape", "SEA": "sea", "OCN": "ocean", "GULF": "gulf", "BAY": "bay", "STRT": "strait", "CHN": "channel",
    "DLTA": "delta", "BSNU": "basin", "MESA": "mesa", "SPNG": "spring", "CRTR": "crater", "PASS": "mountain pass", "DPR": "depression"}
GEO_FB = ("Geography", "Environment")

def geo_feature_rows(lines, countries, admin, min_names=8):
    """GeoNames allCountries lines → the well-known physical features (an Arabic name, or names in many languages, or a peak over 4,000 m)."""
    rows = []
    for line in lines:
        f = line.rstrip("\n").split("\t")
        if len(f) < 19 or f[7] not in GEO_KINDS: continue
        alts = [x for x in f[3].split(",") if x]
        ar = next((x for x in alts if AR.search(x)), "")
        elev = f[15] or f[16]
        try: e = int(float(elev)) if elev not in ("", "-9999") else None
        except ValueError: e = None
        if not (ar or len(alts) >= min_names or (e and e >= 4000 and f[7] in ("PK", "MT", "VLC"))): continue
        cc = f[8]; country = countries.get(cc, cc); region = admin.get(f"{cc}.{f[10]}", "")
        kind = GEO_KINDS[f[7]]
        bits = [f"{f[1]}" + (f" ({ar})" if ar else "") + f" is a {kind}" + (f" in {region}, {country}" if region and country else f" in {country}" if country else "")]
        if e is not None: bits.append(f"elevation {e:,} m")
        bits.append(f"coordinates {float(f[4]):.3f}, {float(f[5]):.3f}")
        rows.append({"t": f"{f[1]}" + (f" ({ar})" if ar else "") + f" — {kind}" + (f", {country}" if country else ""), "x": "; ".join(bits) + ".",
                     "u": f"https://www.geonames.org/{f[0]}", "l": "en"})
    return rows

def build_geography(a):
    import build_know_pack as BK
    B = _bk(); rows = []
    tree = json.loads(B.get("https://api.github.com/repos/factbook/factbook.json/git/trees/master?recursive=1"))
    files = [x["path"] for x in tree["tree"] if re.match(r"^[a-z-]+/[a-z]{2}\.json$", x["path"]) and not x["path"].startswith("meta/")]
    for p in sorted(files):
        region, code = p[:-5].split("/")
        try: js = json.loads(B.get(BK.FB + p))
        except BaseException as e: print("skip", p, e, file=sys.stderr); continue
        # the country's name comes from its Government section (else the rows are titled "TZ" instead of "Tanzania")
        name, r = BK.country_rows(region, code, {k: v for k, v in js.items() if k in GEO_FB or k == "Government"})
        rows += [dict(x, t=x["t"].replace(" — ", " — geography — ", 1)) for x in r if " — Government — " not in x["x"]]
    print(f"geography: Factbook {len(rows)} passages", file=sys.stderr)
    countries, admin = {}, {}
    for line in B.get("https://download.geonames.org/export/dump/countryInfo.txt").decode("utf-8").splitlines():
        f = line.split("\t")
        if len(f) > 4 and not line.startswith("#"): countries[f[0]] = f[4]
    for line in B.get("https://download.geonames.org/export/dump/admin1CodesASCII.txt").decode("utf-8").splitlines():
        f = line.split("\t")
        if len(f) >= 2: admin[f[0]] = f[1]
    path = os.path.join(tempfile.mkdtemp(), "allCountries.zip")
    subprocess.run(["curl", "-sfL", "--retry", "4", "-o", path, "https://download.geonames.org/export/dump/allCountries.zip"], check=True, timeout=3600)
    with zipfile.ZipFile(path) as z, z.open("allCountries.txt") as fh:
        feats = geo_feature_rows(io.TextIOWrapper(fh, encoding="utf-8"), countries, admin)
    os.remove(path)
    print(f"geography: GeoNames {len(feats)} features", file=sys.stderr)
    B.write_pack(a.out, "geography", rows + feats, {
        "name": "Geography", "name_ar": "الجغرافيا", "license": "Public domain (CIA World Factbook) + CC BY 4.0 (GeoNames)",
        "attribution": "Each country's geography and environment from the CIA World Factbook (public domain, via factbook/factbook.json); the world's well-known mountains, rivers, lakes, deserts, islands, seas and more from GeoNames (geonames.org, CC BY 4.0), with Arabic names where known.",
        "sources": [{"title": "CIA World Factbook", "url": "https://www.cia.gov/the-world-factbook/", "license": "Public domain"},
                    {"title": "GeoNames", "url": "https://www.geonames.org/", "license": "CC BY 4.0"}], "retrieved": time.strftime("%Y-%m-%d")})

# ---- coding (Ali): official docs — Python (PSF licence), MDN JavaScript / HTML / CSS (CC BY-SA 2.5), Kotlin (Apache 2.0) ---------------
def doc_chunks(body, size=1400):
    """Section text → pieces of about `size` characters at paragraph breaks; a code block is never cut and keeps its lines."""
    paras, cur, fence = [], [], False
    for line in body.split("\n"):
        if line.strip().startswith(("```", "~~~")): fence = not fence
        if not line.strip() and not fence:
            if cur: paras.append("\n".join(cur)); cur = []
        else: cur.append(line.rstrip())
    if cur: paras.append("\n".join(cur))
    out, acc = [], ""
    for p in paras:
        if acc and len(acc) + len(p) > size: out.append(acc); acc = p
        else: acc = (acc + "\n\n" + p) if acc else p
    if acc: out.append(acc)
    return [x.strip() for x in out if len(x.strip()) > 30]

def md_sections(text):
    """Markdown → [(heading path, body)]; front matter and MDN macros ({{jsxref("Array")}} → Array) cleaned, code blocks kept."""
    text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)
    text = re.sub(r"\{\{\s*[\w-]+\(\s*\"([^\"]+)\"(?:\s*,\s*\"([^\"]*)\")?[^}]*\)\s*\}\}", lambda m: m.group(2) or m.group(1), text)
    text = re.sub(r"\{\{[^}]*\}\}", "", text)
    text = re.sub(r"\[([^\]]+)\]\((?:[^)]+)\)", r"\1", text)
    out, path, buf, fence = [], [], [], False
    for line in text.split("\n"):
        if line.strip().startswith(("```", "~~~")): fence = not fence
        m = None if fence else re.match(r"^(#{1,4})\s+(.+?)\s*#*\s*$", line)
        if m:
            if "".join(buf).strip(): out.append((" › ".join(t for _, t in path), "\n".join(buf)))
            lvl = len(m.group(1)); path = [x for x in path if x[0] < lvl] + [(lvl, m.group(2).strip())]; buf = []
        else: buf.append(line)
    if "".join(buf).strip(): out.append((" › ".join(t for _, t in path), "\n".join(buf)))
    return out

def rst_sections(text):
    """reStructuredText (the Python docs) → [(heading path, body)]: headings from their underlines, directives tidied, code kept."""
    lines = text.split("\n"); out, path, buf, marks = [], [], [], []
    i = 0
    while i < len(lines):
        ln = lines[i]
        if i + 1 < len(lines) and ln.strip() and re.fullmatch(r"([=\-~^\"'`#*+])\1{2,}", lines[i + 1].strip()) and len(lines[i + 1].strip()) >= len(ln.strip()) - 2 and not ln.startswith(" "):
            ch = lines[i + 1].strip()[0]
            if ch not in marks: marks.append(ch)
            lvl = marks.index(ch)
            if "".join(buf).strip(): out.append((" › ".join(path), "\n".join(buf)))
            path = path[:lvl] + [ln.strip()]; buf = []; i += 2; continue
        if re.fullmatch(r"([=\-~^\"'`#*+])\1{2,}", ln.strip()): i += 1; continue
        ln = re.sub(r":(?:func|class|meth|mod|attr|data|exc|const|keyword|ref|term|pep|samp|file|envvar|option|program|token|dfn|abbr)?:`!?~?([^`<]+?)(?:\s*<[^>]+>)?`", r"\1", ln)
        ln = re.sub(r"^\.\. (?:index|highlight|testsetup|testcleanup|seealso|versionadded|versionchanged|deprecated|_[\w-]+)::?.*$", "", ln)
        ln = re.sub(r"^\.\. (function|class|method|attribute|data|exception|module|decorator)::\s*", lambda m: m.group(1) + ": ", ln)
        ln = ln.replace("``", "`")
        buf.append(ln); i += 1
    if "".join(buf).strip(): out.append((" › ".join(path), "\n".join(buf)))
    return out

def doc_rows(name, sections, url, size=1400):
    rows = []
    for path, body in sections:
        for piece in doc_chunks(body, size):
            rows.append({"t": f"{name} — {path}" if path else name, "x": piece, "u": url, "l": "en"})
    return rows

def sparse(repo, paths, branch=None):
    d = tempfile.mkdtemp()
    subprocess.run(["git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--sparse"] + (["-b", branch] if branch else []) + [f"https://github.com/{repo}.git", d], check=True, timeout=900)
    subprocess.run(["git", "-C", d, "sparse-checkout", "set", "--no-cone"] + paths, check=True, timeout=1800)
    return d

def build_coding(a):
    B = _bk(); rows, used = [], []
    try:
        d = sparse("python/cpython", ["/Doc/tutorial/*", "/Doc/library/*", "/Doc/reference/*", "/Doc/howto/*", "/Doc/faq/*"])
        n0 = len(rows)
        for sub in ("tutorial", "reference", "howto", "faq", "library"):
            for fn in sorted(glob.glob(os.path.join(d, "Doc", sub, "*.rst"))):
                page = os.path.basename(fn)[:-4]
                rows += doc_rows("Python docs", rst_sections(open(fn, encoding="utf-8").read()), f"https://docs.python.org/3/{sub}/{page}.html")
        print(f"coding: Python {len(rows) - n0}", file=sys.stderr)
        used.append({"title": "Python documentation (python.org)", "url": "https://docs.python.org/3/", "license": "PSF Documentation Licence"})
    except BaseException as e: print("coding: Python failed", e, file=sys.stderr)
    try:
        d = sparse("mdn/content", ["/files/en-us/web/javascript/*", "/files/en-us/web/html/*", "/files/en-us/web/css/*", "/files/en-us/learn_web_development/*"])
        n0 = len(rows)
        for fn in sorted(glob.glob(os.path.join(d, "files", "en-us", "**", "index.md"), recursive=True)):
            rel = os.path.relpath(os.path.dirname(fn), os.path.join(d, "files", "en-us"))
            text = open(fn, encoding="utf-8").read()
            t = re.search(r"^title:\s*(.+)$", text, re.M)
            area = rel.split(os.sep)[1] if rel.startswith("web" + os.sep) and len(rel.split(os.sep)) > 1 else rel.split(os.sep)[0]
            name = f"MDN {area.upper() if area in ('css', 'html') else area.title()} — " + (t.group(1).strip().strip("'\"") if t else rel)
            rows += doc_rows(name, md_sections(text), "https://developer.mozilla.org/en-US/docs/" + rel.replace(os.sep, "/"))
        print(f"coding: MDN {len(rows) - n0}", file=sys.stderr)
        used.append({"title": "MDN Web Docs (Mozilla)", "url": "https://developer.mozilla.org/", "license": "CC BY-SA 2.5"})
    except BaseException as e: print("coding: MDN failed", e, file=sys.stderr)
    try:
        d = sparse("JetBrains/kotlin-web-site", ["/docs/topics/*"])
        n0 = len(rows)
        for fn in sorted(glob.glob(os.path.join(d, "docs", "topics", "**", "*.md"), recursive=True)):
            page = os.path.basename(fn)[:-3]
            rows += doc_rows("Kotlin docs", md_sections(open(fn, encoding="utf-8").read()), f"https://kotlinlang.org/docs/{page}.html")
        print(f"coding: Kotlin {len(rows) - n0}", file=sys.stderr)
        used.append({"title": "Kotlin documentation (JetBrains)", "url": "https://kotlinlang.org/docs/", "license": "Apache 2.0"})
    except BaseException as e: print("coding: Kotlin failed", e, file=sys.stderr)
    budget = int(a.budget_mb * 1e6); kept, b = [], 0
    for r in rows:
        n = len(r["x"].encode())
        if b + n > budget: break
        kept.append(r); b += n
    B.write_pack(a.out, "coding", kept, {
        "name": "Coding (official docs)", "name_ar": "البرمجة (التوثيق الرسمي)",
        "license": "Python docs: PSF Documentation Licence; MDN: CC BY-SA 2.5 (Mozilla contributors); Kotlin docs: Apache 2.0",
        "attribution": "The official Python documentation (python.org), MDN Web Docs for JavaScript, HTML and CSS (by Mozilla Contributors, CC BY-SA 2.5) and the Kotlin documentation (JetBrains, Apache 2.0) — code examples kept with their lines.",
        "sources": used, "retrieved": time.strftime("%Y-%m-%d")})

BUILDERS = {"science": build_science, "health": build_health, "numbers": build_numbers, "cities": build_cities, "cranes": build_cranes, "quran": build_quran, "fiqh": build_fiqh, "hadith": build_hadith, "cars": build_cars, "geography": build_geography, "coding": build_coding, **{k: (lambda a, k=k: build_subject(a, k)) for k in SUBJECTS}}
