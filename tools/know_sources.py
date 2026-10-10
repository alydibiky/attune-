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

AR_CORE = re.compile(r"^[\u0621-\u063A\u0641-\u0652\u0670 \-]+$")
def arabic_name(alts):
    """The Arabic name among a place's other names: Arabic letters only (U+0621–U+0652). Uyghur, Persian, Urdu and Kurdish
    names use the same script with extra letters (ە ې ک گ پ چ ی) — «يەسكەندەريە» is not Arabic, so it's skipped."""
    return next((x.strip() for x in alts if x.strip() and AR_CORE.match(x.strip()) and len(x.strip()) >= 2), "")

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
        ar = arabic_name(alts.split(","))
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

# Per-verse tafsir from Quran.com's library (QUL), one JSON file per surah: [{surah, ayah, text}]. Attune is sold, so only
# classical tafsir in the public domain: تفسير الجلالين (QUL 523; al-Mahalli d. 864H and al-Suyuti d. 911H) in the quran
# pack, and تفسير ابن كثير (QUL 22; d. 774H) in the Islamic library. (التفسير الميسر, King Fahd Complex, is free to share
# but not for sale, so it left on 10 Oct 2026.) The edition's own notes in [[double brackets]] (the editor's manuscript
# variants, not the author's words) are taken out; every word of the tafsir itself is kept.
TAFSIR_API = "https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/{}/{}.json"
# (slug, name, QUL id, verses it explains at least: الجلالين leaves out 226 verses it had already explained or found plain)
TAFSIRS = {"jalalayn": ("ar-tafsir-al-jalalayn", "تفسير الجلالين", 523, 6000), "ibnkathir": ("ar-tafsir-ibn-kathir", "تفسير ابن كثير", 22, 6236)}

def split_intro(t):
    """The surah introduction (تسمية السورة / من مقاصد السورة and their • points) from the tafsir that follows it."""
    if "[التفسير]" in t: return tuple(x.strip() for x in t.split("[التفسير]", 1))
    if not t.startswith("تسمية السورة"): return "", t
    paras = [p.strip() for p in re.split(r"\n\s*\n", t) if p.strip()]
    k = 0
    while k < len(paras) and (paras[k].startswith("•") or paras[k] in ("تسمية السورة", "من مقاصد السورة")): k += 1
    return "\n\n".join(paras[:k]), "\n\n".join(paras[k:])

def editor_notes_out(t):
    """[[في أ: "يفتتح".]] — an edition's footnote inside the text — out; the author's words stay."""
    return re.sub(r"[ \t]*\[\[.*?\]\]", "", t, flags=re.S)

def tafsir_rows(s, items, verses, name="تفسير الجلالين", slug="ar-tafsir-al-jalalayn", size=0):
    """One surah's tafsir → passages: a surah introduction once (if the edition has one), then the tafsir with its verse(s).
    When the tafsir explains several verses together the source repeats it on each (or leaves the others empty); those become
    one passage (الآيات ١–٦). size > 0 cuts a long explanation into parts (ابن كثير), each still titled with its verses."""
    rows, sura, intro_done, groups = [], SURAS[s - 1], False, []
    for it in sorted(items, key=lambda i: int(i["ayah"])):
        v = int(it["ayah"])
        intro, t = split_intro(editor_notes_out((it.get("text") or "").strip()))
        if intro and not intro_done:
            rows.append({"t": f"{name} — مقدمة سورة {sura}", "x": intro, "u": f"https://quran.com/{s}", "l": "ar"}); intro_done = True
        if not t:
            if groups and groups[-1][0][-1] == v - 1: groups[-1][0].append(v)
            continue
        if groups and groups[-1][1] == t and groups[-1][0][-1] == v - 1: groups[-1][0].append(v)
        else: groups.append(([v], t))
    for vs, t in groups:
        a, b = vs[0], vs[-1]
        quote = " ".join(f"﴿{verses[(s, v)]}﴾ ({v})" for v in vs if verses.get((s, v)))
        label = f"الآية {a} ({s}:{a})" if a == b else f"الآيات {a}–{b} ({s}:{a}-{b})"
        title, url = f"{name} — سورة {sura}، {label}", f"https://quran.com/{s}:{a}/tafsirs/{slug}"
        parts = _bk().chunk(t, size) if size and len(t) > size * 1.3 else [t]
        for j, part in enumerate(parts):
            rows.append({"t": title + (f" — {j + 1}/{len(parts)}" if len(parts) > 1 else ""),
                         "x": (quote[:1200] + " " if quote and j == 0 else "") + part, "u": url, "l": "ar", "_n": len(vs) if j == 0 else 0})
    return rows

def quran_verses(B):
    txt = B.get("https://tanzil.net/pub/download/index.php?quranType=simple&outType=txt-2&agree=true", 300).decode("utf-8")
    verses = {}
    for line in txt.splitlines():
        f = line.split("|")
        if len(f) == 3 and f[0].isdigit(): verses[(int(f[0]), int(f[1]))] = f[2].strip()
    return txt, verses

def tafsir_all(B, key, verses, size=0):
    slug, name, _, least = TAFSIRS[key]; rows = []
    for s in range(1, 115):
        rows += tafsir_rows(s, json.loads(B.get(TAFSIR_API.format(slug, s), 120).decode("utf-8")), verses, name, slug, size)
    n = sum(r.pop("_n", 0) for r in rows)
    if not least <= n <= 6236: raise SystemExit(f"{name}: expected {least}–6236 verses, got {n}")
    return rows

def build_quran(a):
    B = _bk()
    txt, verses = quran_verses(B)
    rows, header = quran_rows(txt)
    if len(rows) != 6236: raise SystemExit(f"Quran text: expected 6236 verses, got {len(rows)}")
    tafsir = tafsir_all(B, "jalalayn", verses)
    print(f"quran: {len(rows)} verses + {len(tafsir)} tafsir passages")
    B.write_pack(a.out, "quran", rows + tafsir, {
        "name": "The Quran + Tafsir al-Jalalayn", "name_ar": "القرآن الكريم مع تفسير الجلالين",
        "license": "Quran text: Tanzil Project, verbatim with credit (commercial use allowed). Tafsir al-Jalalayn: classical text (public domain)",
        "attribution": "Quran text from the Tanzil Project (tanzil.net), verbatim, one passage per verse. " + " ".join(h for h in header if h)[:600]
                       + " — تفسير الجلالين: جلال الدين المحلي (ت ٨٦٤هـ) وجلال الدين السيوطي (ت ٩١١هـ)، كما نشرته مكتبة Quran.com (QUL).",
        "sources": [{"title": "Tanzil Project", "url": "https://tanzil.net/", "license": "Verbatim copies with credit"},
                    {"title": "تفسير الجلالين (Quran.com QUL, tafsir 523)", "url": "https://qul.tarteel.ai/resources/tafsir/523", "license": "Classical text (public domain)"}],
        "retrieved": time.strftime("%Y-%m-%d")})

# ---- fiqh: the classical books (public domain — Attune is sold, so not the modern الفقه الميسر), from turath.io ---------------------
# files.turath.io/books/<id>.json → {meta: {name, …}, indexes: {headings: [{title, level, page}], …}, pages: [{text, vol, page}]}
# A title may list other names it's published under («A|B»). The modern editor's footnotes are left out (turath_text).
FIQH_BOOKS = [   # (title on turath, a word that must NOT be in it, author hint, credit)
    ("الفقه على المذاهب الأربعة", "", "الجزيري", "عبد الرحمن الجزيري (ت ١٣٦٠هـ / ١٩٤١م) — الفقه على المذاهب الأربعة"),
    ("بداية المجتهد ونهاية المقتصد", "شرح", "رشد", "ابن رشد الحفيد (ت ٥٩٥هـ) — الفقه المقارن بأدلته"),
    ("عمدة الفقه", "شرح", "قدامة", "ابن قدامة المقدسي (ت ٦٢٠هـ) — المذهب الحنبلي"),
    ("متن أبي شجاع|الغاية والتقريب|متن الغاية والتقريب", "شرح", "", "أبو شجاع الأصفهاني (ت ٥٩٣هـ) — المذهب الشافعي"),
    ("مختصر القدوري", "شرح", "القدوري", "أبو الحسين القدوري (ت ٤٢٨هـ) — المذهب الحنفي"),
    ("مختصر خليل|مختصر العلامة خليل", "شرح", "خليل", "خليل بن إسحاق الجندي (ت ٧٧٦هـ) — المذهب المالكي"),
]
TURATH_API = "https://api.turath.io/"

