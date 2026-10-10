"""v6.16 — the general-knowledge pack builder (tools/build_know_pack.py + tools/know_sources.py): each source's parser on a
small sample, and the search database it writes, searched exactly as the phone does (KnowPacks.kt: normalised words, common
words dropped, prefix match, BM25 from FTS4 matchinfo('pcnalx')).
  python3 tests/e2e_v724knowbuild.py
"""
import gzip, json, math, os, sqlite3, struct, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import build_know_pack as B
import know_sources as S
from build_map_pack import normalize

fails = 0
def check(ok, what):
    global fails
    print(("PASS " if ok else "FAIL ") + what)
    if not ok: fails += 1

STOP = set("the a an of in on at to for and or is are was were be by with from as that this these those it its into about what which who whom whose when where why how do does did can could will would should may might than then there their them they he she his her you your i we our not no tell me please explain في من على عن الى هو هي ما ماذا متى اين كيف كم هل التي الذي الذين او ثم مع كان كانت هذا هذه ذلك تلك".split())
def stem(w):
    if len(w) <= 4 or not w.isascii() or not w.isalpha(): return w
    for suf in ("ies", "ing", "ed", "es", "s"):
        if w.endswith(suf) and len(w) - len(suf) >= 4: return w[: -len(suf)]
    return w
