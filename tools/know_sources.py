"""v6.16 — the general-knowledge Knowledge packs (Ali: "find reliable sources and make the app better in general knowledge").
Every source is reliable (a university press, a national library of medicine, the World Bank, a government rulebook, the
standard verified Quran text) and openly licensed; still no Wikipedia (Ali's rule, v5.22). Used by tools/build_know_pack.py.
Each builder returns nothing: it writes out/<id>.sqlite.gz + out/manifest.json through build_know_pack.write_pack.
Parsers are tested on small samples in tests/e2e_v724knowbuild.py.
"""
import csv, io, json, os, re, subprocess, sys, tempfile, time, zipfile
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

def openstax_book(repo_dir, collection_path):
    """One OpenStax book (a collection file) → (title, license url, [(chapter title, module title, text)])."""
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
                blocks(body)
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
    for pri, slug, d, path in cols:
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
        "name": "Science & study (OpenStax textbooks)", "name_ar": "العلوم والدراسة (كتب أوبن ستاكس)",
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

def build_quran(a):
    B = _bk()
    txt = B.get("https://tanzil.net/pub/download/index.php?quranType=simple&outType=txt-2&agree=true", 300).decode("utf-8")
    rows, header = quran_rows(txt)
    if len(rows) != 6236: raise SystemExit(f"Quran text: expected 6236 verses, got {len(rows)}")
    B.write_pack(a.out, "quran", rows, {
        "name": "The Quran (Arabic text)", "name_ar": "القرآن الكريم (النص العربي)",
        "license": "Tanzil Project — verbatim copies with credit (the text is not changed)",
        "attribution": "Quran text from the Tanzil Project (tanzil.net), verbatim, one passage per verse. " + " ".join(h for h in header if h)[:600],
        "sources": [{"title": "Tanzil Project", "url": "https://tanzil.net/", "license": "Verbatim copies with credit"}], "retrieved": time.strftime("%Y-%m-%d")})

BUILDERS = {"science": build_science, "health": build_health, "numbers": build_numbers, "cities": build_cities, "cranes": build_cranes, "quran": build_quran}