def turath_json(B, path, **q):
    from urllib.parse import urlencode
    if path == "search": time.sleep(1.2)   # turath answers 429 (too many requests) to fast searches; pages keep their 0.15 s
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

def turath_text(html, notes=False):
    """A turath page → plain text: tags out, entities decoded. The modern editor's footnotes (below the page's ____ line, and
    their (1) marks in the text) are copyrighted, not the author's words, so they're left out unless notes=True."""
    t = re.sub(r"<br\s*/?>|</p>", "\n", html or "")
    if not notes:
        parts = re.split(r"<hr\b[^>]*>|\n\s*_{5,}\s*", t, maxsplit=1)
        t = parts[0]
        if len(parts) > 1: t = re.sub(r"[ \t]*\(\s*[0-9\u0660-\u0669]{1,3}\s*\)(?=[\s.،؛:]|$)", "", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"(?:[.…*]\s*){4,}", " ", htmlmod.unescape(t))   # the printed book's dotted separator lines («. . . . .»)
    return re.sub(r"[ \t]+", " ", t).replace("\u200f", "").strip()

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
        if len(re.sub(r"[\W_\d]+", "", text)) < 20: continue   # a page with no real text (a separator, a page number)
        where = " › ".join(path[k] for k in sorted(path))[-160:]
        ref = f"ج{pg.get('vol')} ص{pg.get('page')}" if pg.get("vol") else f"ص{pg.get('page', i)}"
        for j, piece in enumerate(_bk().chunk(text, 900)):
            rows.append({"t": f"{title} — {where} ({ref})" if where else f"{title} ({ref})", "x": piece, "u": f"https://app.turath.io/book/{book['_id']}?page={i}", "l": "ar"})
    return rows

# The classical books give measures in مثقال، درهم، صاع؛ people ask in grams. The standard conversions, with where scholars differ,
# written by Attune (numbers and facts — no one's text), so an answer in grams isn't left to the model's memory.
MEASURES = [
    ("الأوزان الشرعية — نصاب الذهب بالجرامات", "نصاب الذهب في الزكاة عشرون مثقالًا (عشرون دينارًا). والمثقال نحو 4.25 جرامًا، فالنصاب نحو 85 جرامًا من الذهب الخالص (عيار 24). ومن قدّره بالذهب المتداول عيار 21 قال: نحو 97 جرامًا. فإذا ملك المسلم هذا القدر وحال عليه الحول وجب فيه ربع العشر (2.5٪)."),
    ("الأوزان الشرعية — نصاب الفضة بالجرامات", "نصاب الفضة في الزكاة مئتا درهم. والدرهم نحو 2.975 جرامًا، فالنصاب نحو 595 جرامًا من الفضة الخالصة، والواجب فيه ربع العشر (2.5٪)."),
    ("الأوزان الشرعية — الصاع وزكاة الفطر", "زكاة الفطر صاع من غالب قوت البلد عن كل فرد. والصاع أربعة أمداد، ويقدَّر وزنًا بنحو 2.04 كيلوجرام من القمح، وقدّرته دار الإفتاء المصرية بنحو 2.5 كيلوجرام من الأرز. ويجيز الحنفية إخراج قيمته نقدًا."),
    ("الأوزان الشرعية — نصاب الزروع والثمار", "نصاب الزروع والثمار خمسة أوسق، والوسق ستون صاعًا، فالنصاب ثلاثمئة صاع، ويقدَّر بنحو 612 كيلوجرامًا من القمح (وقيل 653). والواجب العشر فيما سُقي بلا كلفة، ونصف العشر فيما سُقي بكلفة."),
]

def measure_rows():
    return [{"t": t, "x": x, "u": "", "l": "ar"} for t, x in MEASURES]