def bm25(blob):
    ints = struct.unpack("%dI" % (len(blob) // 4), blob)
    p, c, n, avg = ints[0], ints[1], ints[2], max(1, ints[3]); ln = ints[3 + c]; x0 = 3 + 2 * c; s = 0.0
    for i in range(p):
        o = x0 + 3 * (i * c); tf, df = ints[o], ints[o + 2]
        if tf <= 0: continue
        s += math.log(1 + (n - df + 0.5) / (df + 0.5)) * (tf * 2.4) / (tf + 1.4 * (0.3 + 0.7 * ln / avg))
    return s
def search(db, q, k=5):
    words = list(dict.fromkeys(stem(w) for w in normalize(q).split() if len(w) >= 2 and w not in STOP))[:10]
    if not words: return []
    m = " OR ".join(w + "*" for w in words)
    rows = [(r, bm25(mi)) for r, mi in db.execute("SELECT rowid, matchinfo(passages_fts, 'pcnalx') FROM passages_fts WHERE passages_fts MATCH ?", (m,))]
    rows.sort(key=lambda t: -t[1])
    return [db.execute("SELECT title, text FROM passages WHERE id=?", (r,)).fetchone() for r, _ in rows[:k]]

def pack(pid, rows, extra=None):
    d = tempfile.mkdtemp()
    B.write_pack(d, pid, rows, {"name": pid, **(extra or {})})
    man = json.load(open(os.path.join(d, "manifest.json")))
    f = man["files"][0]
    raw = gzip.open(os.path.join(d, f["name"])).read()
    p = os.path.join(d, pid + ".sqlite"); open(p, "wb").write(raw)
    return man, sqlite3.connect(p)

# ---- MedlinePlus ----
MED = b"""<?xml version="1.0"?><health-topics><health-topic title="Anemia" url="https://medlineplus.gov/anemia.html" language="English">
<also-called>Iron-poor blood</also-called><full-summary>&lt;p&gt;Anemia is a condition in which you lack enough healthy red blood cells to carry oxygen to your body's tissues. The most common cause is iron deficiency.&lt;/p&gt;</full-summary></health-topic>
<health-topic title="Anemia" url="x" language="Spanish"><full-summary>Anemia es</full-summary></health-topic>
<health-topic title="High Blood Pressure" url="https://medlineplus.gov/highbloodpressure.html" language="English"><also-called>Hypertension</also-called><full-summary>&lt;p&gt;Blood pressure is the force of your blood pushing against the walls of your arteries. High blood pressure (hypertension) often has no symptoms.&lt;/p&gt;</full-summary></health-topic></health-topics>"""
rows = S.medline_rows(MED)
check(len(rows) == 2 and rows[0]["t"] == "Health — Anemia" and "Iron-poor blood" in rows[0]["x"] and "<p>" not in rows[0]["x"], "MedlinePlus: English topics only, HTML removed, 'also called' kept")
man, db = pack("health", rows)
check(man["format"] == 2 and man["files"][0]["gz"] and len(man["files"][0]["sha256"]) == 64, "the pack is one compressed database with its SHA-256")
r = search(db, "What causes anemia?")
check(r and r[0][0] == "Health — Anemia", "'What causes anemia?' finds the anemia passage (the phone's search, BM25)")
r = search(db, "hypertension symptoms")
check(r and "High Blood Pressure" in r[0][0], "a synonym from 'also called' finds the topic")

# ---- World Bank ----
rows = S.numbers_rows({"EGY": "Egypt, Arab Rep.", "JPN": "Japan"}, {("EGY", "SP.POP.TOTL"): (116538258, "2024"), ("EGY", "NY.GDP.MKTP.CD"): (389.06e9, "2024"),
                       ("EGY", "FP.CPI.TOTL.ZG"): (28.3, "2024"), ("JPN", "SP.POP.TOTL"): (124000000, "2024")})
check(rows[0]["t"] == "Egypt — key figures (World Bank)" and "population: 116.54 million (2024)" in rows[0]["x"] and "GDP: US$ 389.06 billion (2024)" in rows[0]["x"] and "inflation (consumer prices): 28.3% (2024)" in rows[0]["x"], "World Bank: Egypt first, numbers readable with their year: " + rows[0]["x"][:120])
man, db = pack("numbers", rows)
r = search(db, "what is the inflation in Egypt?")
check(r and r[0][0].startswith("Egypt"), "'inflation in Egypt' finds Egypt's figures")

# ---- GeoNames ----
CI = "EG\tEGY\t818\tEG\tEgypt\tCairo\t1001450\t106437241\tAF\t.eg\tEGP\tPound\t20\t#####\t^(\\d{5})$\tar-EG,en,fr\t357994\tLY,SD,IL,PS\t\n"
AD = "EG.06\tAlexandria\tAlexandria\t361058\n"
CT = "\t".join(["361058", "Alexandria", "Alexandria", "Alexandrie,الإسكندرية,Iskandariyya", "31.20176", "29.91582", "P", "PPLA", "EG", "", "06", "", "", "", "3811516", "", "34", "Africa/Cairo", "2024-01-01"]) + "\n"
rows = S.cities_rows(CT, CI, AD)
city = [x for x in rows if x["t"].startswith("Alexandria")][0]
check("الإسكندرية" in city["t"] and "Population 3,811,516" in city["x"] and "Egypt, Alexandria" in city["x"], "GeoNames: a city with its Arabic name, region and population: " + city["x"][:100])
check(any("capital Cairo" in x["x"] and "Pound (EGP)" in x["x"] for x in rows), "GeoNames: each country's capital and currency")
man, db = pack("cities", rows)
r = search(db, "كم عدد سكان الاسكندريه")
check(r and "Alexandria" in r[0][0], "an Arabic question finds the city by its Arabic name (any spelling of ة/ه, إ/ا)")

# ---- OSHA (eCFR XML) ----
EC = b"""<ECFR><DIV5 N="1926"><DIV6 N="CC"><DIV8 N="1926.1408" TYPE="SECTION"><HEAD>\xc2\xa7 1926.1408 Power line safety (up to 350 kV)&#x2014;assembly and disassembly.</HEAD>
<P>(a) Hazard assessments and precautions inside the work zone. Before assembling or disassembling equipment, the employer must determine if any part of the equipment could get closer than 20 feet to a power line.</P></DIV8>
<DIV8 N="1926.1412" TYPE="SECTION"><HEAD>\xc2\xa7 1926.1412 Inspections.</HEAD><P>(d) Each shift. A competent person must begin a visual inspection prior to each shift the equipment will be used.</P></DIV8></DIV6></DIV5></ECFR>"""
rows = S.ecfr_rows(EC)
check(len(rows) == 2 and rows[0]["t"].startswith("OSHA § 1926.1408") and rows[0]["u"].endswith("section-1926.1408"), "OSHA: each section with its number, title and link")
man, db = pack("cranes", rows)
r = search(db, "how close can a crane get to a power line?")
check(r and "1926.1408" in r[0][0], "'how close can a crane get to a power line' finds § 1926.1408")
r = search(db, "crane inspection every shift")
check(r and "1926.1412" in r[0][0], "'inspection every shift' finds § 1926.1412")

# ---- OSHA (govinfo yearly CFR XML) ----
GV = """<CFRDOC><PART><SECTION><SECTNO>§ 1926.1408</SECTNO><SUBJECT>Power line safety (up to 350 kV)—assembly and disassembly.</SUBJECT>
<P>(a) Before assembling equipment, the employer must determine if any part of the equipment could get closer than 20 feet to a power line.</P></SECTION>
<SECTION><SECTNO>§ 1926.1500</SECTNO><SUBJECT>Something else.</SUBJECT><P>Not a crane rule.</P></SECTION>
<SECTION><SECTNO>§ 1910.179</SECTNO><SUBJECT>Overhead and gantry cranes.</SUBJECT><P>(j) Inspection. Frequent inspection daily to monthly intervals.</P></SECTION></PART></CFRDOC>""".encode()
rows = S.govinfo_rows(GV)
check(len(rows) == 2 and rows[0]["t"].startswith("OSHA § 1926.1408") and rows[1]["t"].startswith("OSHA § 1910.179") and not any("1926.1500" in r["t"] for r in rows), "OSHA (govinfo): only the crane, rigging and sling sections are kept")

# ---- Quran (Tanzil txt-2) ----
QT = "1|1|بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\n1|2|الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ\n2|255|اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ\n\n# Tanzil Quran Text (Simple, Version 1.1)\n# Copyright (C) 2007-2025 Tanzil Project\n"
rows, header = S.quran_rows(QT)
check(len(rows) == 3 and rows[2]["t"] == "سورة البقرة — الآية 255 (2:255)" and rows[1]["x"] == "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ" and any("Tanzil" in h for h in header), "Quran: verse text kept exactly, titled with surah and number; Tanzil's notice kept")
man, db = pack("quran", rows)
r = search(db, "لا تأخذه سنة ولا نوم")
check(r and "2:255" in r[0][0], "a verse is found from its words without diacritics (آية الكرسي)")

# ---- التفسير الميسر (QUL tafsir 38) ----
INTRO = "تسمية السورة\n\n• سميت الذاريات؛ لتفردها وافتتاحها بقَسَم الله بالذاريات.\n\nمن مقاصد السورة\n\n• تأكيدُ وقوعِ البعث والجزاء."
T16 = "أقسم الله تعالى بالرياح المثيرات للتراب، فالسحب الحاملات ثِقْلًا عظيمًا من الماء."
items = [{"surah": "51", "ayah": str(v), "text": INTRO + "\n\n[التفسير]\n\n" + T16} for v in range(1, 7)] + [{"surah": "51", "ayah": "7", "text": "وأقسم الله بالسماء ذات الطرق الحسنة."}]
tr = S.tafsir_rows(51, items, {(51, 1): "وَالذَّارِيَاتِ ذَرْوًا", (51, 7): "وَالسَّمَاءِ ذَاتِ الْحُبُكِ"})
check(len(tr) == 3 and tr[0]["t"] == "التفسير الميسر — مقدمة سورة الذاريات" and tr[0]["x"] == INTRO, "Tafsir: the surah's introduction once, word for word, though the source repeats it")
check(tr[1]["t"].endswith("الآيات 1–6 (51:1-6)") and tr[1]["_n"] == 6 and tr[1]["x"].endswith(T16) and "﴿وَالذَّارِيَاتِ ذَرْوًا﴾ (1)" in tr[1]["x"], "Tafsir: verses explained together are one passage, with the verse text quoted")
check(tr[2]["t"].endswith("الآية 7 (51:7)") and tr[2]["x"].startswith("﴿وَالسَّمَاءِ ذَاتِ الْحُبُكِ﴾"), "Tafsir: a single verse with its own explanation")
i5, t5 = S.split_intro("تسمية السورة\n\n• سميت المائدة.\n\nمن مقاصد السورة\n\n• بيان العقود.\n\nيا أيها الذين صدَّقوا الله ورسوله، أتِمُّوا عهود الله.")
check(i5.endswith("• بيان العقود.") and t5.startswith("يا أيها الذين"), "Tafsir: an introduction without the [التفسير] mark is still separated (al-Ma'idah)")
man, db = pack("quran", rows + [{k: v for k, v in r.items() if k != "_n"} for r in tr])
r = search(db, "ما معنى الذاريات")
check(r and "الذاريات" in r[0][0], "a question about a surah finds its tafsir: " + (r[0][0] if r else "nothing"))

# ---- الفقه الميسر (turath.io book JSON) ----
BOOK = {"_id": 5913, "meta": {"name": "الفقه الميسر"}, "indexes": {"headings": [
    {"title": "كتاب الطهارة", "level": 1, "page": 1}, {"title": "باب المياه", "level": 2, "page": 1},
    {"title": "كتاب الصلاة", "level": 1, "page": 2}, {"title": "باب شروط الصلاة", "level": 2, "page": 2}]},
  "pages": [{"vol": "1", "page": 15, "text": "<span data-type=\"title\">باب المياه</span><br>الماء الطهور هو الباقي على خلقته. &quot;قال تعالى&quot;"},
            {"vol": "2", "page": 7, "text": "<p>من شروط الصلاة: دخول الوقت، والطهارة من الحدث.</p>"}]}
fr = S.fiqh_rows(BOOK, "الفقه الميسر", "")
check(len(fr) == 2 and fr[0]["t"] == "الفقه الميسر — كتاب الطهارة › باب المياه (ج1 ص15)" and "الماء الطهور هو الباقي على خلقته" in fr[0]["x"] and '"قال تعالى"' in fr[0]["x"] and "<" not in fr[0]["x"], "Fiqh: tags out, every word kept, titled with book, chapter path, volume and page")
check(fr[1]["t"] == "الفقه الميسر — كتاب الصلاة › باب شروط الصلاة (ج2 ص7)", "Fiqh: a new chapter replaces the old path")
hits = [{"book_id": 1, "meta": json.dumps({"book_name": "الفقه الميسر في ضوء الكتاب والسنة", "author_name": "مجمع الملك فهد"})},
        {"book_id": 2, "meta": json.dumps({"book_name": "شرح الفقه الميسر وأدلته من الكتاب والسنة المطهرة", "author_name": "x"})},
        {"book_id": 3, "meta": {"book_name": "الفقه الميسر", "author_name": "عبد الله بن محمد الطيار وآخرون"}}]
check(S.turath_pick(hits, "الفقه الميسر", "ضوء", "الطيار") == (3, "الفقه الميسر") and S.turath_pick(hits, "الفقه الميسر في ضوء الكتاب والسنة", "", "")[0] == 1,
      "Fiqh: each book is found on turath by its exact title (not a longer book that mentions it)")
man, db = pack("fiqh", fr)
r = search(db, "ما هي شروط الصلاة؟")
check(r and "شروط الصلاة" in r[0][0], "a fiqh question finds its chapter: " + (r[0][0] if r else "nothing"))

# ---- hadith (hadith-api, with rulings) ----
check(S.grade_ar("Isnaad Sahih") == "إسناده صحيح" and S.grade_ar("Very Daif") == "ضعيف جدًا" and S.grade_ar("Sahih - Agreed Upon") == "صحيح — متفق عليه"
      and S.grade_ar("Sahih Muslim (1480)") == "صحيح مسلم (1480)" and S.grade_ar("-") == "" and S.grade_ar("Odd wording") == "Odd wording (Odd wording)", "Hadith: rulings in Arabic terms; an unknown wording keeps the original")
HB = {"hadiths": [{"hadithnumber": 6, "text": "عَنْ رَسُولِ اللَّهِ صلى الله عليه وسلم قَالَ إِنَّ هَذِهِ الْحُشُوشَ مُحْتَضَرَةٌ فَإِذَا أَتَى أَحَدُكُمُ الْخَلاَءَ فَلْيَقُلْ أَعُوذُ بِاللَّهِ مِنَ الْخُبُثِ وَالْخَبَائِثِ",
                   "grades": [{"name": "Al-Albani", "grade": "Sahih"}, {"name": "Zubair Ali Zai", "grade": "Isnaad Sahih"}]}, {"hadithnumber": 7, "text": " ", "grades": []}]}
hr = S.hadith_rows("abudawud", "سنن أبي داود", HB)
check(len(hr) == 1 and hr[0]["t"] == "سنن أبي داود — الحديث 6" and hr[0]["x"].endswith("الحكم: الألباني: صحيح؛ زبير علي زئي: إسناده صحيح") and hr[0]["x"].startswith("عَنْ رَسُولِ اللَّهِ"), "Hadith: text exactly as published, then each scholar's ruling; empty entries skipped")
check(S.hadith_rows("bukhari", "صحيح البخاري", {"hadiths": [{"hadithnumber": 1, "text": "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ", "grades": []}]})[0]["x"].endswith("الحكم: صحيح — من صحيح البخاري"), "Hadith: al-Bukhari and Muslim are marked sahih by their book")
man, db = pack("hadith", hr)
r = search(db, "ماذا اقول عند دخول الخلاء")
check(r and "6" in r[0][0], "a hadith is found from plain words without diacritics: " + (r[0][0] if r else "nothing"))

# ---- OpenStax (CNXML) ----
d = tempfile.mkdtemp(); os.makedirs(os.path.join(d, "modules", "m1")); os.makedirs(os.path.join(d, "collections"))
open(os.path.join(d, "collections", "biology-2e.collection.xml"), "w").write("""<col:collection xmlns:col="http://cnx.rice.edu/collxml" xmlns:md="http://cnx.rice.edu/mdml"><col:metadata><md:title>Biology 2e</md:title><md:license url="http://creativecommons.org/licenses/by/4.0/"/></col:metadata>
<col:content><col:subcollection><md:title>The Cell</md:title><col:content><col:module document="m1"/></col:content></col:subcollection></col:content></col:collection>""")
open(os.path.join(d, "modules", "m1", "index.cnxml"), "w").write("""<document xmlns="http://cnx.rice.edu/cnxml" xmlns:m="http://www.w3.org/1998/Math/MathML"><title>Mitochondria</title><content>
<para id="p1">Mitochondria are often called the powerhouses of the cell because they make adenosine triphosphate (ATP), the cell's main energy-carrying molecule.</para>
<para id="p2">The formula <m:math><m:mi>x</m:mi></m:math> is left out of the text but the sentence stays readable here.</para>
<exercise><problem><para>Which organelle makes ATP? This exercise is left out.</para></problem></exercise></content></document>""")
title, lic, mods = S.openstax_book(d, os.path.join(d, "collections", "biology-2e.collection.xml"))
check(title == "Biology 2e" and "/by/4.0" in lic and mods and mods[0][1] == "Mitochondria" and "powerhouses" in mods[0][2] and "exercise is left out" not in mods[0][2], "OpenStax: the book, its licence, each section's text without exercises or formulas")

print("ALL PASSED" if not fails else f"{fails} FAILED")
sys.exit(1 if fails else 0)