def build_fiqh(a):
    B = _bk(); rows, used = turath_rows(B, FIQH_BOOKS)
    rows += measure_rows()
    if len(used) < len(FIQH_BOOKS): turath_probe(B)
    B.write_pack(a.out, "fiqh", rows, {
        "name": "Islamic jurisprudence (the classical books)", "name_ar": "الفقه الإسلامي (الكتب المعتمدة)",
        "license": "Classical texts (public domain), from the Shamela library via turath.io; editors' footnotes left out",
        "attribution": "الفقه على المذاهب الأربعة (الجزيري)، وبداية المجتهد (ابن رشد)، وعمدة الفقه (ابن قدامة)، ومتن أبي شجاع، ومختصر القدوري، ومختصر خليل — النصوص كاملة كما في المكتبة الشاملة (turath.io)، مع اسم الكتاب والباب والجزء والصفحة لكل فقرة؛ ومعها ملاحظة من Attune بتحويل الأوزان الشرعية (المثقال والدرهم والصاع) إلى الجرامات.",
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
        t = htmlmod.unescape(re.sub(r"<[^>]+>", "", re.sub(r"<br\s*/?>", "\n", h.get("text") or ""))).strip()   # the Forties carry <br>
        if not t: continue
        if "\ufffd" in t:   # a letter damaged in the source (both its editions): marked, never guessed
            t = re.sub("\ufffd+", "[…]", t) + "\n(في هذا النص حرف تالف في المصدر، موضعه […]؛ راجع لفظه في الدرر السنية dorar.net)"
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

def head_chunks(head, items, size=1400):
    """«Head: (1) … | (2) … | …» in pieces of about `size`, each starting with the head, cut between items only. (Cut at sentence
    ends, the head «BYD SEAL — versions sold in Europe:» became its own tiny passage and outranked the one with the numbers.)"""
    out, cur = [], ""
    for it in items:
        if cur and len(head) + len(cur) + len(it) + 3 > size: out.append(head + " " + cur); cur = it
        else: cur = (cur + " | " + it) if cur else it
    if cur or not out: out.append(head + " " + cur)
    return out

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
        for j, piece in enumerate(head_chunks(f"{mk} {mo} {yr} — US versions (EPA tests):", [f"({i + 1}) {l}" for i, l in enumerate(lines)])):
            rows.append({"t": f"{make_label(mk)} {mo} {yr} — specs (US, EPA)", "x": piece, "u": "https://www.fueleconomy.gov/feg/findacar.shtml", "l": "en"})
    return rows

FUEL = {"petrol": "petrol", "diesel": "diesel", "electric": "electric", "petrol/electric": "plug-in hybrid (petrol)", "diesel/electric": "plug-in hybrid (diesel)",
        "lpg": "LPG", "ng": "natural gas", "e85": "E85", "hydrogen": "hydrogen"}

EEA_TRIMS = {"AWD", "4WD", "2WD", "RWD", "FWD", "4X4", "4X2", "4MATIC", "XDRIVE", "SDRIVE", "QUATTRO", "4MOTION", "HALO", "DESIGN", "COMFORT",
             "PREMIUM", "EXCELLENCE", "EXCLUSIVE", "LUXURY", "STANDARD", "BOOST", "FLAGSHIP"}
def clean_model(cn):
    """EEA model names as registered: «SEAL U SEAL U», «SEAL- SEAL- HALO 1-HALO 2-» → «SEAL U», «SEAL HALO 1 HALO 2» (a name
    written twice made its passage outrank the plain «SEAL»)."""
    w = re.sub(r"\s+", " ", re.sub(r"(?<=\w)-(?=\s|$)|-(?=\s)", " ", cn or "")).strip().split(" ")
    n = len(w)
    if n % 2 == 0 and n and w[:n // 2] == w[n // 2:]: w = w[:n // 2]
    out = []
    for x in w:
        if not out or out[-1] != x: out.append(x)
    # a trim or drive name after the model («SEAL AWD», «SEAL HALO 1 HALO 2») is a version of that model, listed in its passage
    for i, x in enumerate(out[1:], 1):
        if x in EEA_TRIMS: out = out[:i]; break
    return " ".join(out).replace("DMI", "DM-I")

def eea_rows(groups):
    """EEA groups [{Mk, Cn, Ft, Fm, ec, ep, m, ew, er, z, w, n, y0, y1}] → one passage per (make, model) with its versions."""
    models = {}
    for g in groups:
        mk = make_key(fix_mojibake(g.get("Mk"))); cn = re.sub(r"\s+", " ", fix_mojibake(g.get("Cn") or "").strip().upper())
        for pre in (mk + " ", re.sub(r"\s+", " ", (g.get("Mk") or "").strip().upper()) + " "):
            if cn.startswith(pre) and len(cn) > len(pre): cn = cn[len(pre):]
        cn = clean_model(cn)
        if not mk or not cn or cn in ("?", "-"): continue
        bits = []
        ft = (g.get("Ft") or "").strip().lower(); bits.append(FUEL.get(ft, ft) + (" hybrid" if (g.get("Fm") or "") == "H" and "electric" not in ft else ""))
        ep, ec = _f(g.get("ep")), _f(g.get("ec"))
        if ep: bits.append(f"{ep:.0f} kW ({ep * 1.341:.0f} hp horsepower)")   # both words: a small model didn't see "hp" as "horsepower"
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
        for piece in head_chunks(f"{name} — versions sold in Europe (EU registrations):", [f"({i + 1}) {v}" for i, (_, v) in enumerate(vs[:40])]):
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

# ---- car safety: NHTSA recalls and owner complaints (US government, public domain) — reliability for the car answers ------------------
NHTSA = "https://static.nhtsa.gov/odi/ffdd/"
def nhtsa_fields(doc):
    """The field order from NHTSA's data dictionary (RCL.txt / CMPL.txt): lines like '20  DESC_DEFECT  VARCHAR2(2000) …'."""
    f = {}
    for line in doc.splitlines():
        m = re.match(r"^\s*(\d{1,2})\s+([A-Z][A-Z0-9_]+)\s", line)
        if m and int(m.group(1)) not in f: f[int(m.group(1))] = m.group(2)
    return [f.get(i, f"F{i}") for i in range(1, max(f) + 1)] if f else []   # a missing number keeps its place (no shifted columns)

def short(t, n):
    """At most n characters, cut at a word, with … when cut."""
    t = re.sub(r"\s+", " ", t or "").strip()
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"

def recall_rows(lines, fields, from_year=2000, makes=None):
    ix = {n: i for i, n in enumerate(fields)}
    g = lambda r, n: (r[ix[n]].strip() if n in ix and ix[n] < len(r) else "")
    by = {}
    for line in lines:
        r = line.rstrip("\r\n").split("\t")
        if g(r, "RCLTYPECD") not in ("V", ""): continue
        y = g(r, "YEARTXT")
        if not y.isdigit() or int(y) < from_year: continue
        key = (g(r, "MAKETXT").upper(), g(r, "MODELTXT").upper(), y)
        if makes and make_key(key[0]) not in makes and (make_key(key[0]).split(" ") or [""])[0] not in makes: continue
        camp = g(r, "CAMPNO")
        lst = by.setdefault(key, {})
        if camp in lst: continue
        d = g(r, "RCDATE") or g(r, "ODATE")
        lst[camp] = (f"{camp}" + (f" ({d[:4]}-{d[4:6]})" if len(d) >= 6 else "") + f" — {g(r, 'COMPNAME').title()}: " + short(g(r, "DESC_DEFECT"), 240)
                     + (" Risk: " + short(g(r, "CONEQUENCE_DEFECT"), 140) if g(r, "CONEQUENCE_DEFECT") else ""))
    rows = []
    for (mk, mo, y), lst in sorted(by.items()):
        for piece in head_chunks(f"{mk.title()} {mo.title()} {y} — {len(lst)} safety recall(s) in the US (NHTSA):", list(lst.values())):
            rows.append({"t": f"{make_label(mk)} {mo.title()} {y} — recalls (NHTSA)", "x": piece, "u": f"https://www.nhtsa.gov/vehicle/{y}/{mk}/{mo}".replace(" ", "%20"), "l": "en"})
    return rows

def complaint_rows(lines, fields, from_year=2000, min_n=5, makes=None):
    ix = {n: i for i, n in enumerate(fields)}
    g = lambda r, n: (r[ix[n]].strip() if n in ix and ix[n] < len(r) else "")
    agg = {}
    for line in lines:
        r = line.rstrip("\r\n").split("\t")
        y = g(r, "YEARTXT")
        if not y.isdigit() or int(y) < from_year: continue
        key = (g(r, "MAKETXT").upper(), g(r, "MODELTXT").upper(), y)
        if makes and make_key(key[0]) not in makes and (make_key(key[0]).split(" ") or [""])[0] not in makes: continue
        a = agg.setdefault(key, {"n": 0, "crash": 0, "fire": 0, "inj": 0, "dead": 0, "comp": {}})
        a["n"] += 1; a["crash"] += g(r, "CRASH") == "Y"; a["fire"] += g(r, "FIRE") == "Y"
        try: a["inj"] += int(g(r, "INJURED") or 0); a["dead"] += int(g(r, "DEATHS") or 0)
        except ValueError: pass
        for c in g(r, "COMPDESC").split(","):
            c = c.strip().title()
            if c: a["comp"][c] = a["comp"].get(c, 0) + 1
    rows = []
    for (mk, mo, y), a in sorted(agg.items()):
        if a["n"] < min_n: continue
        top = sorted(a["comp"].items(), key=lambda x: -x[1])[:6]
        rows.append({"t": f"{make_label(mk)} {mo.title()} {y} — owner complaints (NHTSA)",
                     "x": f"{mk.title()} {mo.title()} {y} — owner complaints to NHTSA (reliability): {a['n']:,} complaints; {a['crash']} crashes, {a['fire']} fires, {a['inj']} injured, {a['dead']} deaths. Most reported problems: "
                          + ", ".join(f"{c} ({n})" for c, n in top) + ".", "u": "https://www.nhtsa.gov/recalls", "l": "en"})
    return rows

def nhtsa_safety(B, makes=None):
    rows = []
    try:
        # NHTSA has moved and split this file before: every known place is tried; one big file or the pre/post-2010 halves
        hosts = [NHTSA + "rcl/", "https://www-odi.nhtsa.dot.gov/downloads/folders/Recalls/"]
        f, r = None, []
        for h in hosts:
            try: f = nhtsa_fields(B.get(h + "RCL.txt", 60).decode("latin-1")); break
            except BaseException as e: print("cars: recall field list not at", h, e)
        if not f: raise RuntimeError("no RCL.txt")
        def fetch(url):
            path = os.path.join(tempfile.mkdtemp(), "rcl.zip")
            ok = subprocess.run(["curl", "-sfL", "--retry", "3", "-o", path, url], timeout=3600).returncode == 0
            print(f"cars: recalls {url} → {'ok' if ok else 'not there'}")
            return path if ok else None
        parts = []
        for h in hosts:
            one = fetch(h + "FLAT_RCL.zip")
            parts = [one] if one else [p for p in (fetch(h + "FLAT_RCL_PRE_2010.zip"), fetch(h + "FLAT_RCL_POST_2010.zip")) if p]
            if parts: break
        lines = []
        for path in parts:
            with zipfile.ZipFile(path) as z:
                for n in z.namelist():
                    with z.open(n) as fh: lines += io.TextIOWrapper(fh, encoding="latin-1").readlines()
            os.remove(path)
        r = recall_rows(lines, f, makes=makes)
        print(f"cars: NHTSA recalls {len(r)} passages (fields {f[:6]}…)"); rows += r
    except BaseException as e: print("cars: recalls failed", e)
    try:
        path = os.path.join(tempfile.mkdtemp(), "cmpl.zip")
        subprocess.run(["curl", "-sfL", "--retry", "4", "-o", path, NHTSA + "cmpl/FLAT_CMPL.zip"], check=True, timeout=3600)
        f = nhtsa_fields(B.get(NHTSA + "cmpl/CMPL.txt", 60).decode("latin-1"))
        with zipfile.ZipFile(path) as z, z.open(z.namelist()[0]) as fh:
            r = complaint_rows(io.TextIOWrapper(fh, encoding="latin-1"), f, makes=makes)
        os.remove(path)
        print(f"cars: NHTSA complaints {len(r)} model-years (fields {f[:6]}…)"); rows += r
    except BaseException as e: print("cars: complaints failed", e)
    return rows

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
    # recalls and complaints only for the car makes in the specs (NHTSA's files also cover motorcycles, trailers, RVs, buses…)
    makes = {make_key(r["t"].split(" (")[0] if " (" in r["t"] else r["t"].split(" ")[0]) for r in rows}
    rows += nhtsa_safety(B, makes)
    B.write_pack(a.out, "cars", rows, {
        "name": "Cars — specs (US & Europe, incl. Chinese brands)", "name_ar": "السيارات — المواصفات (أمريكا وأوروبا، ومنها الصينية)",
        "license": "US EPA data: public domain. EEA data: CC BY 4.0",
        "attribution": "US: fueleconomy.gov (US EPA / Department of Energy), every model sold in the US since 2000; safety recalls and owner complaints from NHTSA (public domain). Europe: CO2 monitoring data of new passenger cars, European Environment Agency (EEA), CC BY 4.0 — every version registered in the EU since 2010, Chinese brands included.",
        "notice": "Official test figures (EPA / WLTP); prices are not in these sources — ask online for today's price.",
        "notice_ar": "أرقام الاختبارات الرسمية (EPA / WLTP)؛ الأسعار ليست في هذه المصادر — اسأل عبر الإنترنت عن السعر الحالي.",
        "sources": [{"title": "fueleconomy.gov (US EPA)", "url": "https://www.fueleconomy.gov/feg/download.shtml", "license": "Public domain"},
                    {"title": "EEA — CO2 emissions from new passenger cars", "url": "https://www.eea.europa.eu/en/datahub", "license": "CC BY 4.0"},
                    {"title": "NHTSA recalls and complaints", "url": "https://www.nhtsa.gov/nhtsa-datasets-and-apis", "license": "Public domain"}],
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
            # full history (blobs on demand): a book later moved to non-commercial terms is read at its last CC BY version
            subprocess.run(["git", "clone", "-q", "--filter=blob:none", "--sparse", f"https://github.com/openstax/{repo}.git", d], check=True, timeout=900)
            subprocess.run(["git", "-C", d, "sparse-checkout", "set", "--no-cone", "/collections/*", "/modules/*/index.cnxml", "/META-INF/*"], check=True, timeout=1800)
        except Exception as e:
            print("skip", repo, e, file=sys.stderr); continue
        cdir = os.path.join(d, "collections")
        for fn in sorted(os.listdir(cdir)) if os.path.isdir(cdir) else []:
            if fn.endswith(".collection.xml"): found[fn.replace(".collection.xml", "")] = (d, os.path.join(cdir, fn))
    return found

def license_of(xml_text):
    m = re.search(r'license[^>]*url="([^"]+)"', xml_text or "") or re.search(r"<md:license[^>]*>([^<]+)<", xml_text or "")
    return m.group(1) if m else ""

def commercial_ok(lic):
    """Attune is sold: only licences that allow commercial use (CC BY, CC BY-SA, CC0, public domain)."""
    l = (lic or "").lower()
    return ("/by/" in l or "/by-sa/" in l or "publicdomain" in l or "/zero/" in l) and "-nc" not in l and "-nd" not in l

def cc_by_version(repo_dir, collection_path):
    """The newest commit at which this book was still published under a licence that allows commercial use → a checkout of it
    (Creative Commons licences can't be withdrawn: a version released under CC BY stays CC BY). → (dir, collection file, commit) or None."""
    rel = os.path.relpath(collection_path, repo_dir)
    log = subprocess.run(["git", "-C", repo_dir, "log", "--format=%H", "--", rel], capture_output=True, text=True, timeout=600).stdout.split()
    for h in log:
        xml = subprocess.run(["git", "-C", repo_dir, "show", f"{h}:{rel}"], capture_output=True, text=True, timeout=600).stdout
        if commercial_ok(license_of(xml)):
            wt = tempfile.mkdtemp(); os.rmdir(wt)
            subprocess.run(["git", "-C", repo_dir, "worktree", "add", "-q", "--detach", "--no-checkout", wt, h], check=True, timeout=600)
            subprocess.run(["git", "-C", wt, "sparse-checkout", "set", "--no-cone", "/collections/*", "/modules/*/index.cnxml"], check=True, timeout=600)
            subprocess.run(["git", "-C", wt, "checkout", "-q"], check=True, timeout=3600)
            return wt, os.path.join(wt, rel), h
    return None

def unique_rows(rows, seen=None, min_chars=40):
    """Exact repeats out (the Micro-, Macro- and AP editions of a textbook share whole chapters; the same FAQ answer sits on two
    pages) — the first copy stays, so Chat never fills its few passages with the same text twice. A bare heading with no text
    («Critical Thinking Questions») is dropped too."""
    seen = set() if seen is None else seen; out = []
    for r in rows:
        k = re.sub(r"\s+", " ", r["x"]).strip().lower()
        if len(k) < min_chars and not re.search(r"[.!?:;=)]", k): continue
        if k in seen: continue
        seen.add(k); out.append(r)
    return out

def fix_mojibake(t):
    """«CITROËN» read as Latin-1 arrives as «CITROÃ«N»: bytes back to UTF-8 when that's what happened, else unchanged."""
    if not t or not re.search(r"Ã.|Â.|Ø.|Ù.|â€", t): return t
    for enc in ("cp1252", "latin-1"):
        try: return t.encode(enc).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError): pass
    return t

# Extra CC BY textbooks from LibreTexts (OpenStax's calculus was never CC BY): (pack, book url, title, licence). Formulas stay as their
# LaTeX (\( … \)), which models read exactly.
LIBRETEXTS = [("math", "https://math.libretexts.org/Bookshelves/Calculus/Applied_Calculus_(Calaway_Hoffman_and_Lippman)",
               "Applied Calculus (Calaway, Hoffman & Lippman)", "CC BY 3.0")]

def libretexts_page(html):
    """A LibreTexts page → (title, text): the article body only, headings and paragraphs kept, LaTeX kept, the rest out."""
    t = re.search(r"<title>(.*?)</title>", html, re.S)
    title = htmlmod.unescape(re.sub(r"\s*-\s*Mathematics LibreTexts.*$", "", (t.group(1) if t else "").strip()))
    m = re.search(r'<section class="mt-content-container"[^>]*>(.*?)</section>', html, re.S) or re.search(r'<div class="mt-content-container"[^>]*>(.*)', html, re.S)
    body = m.group(1) if m else ""
    body = re.sub(r"<(script|style|nav|footer|figure)\b.*?</\1>", " ", body, flags=re.S | re.I)
    body = re.sub(r"<(?:h[1-6]|p|li|tr|br|div)\b[^>]*>", "\n", body, flags=re.I)
    body = re.sub(r"<[^>]+>", " ", body)
    body = htmlmod.unescape(body)
    lines = [re.sub(r"[ \t]+", " ", l).strip() for l in body.split("\n")]
    return title, "\n".join(l for l in lines if l)

def libretexts_links(html, base):
    """The book's own sub-pages linked from a page (chapters, then sections), in page order (relative or encoded links too)."""
    from urllib.parse import unquote, urljoin
    b = unquote(base); out = []
    for h in re.findall(r'href="([^"#?]+)"', html):
        full = unquote(urljoin(base + "/", htmlmod.unescape(h)))
        if full.startswith(b + "/") and full not in out: out.append(full)
    return out

def libretexts_rows(B, url, title, max_pages=400):
    """Walk a LibreTexts book (its contents page → chapters → sections) and make «Book — Section» passages."""
    seen, queue, rows = set(), [url], []
    while queue and len(seen) < max_pages:
        u = queue.pop(0)
        if u in seen: continue
        seen.add(u)
        try: html = B.get(u, 60).decode("utf-8", "replace")
        except BaseException as e: print(f"libretexts: {u} failed ({e})"); continue
        queue += [l for l in libretexts_links(html, url) if l not in seen]
        name, text = libretexts_page(html)
        if u != url and len(re.sub(r"\W+", "", text)) > 200:
            for piece in _bk().chunk(text, 900):
                rows.append({"t": f"{title} — {name}", "x": piece, "u": u, "l": "en"})
        time.sleep(1)   # gently
    print(f"libretexts: {title}: {len(seen)} pages → {len(rows)} passages")
    return rows

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
    budget, used, rows, books, seen = int(a.budget_mb * 1e6), 0, [], [], set()
    for slug in slugs:
        if slug not in found: print("not found", slug, file=sys.stderr); continue
        d, path = found[slug]
        if openstax_lang(path) != "en": continue
        commit = "current"
        try:
            title, lic, mods = openstax_book(d, path, keep_math=True)
            if not commercial_ok(lic):           # moved to non-commercial terms: its last CC BY version instead
                old = cc_by_version(d, path)
                if not old: print("license", slug, lic, "— no CC BY version in its history", file=sys.stderr); continue
                d2, path2, commit = old
                title, lic, mods = openstax_book(d2, path2, keep_math=True)
                print(f"{slug}: CC BY version {commit[:10]} ({lic})", file=sys.stderr)
        except Exception as e: print("skip", slug, e, file=sys.stderr); continue
        nc = not commercial_ok(lic)
        if nc: print("license", slug, lic, file=sys.stderr); continue
        url = f"https://openstax.org/details/books/{slug}"
        r = unique_rows(subject_rows(title, url, mods), seen)
        b = sum(len(x["x"].encode()) for x in r)
        if not r or used + b > budget: print("over budget", slug, b, file=sys.stderr); continue
        rows += r; used += b; books.append({"title": title, "url": url, "license": lic, "version": commit})
        print(f"{pid}: {title}: {len(r)} passages", file=sys.stderr)
    for lpid, lurl, ltitle, llic in LIBRETEXTS:
        if lpid != pid: continue
        r = unique_rows(libretexts_rows(B, lurl, ltitle), seen)
        if r: rows += r; books.append({"title": ltitle + " (LibreTexts)", "url": lurl, "license": llic})
    B.write_pack(a.out, pid, rows, {
        "name": f"{name} (OpenStax textbooks)", "name_ar": f"{name_ar} (كتب أوبن ستاكس الجامعية)",
        "license": "CC BY 4.0 (each book at its last CC BY version; commercial use allowed)",
        "attribution": "OpenStax (Rice University), openstax.org — peer-reviewed open textbooks, each at its last version released under CC BY 4.0 (Creative Commons licences are irrevocable). Text with its formulas (as plain text) and worked examples; end-of-chapter exercises left out.",
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
        ar = arabic_name(alts)
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
    for r in unique_rows(rows, min_chars=0):
        n = len(r["x"].encode())
        if b + n > budget: break
        kept.append(r); b += n
    B.write_pack(a.out, "coding", kept, {
        "name": "Coding (official docs)", "name_ar": "البرمجة (التوثيق الرسمي)",
        "license": "Python docs: PSF Documentation Licence; MDN: CC BY-SA 2.5 (Mozilla contributors); Kotlin docs: Apache 2.0",
        "attribution": "The official Python documentation (python.org), MDN Web Docs for JavaScript, HTML and CSS (by Mozilla Contributors, CC BY-SA 2.5) and the Kotlin documentation (JetBrains, Apache 2.0) — code examples kept with their lines.",
        "sources": used, "retrieved": time.strftime("%Y-%m-%d")})

# ---- turath books in general (the fiqh pack's method): found by exact title, read whole, titled with chapter, volume and page ------------
_TURATH_CAT = {}
def turath_catalog(B):
    """files.turath.io/data-v3.json: {cats, authors, books, …} — every book's id, name and author (1.8 MB). The shapes are read
    loosely (a dict or a list of dicts / lists) and the first book is printed, so a change on their side shows in the log."""
    if "books" in _TURATH_CAT: return _TURATH_CAT["books"]
    books = []
    try:
        d = json.loads(B.get("https://files.turath.io/data-v3.json", 120).decode("utf-8"))
        authors = d.get("authors") or {}
        def author_name(aid):
            a = authors.get(str(aid)) if isinstance(authors, dict) else next((x for x in authors if isinstance(x, dict) and str(x.get("id")) == str(aid)), None)
            return (a.get("name") or a.get("n") or "") if isinstance(a, dict) else (a if isinstance(a, str) else "")
        raw = d.get("books") or {}
        items = raw.items() if isinstance(raw, dict) else enumerate(raw)
        for k, b in items:
            if isinstance(b, dict):
                bid, name, aid = b.get("id", k), b.get("name") or b.get("n") or "", b.get("author_id", b.get("author", b.get("a")))
            elif isinstance(b, (list, tuple)) and len(b) >= 2:
                bid, name, aid = (b[0], b[1], b[2] if len(b) > 2 else None) if isinstance(b[0], int) else (k, b[0], b[1])
            else: continue
            books.append((int(bid) if str(bid).isdigit() else bid, str(name).strip(), author_name(aid) if aid is not None else ""))
        print(f"turath catalogue: {len(books)} books; first {list(items)[:0] or (books[:2])}; raw sample {str(next(iter(raw.values() if isinstance(raw, dict) else raw), ''))[:200]}")
    except BaseException as e: print("turath catalogue failed", e)
    _TURATH_CAT["books"] = books
    return books

def turath_catalog_pick(B, title, avoid, author):
    """The catalogue's book whose name is the title (or starts with it, a few words longer: «مختصر القدوري في الفقه الحنفي»),
    not a commentary (avoid), by the author hinted; the shortest such name wins (the plain text, not «… - ت فلان مع شرح»)."""
    norm = lambda x: re.sub(r"[\u064B-\u0652\u0640]", "", x).replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ى", "ي").replace("ة", "ه").strip()
    t = norm(title); best = None
    for bid, name, by in turath_catalog(B):
        n = norm(name)
        if not n.startswith(t) or len(n) > len(t) + 30: continue
        if avoid and avoid in name: continue
        if author and by and author not in by: continue
        if best is None or len(n) < len(norm(best[1])): best = (bid, name)
    return best or (None, None)

def turath_probe(B):
    """When titles aren't found: try the ways turath might look books up by title, and print what each answers (status and
    the start of the reply), so the next build uses the one that works."""
    import urllib.request, urllib.parse
    q = urllib.parse.quote("عمدة الفقه")
    tries = [f"https://api.turath.io/search?q={q}&ver=3", f"https://api.turath.io/search?q=%22{q}%22&ver=3&precision=1",
             f"https://api.turath.io/book_search?q={q}", f"https://api.turath.io/books?q={q}", f"https://api.turath.io/search?q={q}&type=book&ver=3",
             f"https://api.turath.io/titles?q={q}", "https://files.turath.io/data-v3.json", "https://files.turath.io/data.json",
             "https://files.turath.io/books.json", "https://api.turath.io/book?id=151&include=info&ver=3", "https://app.turath.io/"]
    for u in tries:
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "attune-know-pack"}), timeout=60) as r:
                body = r.read(); txt = body[:600].decode("utf-8", "replace")
                keys = ""
                try: j = json.loads(body); keys = list(j)[:12] if isinstance(j, dict) else f"list[{len(j)}]"
                except Exception: pass
                print(f"turath probe {u} → {r.status}, {len(body)} bytes, keys {keys}: {txt!r}")
        except Exception as e: print(f"turath probe {u} → {e}")
        time.sleep(1.5)
    try:
        html = B.get("https://app.turath.io/", 60).decode("utf-8", "replace")
        for src in re.findall(r'(?:src|href)="([^"]+\.js)"', html)[:3]:
            js = B.get(src, 60).decode("utf-8", "replace")
            print("turath probe js", src, len(js), sorted(set(re.findall(r'[a-z0-9.-]*(?:turath|nuqayah)[a-z0-9./_-]*', js)))[:40],
                  sorted(set(re.findall(r'["\'`]/[a-z_]{3,20}["\'`?]', js)))[:60], [js[m.start() - 80:m.end() + 80] for m in re.finditer(r"search|book", js)][:6])
    except BaseException as e: print("turath probe failed", e)

def turath_rows(B, specs):
    """specs: [(title, avoid, author hint, credit)] → (rows, sources)."""
    rows, used = [], []
    for titles, avoid, author, credit in specs:
        bid = name = None; title = titles.split("|")[0]
        for t in titles.split("|"):              # turath's own catalogue first: exact titles, no full-text noise
            bid, name = turath_catalog_pick(B, t, avoid, author)
            if bid: break
        for t in titles.split("|") if not bid else []:
            for q in (t, t + " " + author if author else t):
                for page in (1, 2, 3):
                    r = turath_json(B, "search", q=q, page=page)
                    bid, name = turath_pick((r or {}).get("data"), t, avoid, author)
                    if bid: break
                if bid: break
            if bid: break
        if not bid:
            r = turath_json(B, "search", q=title) or {}
            seen = []
            for h in (r.get("data") or [])[:30]:
                m = h.get("meta"); m = json.loads(m) if isinstance(m, str) else (m or {})
                x = f"{h.get('book_id')} «{m.get('book_name')}» ({(m.get('author_name') or '')[:40]})"
                if x not in seen: seen.append(x)
            print(f"turath: «{title}» was not found; the search gave: " + "; ".join(seen[:12])); continue
        book = turath_book(B, bid)
        if not book or not book.get("pages"): print(f"turath: «{name}» ({bid}) could not be read"); continue
        book["_id"] = bid; r = fiqh_rows(book, title, credit)
        print(f"turath: {bid} «{name}»: {len(book['pages'])} pages → {len(r)} passages")
        rows += r; used.append({"title": f"{title} — {credit}", "url": f"https://app.turath.io/book/{bid}", "license": "Classical text (public domain), via the Shamela library"})
    return rows, used

ISLAM_LIB = [("رياض الصالحين", "شرح", "النووي", "النووي (ت ٦٧٦هـ)"),
             ("بلوغ المرام من أدلة الأحكام", "شرح", "حجر", "ابن حجر العسقلاني (ت ٨٥٢هـ)")]

def build_islamlib(a):
    """تفسير ابن كثير verse by verse (Quran.com QUL) + رياض الصالحين and بلوغ المرام whole (turath.io). Public domain only:
    تفسير السعدي left (its author died in 1956, so it is still under copyright in some countries until 2027)."""
    B = _bk()
    _, verses = quran_verses(B)
    ik = tafsir_all(B, "ibnkathir", verses, size=1400); print(f"islamlib: تفسير ابن كثير {len(ik)} passages")
    rows, used = turath_rows(B, ISLAM_LIB)
    B.write_pack(a.out, "islamlib", ik + rows, {
        "name": "Islamic library (Ibn Kathir, Riyad as-Salihin, Bulugh al-Maram)", "name_ar": "المكتبة الإسلامية",
        "license": "Classical texts (public domain); editions' footnotes left out",
        "attribution": "تفسير ابن كثير (ت ٧٧٤هـ) آيةً آية كما نشرته مكتبة Quran.com (QUL)، ورياض الصالحين (النووي) وبلوغ المرام (ابن حجر) كاملين كما في المكتبة الشاملة (turath.io)، مع الباب والجزء والصفحة لكل فقرة.",
        "notice": "For learning; for a ruling on your own case, ask a qualified scholar or Dar al-Ifta.",
        "notice_ar": "للتعلّم؛ وفي مسألتك الخاصة اسأل عالمًا موثوقًا أو دار الإفتاء.",
        "sources": [{"title": "تفسير ابن كثير (Quran.com QUL, tafsir 22)", "url": "https://qul.tarteel.ai/resources/tafsir/22", "license": "Classical text (public domain)"}] + used,
        "retrieved": time.strftime("%Y-%m-%d")})

# ---- dictionary: Open English WordNet 2025 (CC BY 4.0) + the classical Arabic dictionaries (public domain) ------------------------------
WN_ZIP = "https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-json.zip"
POS = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
AR_DICTS = [("لسان العرب", "", "ابن منظور", "ابن منظور (ت ٧١١هـ)"), ("مختار الصحاح", "", "الرازي", "زين الدين الرازي (ت ٦٦٦هـ)")]

def wordnet_rows(z):
    syn = {}
    for n in z.namelist():
        if n.endswith(".json") and not n.startswith("entries-"):
            syn.update(json.loads(z.read(n)))
    rows = []
    for n in sorted(x for x in z.namelist() if x.startswith("entries-")):
        for lemma, by_pos in json.loads(z.read(n)).items():
            parts = []
            for pos, e in by_pos.items():
                senses = []
                for i, sense in enumerate(e.get("sense") or [], 1):
                    sy = syn.get(sense.get("synset")) or {}
                    d = "; ".join(sy.get("definition") or [])
                    if not d: continue
                    ex = [x if isinstance(x, str) else x.get("text", "") for x in (sy.get("example") or [])][:2]
                    others = [m for m in (sy.get("members") or []) if m != lemma][:6]
                    senses.append(f"{i}) {d}" + (f" — e.g. “{ex[0]}”" if ex and ex[0] else "") + (f" (same as: {', '.join(others)})" if others else ""))
                if senses: parts.append(f"{POS.get(pos, pos)}: " + " ".join(senses[:12]))
            if parts:
                rows.append({"t": f"Dictionary — {lemma}", "x": f"{lemma} — " + " | ".join(parts), "u": "https://en-word.net/lemma/" + lemma.replace(" ", "_"), "l": "en"})
    return rows

def build_dictionary(a):
    B = _bk()
    z = zipfile.ZipFile(io.BytesIO(B.get(WN_ZIP, 300)))
    rows = wordnet_rows(z); print(f"dictionary: WordNet {len(rows)} words")
    ar, used = turath_rows(B, AR_DICTS)
    B.write_pack(a.out, "dictionary", rows + ar, {
        "name": "Dictionary (English and classical Arabic)", "name_ar": "القاموس (الإنجليزي والعربي)",
        "license": "Open English WordNet: CC BY 4.0; Arabic dictionaries: classical texts (public domain)",
        "attribution": "Open English WordNet 2025 (en-word.net, CC BY 4.0, derived from Princeton WordNet) — every English word with its meanings, examples and synonyms; لسان العرب ومختار الصحاح من المكتبة الشاملة (turath.io).",
        "sources": [{"title": "Open English WordNet 2025", "url": "https://en-word.net/", "license": "CC BY 4.0"}] + used, "retrieved": time.strftime("%Y-%m-%d")})

# ---- medicines: every US drug label (openFDA, CC0 public domain) — uses, dose, contraindications, warnings, side effects, interactions ---
OPENFDA = "https://api.fda.gov/download.json"
DRUG_SECTIONS = [("boxed_warning", "Boxed warning"), ("indications_and_usage", "Uses"), ("dosage_and_administration", "Dose"),
                 ("contraindications", "Do not use if"), ("warnings_and_cautions", "Warnings"), ("warnings", "Warnings"),
                 ("adverse_reactions", "Side effects"), ("drug_interactions", "Interactions"), ("pregnancy", "Pregnancy"),
                 ("use_in_specific_populations", "Special groups"), ("overdosage", "Overdose"), ("do_not_use", "Do not use"),
                 ("stop_use", "Stop use and ask a doctor if"), ("purpose", "Purpose")]
INN = {"ACETAMINOPHEN": "paracetamol", "ALBUTEROL": "salbutamol", "EPINEPHRINE": "adrenaline", "NOREPINEPHRINE": "noradrenaline", "MEPERIDINE": "pethidine",
       "GLYBURIDE": "glibenclamide", "FUROSEMIDE": "frusemide", "LIDOCAINE": "lignocaine", "CYCLOSPORINE": "ciclosporin", "ISOPROTERENOL": "isoprenaline",
       "PHENYLEPHRINE": "phenylephrine", "RIFAMPIN": "rifampicin", "SULFAMETHOXAZOLE": "sulphamethoxazole", "ACETYLSALICYLIC ACID": "aspirin", "ASPIRIN": "acetylsalicylic acid"}
COSMETIC = re.compile(r"\b(SUNSCREEN|SPF|ANTIPERSPIRANT|DEODORANT|TOOTHPASTE|SHAMPOO|LIP BALM|HAND SANITI[SZ]ER|SCENT|FOUNDATION|MOISTURI[SZ]ER|SERUM|BB CREAM|CC CREAM|MAKEUP|CONCEALER|LIPSTICK|FRAGRANCE)\b")

def drug_name(of):
    """The medicine's name = its active ingredients (openFDA substance_name), so «Ibuprofen 200Mg», «IBUPROFEN» and a store brand
    are one medicine. Labels without them fall back to the generic name with doses, percentages and stray brackets taken out."""
    subs = sorted(set(x.strip().upper() for x in of.get("substance_name") or [] if x.strip()))
    if subs: return ", ".join(subs)
    g = ", ".join(sorted(set(x.strip().upper() for x in of.get("generic_name") or [] if x.strip())))
    g = re.sub(r"\d+(\.\d+)?\s*(%|MG|MCG|G|ML|IU)\b", "", g)
    g = re.sub(r"[()\[\]]", "", g)
    return re.sub(r"\s+", " ", g).strip(" ,-")

ROUTE_GROUP = [("oral", ("ORAL", "SUBLINGUAL", "BUCCAL")), ("injection", ("INTRAVENOUS", "INTRAMUSCULAR", "SUBCUTANEOUS", "INTRATHECAL", "EPIDURAL", "INFILTRATION", "PERINEURAL", "INTRADERMAL")),
               ("skin", ("TOPICAL", "TRANSDERMAL", "CUTANEOUS")), ("eye/ear", ("OPHTHALMIC", "AURICULAR (OTIC)", "OTIC")), ("inhaled/nasal", ("RESPIRATORY (INHALATION)", "NASAL", "INHALATION"))]
def route_group(routes):
    r = set(x.upper() for x in routes or [])
    for name, keys in ROUTE_GROUP:
        if r & set(keys): return name
    return "other"

def drug_rows(labels):
    """openFDA label records → one medicine per (active ingredients, route): «Acetaminophen — oral» and «— injection» are
    different labels with different doses, so a question about the tablets doesn't get the hospital injection's dose. Per
    medicine: the prescription label first, then the newest; brands listed by how many labels use them. Cosmetics with a
    drug label (sunscreens, antiperspirants, toothpaste) are left out."""
    best, brand_n = {}, {}
    for d in labels:
        of = d.get("openfda") or {}
        g = drug_name(of)
        if not g or len(g) > 120 or not re.search(r"[A-Z]{3}", g): continue
        if COSMETIC.search(" ".join((of.get("generic_name") or []) + (of.get("brand_name") or [])).upper()): continue
        if not (d.get("indications_and_usage") or d.get("purpose")): continue
        k = (g, route_group(of.get("route")))
        rx = "PRESCRIPTION" in " ".join(of.get("product_type") or []).upper()
        key = (rx, d.get("effective_time") or "")
        if k not in best or key > best[k][0]: best[k] = (key, d)
        for b_ in set(b.strip().title() for b in of.get("brand_name") or [] if b.strip()):
            brand_n.setdefault(k, {}); brand_n[k][b_] = brand_n[k].get(b_, 0) + 1
    groups = {}
    for (g, rg) in best: groups.setdefault(g, []).append(rg)
    rows = []
    for (g, rg), (_, d) in sorted(best.items()):
        of = d.get("openfda") or {}
        bn = brand_n.get((g, rg), {})
        brands = ", ".join(b for b, _ in sorted(bn.items(), key=lambda x: (-x[1], x[0])) if b.upper() != g)
        if len(brands) > 240: brands = brands[:240].rsplit(",", 1)[0] + "…"
        route = ", ".join(sorted(set(r.lower() for r in of.get("route") or []))[:3])
        alias = " / ".join(INN[w] for w in INN if w in g)
        name = g.title() + (f" ({alias})" if alias else "") + (f" — {rg}" if len(groups[g]) > 1 else "")
        seen = set()
        for key, label in DRUG_SECTIONS:
            txt = re.sub(r"\s+", " ", " ".join(d.get(key) or [])).strip()
            if not txt or label in seen: continue
            seen.add(label)
            txt = re.sub(r"^\d+(\.\d+)*\s+[A-Z &]+\s+", "", txt)[:2600]
            for piece in _bk().chunk(txt, 900):
                rows.append({"t": f"Medicine — {name} — {label}", "x": f"{name}" + (f" (brands: {brands})" if brands else "") + (f", {route}" if route else "") + f" — {label}: {piece}",
                             "u": "https://dailymed.nlm.nih.gov/dailymed/search.cfm?query=" + g.split(",")[0].replace(" ", "+"), "l": "en"})
    return rows

def build_medicines(a):
    B = _bk()
    idx = json.loads(B.get(OPENFDA, 120))
    parts = idx["results"]["drug"]["label"]["partitions"]
    labels = []
    for prt in parts:
        try:
            z = zipfile.ZipFile(io.BytesIO(B.get(prt["file"], 600)))
            for n in z.namelist():
                for d in json.loads(z.read(n)).get("results") or []:
                    labels.append({k: d.get(k) for k in ["openfda", "effective_time"] + [x for x, _ in DRUG_SECTIONS] if d.get(k)})
            print(f"medicines: {prt['file'].rsplit('/', 1)[-1]}: {len(labels)} labels so far")
        except BaseException as e: print("medicines: skip", prt.get("file"), e)
    rows = drug_rows(labels); print(f"medicines: {len(rows)} passages")
    budget = int(a.budget_mb * 1e6); kept, b = [], 0
    for r in rows:
        n = len(r["x"].encode())
        if b + n > budget: continue
        kept.append(r); b += n
    B.write_pack(a.out, "medicines", kept, {
        "name": "Medicines (FDA drug labels)", "name_ar": "الأدوية (نشرات هيئة الغذاء والدواء الأمريكية)",
        "license": "Public domain (openFDA, CC0)",
        "attribution": "openFDA drug labels (US Food and Drug Administration, CC0): every medicine's official label — uses, dose, contraindications, warnings, side effects, interactions, pregnancy, overdose.",
        "notice": "From the official US labels — not medical advice; your doctor or pharmacist decides your dose.",
        "notice_ar": "من النشرات الرسمية الأمريكية — ليست نصيحة طبية؛ الطبيب أو الصيدلي يحدد جرعتك.",
        "sources": [{"title": "openFDA drug labels", "url": "https://open.fda.gov/apis/drug/label/", "license": "CC0 (public domain)"}], "retrieved": time.strftime("%Y-%m-%d")})

# ---- wikidata (Ali, 10 Oct 2026: "if B is reliable then ok"): ONLY statements Wikidata backs with an outside source ---------------------
# A statement is kept when one of its references is a URL that is not a Wikimedia site (P854) or a «stated in» (P248) work that is
# not a Wikipedia edition; statements sourced only «imported from Wikimedia project» (P143) are dropped. Deprecated ones too, and
# ended ones (P582: a former capital, a past population). Each passage lists the source of every fact. CC0. Ranked under the
# official packs in the app (knowledge.js).
WDQS = "https://query.wikidata.org/sparql"
WD_SETS = [   # (name, class filter (SPARQL on ?item), [(property, label, kind)], extra filter)
    ("country", "?item wdt:P31 wd:Q3624078 .", [("P36", "capital", "item"), ("P1082", "population", "qty"), ("P2046", "area", "qty"),
        ("P38", "currency", "item"), ("P37", "official language", "item"), ("P571", "founded", "time"), ("P610", "highest point", "item"),
        ("P474", "calling code", "str"), ("P2131", "GDP (nominal)", "qty"), ("P1081", "Human Development Index", "qty")], ""),
    ("big city", "?item wdt:P31/wdt:P279* wd:Q1549591 .", [("P1082", "population", "qty"), ("P17", "country", "item"), ("P2046", "area", "qty"),
        ("P2044", "elevation", "qty")], ""),
    ("mountain", "?item wdt:P31 wd:Q8502 ; wdt:P2044 ?e . FILTER(?e >= 3500)", [("P2044", "elevation", "qty"), ("P17", "country", "item"),
        ("P4552", "mountain range", "item")], ""),
    ("river", "?item wdt:P31 wd:Q4022 ; wdt:P2043 ?l . FILTER(?l >= 400)", [("P2043", "length", "qty"), ("P2225", "discharge", "qty"),
        ("P403", "mouth", "item"), ("P17", "country", "item")], ""),
    ("lake", "?item wdt:P31 wd:Q23397 ; wdt:P2046 ?a . FILTER(?a >= 500)", [("P2046", "area", "qty"), ("P4511", "depth", "qty"), ("P17", "country", "item")], ""),
    ("chemical element", "?item wdt:P31 wd:Q11344 .", [("P1086", "atomic number", "qty"), ("P246", "symbol", "str"), ("P2067", "atomic mass", "qty"),
        ("P2101", "melting point", "qty"), ("P2102", "boiling point", "qty"), ("P575", "discovered", "time"), ("P61", "discoverer", "item")], ""),
    ("famous person", "?item wdt:P31 wd:Q5 ; wikibase:sitelinks ?sl . FILTER(?sl >= 90)", [("P569", "born", "time"), ("P570", "died", "time"),
        ("P19", "place of birth", "item"), ("P20", "place of death", "item"), ("P27", "citizenship", "item"), ("P106", "occupation", "item")], ""),
]

def wd_query(cls, prop, kind):
    val = {"item": f"ps:{prop} ?v . OPTIONAL {{ ?v rdfs:label ?vl FILTER(LANG(?vl) = 'en') }}",
           "qty": f"psv:{prop} [ wikibase:quantityAmount ?v ; wikibase:quantityUnit ?u ] . OPTIONAL {{ ?u rdfs:label ?ul FILTER(LANG(?ul) = 'en') }}",
           "time": f"psv:{prop} [ wikibase:timeValue ?v ; wikibase:timePrecision ?prec ] .",
           "str": f"ps:{prop} ?v ."}[kind]
    return f"""SELECT ?item ?en ?ar ?v ?vl ?ul ?prec ?when ?url ?statedL WHERE {{
  {cls}
  ?item p:{prop} ?st . ?st {val}
  ?st wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank)
  FILTER NOT EXISTS {{ ?st pq:P582 ?ended }}
  OPTIONAL {{ ?st pq:P585 ?when }}
  ?st prov:wasDerivedFrom ?ref .
  {{ ?ref pr:P854 ?url . FILTER(!REGEX(STR(?url), "wiki(pedia|data|media)\\.org", "i")) }}
  UNION {{ ?ref pr:P248 ?stated . FILTER NOT EXISTS {{ ?stated wdt:P31 wd:Q10876391 }} ?stated rdfs:label ?statedL FILTER(LANG(?statedL) = 'en') }}
  ?item rdfs:label ?en FILTER(LANG(?en) = 'en')
  OPTIONAL {{ ?item rdfs:label ?ar FILTER(LANG(?ar) = 'ar') }}
}}"""

def wd_fmt(b, kind):
    """One SPARQL result row → the value as people read it."""
    g = lambda k: (b.get(k) or {}).get("value", "")
    v = g("v")
    if kind == "item": return g("vl") or ""
    if kind == "qty":
        try: x = float(v)
        except ValueError: return ""
        num = f"{x:,.0f}" if abs(x) >= 100 and x == int(x) else (f"{x:,.2f}".rstrip("0").rstrip(".") if abs(x) >= 1 else f"{x:.4g}")
        u = g("ul"); u = "" if u in ("", "1") else " " + {"square kilometre": "km²", "metre": "m", "kilometre": "km", "United States dollar": "US$",
            "cubic metre per second": "m³/s", "degree Celsius": "°C", "kelvin": "K", "dalton": "u", "gram per mole": "g/mol"}.get(u, u)
        return num + u
    if kind == "time":
        y = re.match(r"^([+-]?\d+)-(\d\d)-(\d\d)", v)
        if not y: return ""
        yr, prec = int(y.group(1)), int(g("prec") or 9)
        yrs = f"{abs(yr)} BC" if yr < 0 else str(yr)
        return f"{int(y.group(3))} {['January','February','March','April','May','June','July','August','September','October','November','December'][int(y.group(2)) - 1]} {yrs}" if prec >= 11 else yrs
    return v

def wd_source(b):
    g = lambda k: (b.get(k) or {}).get("value", "")
    if g("statedL"): return g("statedL")
    u = g("url")
    m = re.match(r"https?://(?:www\.)?([^/]+)", u)
    return m.group(1) if m else ""

def wikidata_rows(results):
    """[(set name, prop label, kind, SPARQL bindings)] → one passage per item: «Egypt — facts with their sources (Wikidata)»."""
    items = {}
    for set_name, label, kind, rows in results:
        for b in rows:
            qid = (b.get("item") or {}).get("value", "").rsplit("/", 1)[-1]
            val = wd_fmt(b, kind)
            if not qid or not val: continue
            it = items.setdefault(qid, {"en": b["en"]["value"], "ar": (b.get("ar") or {}).get("value", ""), "set": set_name, "facts": {}})
            when = ((b.get("when") or {}).get("value") or "")[:4]
            f = it["facts"].setdefault(label, {})
            key = val + (f" ({when})" if when else "")
            f.setdefault(key, set()).add(wd_source(b))
    rows = []
    for qid, it in sorted(items.items(), key=lambda x: x[1]["en"]):
        parts = []
        for label, vals in it["facts"].items():
            # several values: the most recent dated one first (a population), at most 4
            vs = sorted(vals.items(), key=lambda kv: re.search(r"\((\d{4})\)$", kv[0]).group(1) if re.search(r"\((\d{4})\)$", kv[0]) else "", reverse=True)[:4]
            parts.append(f"{label}: " + "; ".join(f"{v} [source: {', '.join(sorted(s for s in src if s)[:2])}]" for v, src in vs))
        if not parts: continue
        name = it["en"] + (f" ({it['ar']})" if it["ar"] else "")
        rows.append({"t": f"{name} — {it['set']}, facts with their sources (Wikidata)", "x": f"{name} ({it['set']}): " + " | ".join(parts) + ".",
                     "u": f"https://www.wikidata.org/wiki/{qid}", "l": "en"})
    return rows

def build_wikidata(a):
    import urllib.parse
    B = _bk(); results = []
    for set_name, cls, props, _ in WD_SETS:
        for prop, label, kind in props:
            q = wd_query(cls, prop, kind)
            try:
                d = json.loads(B.get(WDQS + "?" + urllib.parse.urlencode({"query": q, "format": "json"}), 120, accept="application/sparql-results+json").decode("utf-8"))
                rows = d["results"]["bindings"]
            except BaseException as e: print(f"wikidata: {set_name} {label} failed ({e})"); rows = []
            print(f"wikidata: {set_name} · {label}: {len(rows)} sourced statements"); results.append((set_name, label, kind, rows))
            time.sleep(2)   # WDQS asks for a gentle pace
    rows = wikidata_rows(results)
    B.write_pack(a.out, "wikidata", rows, {
        "name": "Sourced facts (Wikidata)", "name_ar": "حقائق موثّقة بمصادرها (ويكي بيانات)",
        "license": "CC0 (Wikidata)",
        "attribution": "Wikidata (wikidata.org), CC0 — only statements that cite an outside source (a publisher, an official site, a statistics office); statements sourced only to Wikipedia are left out. Every fact is shown with its source.",
        "notice": "Crowd-edited data, kept only where it cites a source; for anything important, check the source named.",
        "notice_ar": "بيانات يحررها المتطوعون، أُخذ منها ما له مصدر فقط؛ وفي الأمور المهمة راجع المصدر المذكور.",
        "sources": [{"title": "Wikidata — sourced statements only", "url": "https://www.wikidata.org/", "license": "CC0"}], "retrieved": time.strftime("%Y-%m-%d")})

BUILDERS = {"wikidata": build_wikidata, "science": build_science, "health": build_health, "numbers": build_numbers, "cities": build_cities, "cranes": build_cranes, "quran": build_quran, "fiqh": build_fiqh, "hadith": build_hadith, "cars": build_cars, "geography": build_geography, "coding": build_coding, "islamlib": build_islamlib, "dictionary": build_dictionary, "medicines": build_medicines, **{k: (lambda a, k=k: build_subject(a, k)) for k in SUBJECTS}}
