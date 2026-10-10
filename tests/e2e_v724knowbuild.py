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
sys.path.insert(0, os.path.join(HERE, "trials"))
import packsearch as PS   # the phone's search (KnowPacks.kt) — the same code the trials measure
def search(db, q, k=5):
    words = PS.terms_of(q)
    if not words: return []
    return [(h["title"], h["text"]) for h in PS.pack_search(db, words, k)]

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

# ---- cars (EPA vehicles.csv + EEA new-car registrations) ----
EPA = """year,make,model,displ,cylinders,trany,drive,VClass,fuelType,atvType,city08,highway08,comb08,range,rangeA,evMotor,tCharger,sCharger,eng_dscr,co2TailpipeGpm,fuelCost08
2024,Toyota,Camry,2.5,4,Automatic (S8),Front-Wheel Drive,Midsize Cars,Regular,,28,39,32,0,,,,,,276,1650
2024,Toyota,Camry,2.5,4,Automatic (AV-S6),Front-Wheel Drive,Midsize Cars,Regular,Hybrid,51,53,52,0,,,,,HEV,170,1000
2024,BYD,Seal,,,Automatic (A1),Rear-Wheel Drive,Midsize Cars,Electricity,EV,130,115,123,354,,230 kW PMSM,,,,0,700
"""
er = S.epa_rows(EPA)
cam = [r for r in er if "Camry" in r["t"]]
check(len(er) == 2 and cam and cam[0]["t"].startswith("Toyota (تويوتا) Camry 2024") and "(1) engine 2.5 L, 4 cyl" in cam[0]["x"] and "(2)" in cam[0]["x"] and "28/39/32 mpg" in cam[0]["x"] and "L/100 km" in cam[0]["x"],
      "Cars (EPA): one passage per model and year with every version, metric next to US units")
seal = [r for r in er if "Seal" in r["t"]][0]
check("صيني" in seal["t"] and "electric range 354 mi (570 km)" in seal["x"] and "230 kW PMSM" in seal["x"] and "MPGe" in seal["x"], "Cars (EPA): an electric car with its range, motor and MPGe; Chinese brands are marked")
eg = [{"Mk": "BYD", "Cn": "SEAL", "Ft": "electric", "Fm": "E", "ec": None, "ep": 230, "m": 2185, "w": 2920, "ew": 0, "er": 570, "z": 165, "n": 5400, "y0": 2023, "y1": 2024},
      {"Mk": "MG", "Cn": "MG4", "Ft": "electric", "Fm": "E", "ec": None, "ep": 150, "m": 1685, "w": 2705, "ew": 0, "er": 435, "z": 160, "n": 41000, "y0": 2022, "y1": 2024},
      {"Mk": "BYD", "Cn": "SEAL", "Ft": "electric", "Fm": "E", "ec": None, "ep": 390, "m": 2260, "w": 2920, "ew": 0, "er": 520, "z": 181, "n": 2100, "y0": 2023, "y1": 2024}]
eu = S.eea_rows(eg)
bs = [r for r in eu if "SEAL" in r["x"]][0]
check(len(eu) == 2 and bs["t"].startswith("BYD (بي واي دي — صيني) Seal") and "(1) electric, 230 kW (308 hp)" in bs["x"] and "390 kW (523 hp)" in bs["x"] and "electric range 570 km (WLTP)" in bs["x"] and "16.5 kWh/100 km" in bs["x"],
      "Cars (EEA): one passage per model with all its European versions (power, range, use, weight), most sold first")
mg = S.eea_merge([{"Mk": "BYD", "Cn": "SEAL", "Ft": "electric", "Fm": "E", "ec": None, "ep": 230, "m": 2180, "w": 2920, "ew": 0, "z": 165, "n": 1000, "y": 2023},
                   {"Mk": "BYD", "Cn": "Seal", "Ft": "Electric", "Fm": "E", "ec": None, "ep": 230, "m": 2200, "w": 2920, "ew": 0, "z": 170, "n": 3000, "y": 2024}])
check(len(mg) == 1 and mg[0]["n"] == 4000 and (mg[0]["y0"], mg[0]["y1"]) == (2023, 2024) and abs(mg[0]["m"] - 2195) < 0.01, "Cars (EEA): one version across the years, figures weighted by the cars registered")
man, db = pack("cars", er + eu)
r = search(db, "BYD Seal range")
check(r and "Seal" in r[0][0], "a car question finds its specs: " + (r[0][0] if r else "nothing"))
r = search(db, "مواصفات تويوتا كامري")
check(r and "Camry" in r[0][0], "an Arabic brand name finds the car: " + (r[0][0] if r else "nothing"))

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

# ---- subject packs: formulas as text, worked examples kept, end-of-chapter exercises left out ----
d2 = tempfile.mkdtemp(); os.makedirs(os.path.join(d2, "modules", "m2")); os.makedirs(os.path.join(d2, "collections"))
open(os.path.join(d2, "collections", "university-physics-volume-1.collection.xml"), "w").write("""<col:collection xmlns:col="http://cnx.rice.edu/collxml" xmlns:md="http://cnx.rice.edu/mdml"><col:metadata><md:title>University Physics Volume 1</md:title><md:license url="http://creativecommons.org/licenses/by/4.0/"/></col:metadata>
<col:content><col:subcollection><md:title>Motion Along a Straight Line</md:title><col:content><col:module document="m2"/></col:content></col:subcollection></col:content></col:collection>""")
open(os.path.join(d2, "modules", "m2", "index.cnxml"), "w").write("""<document xmlns="http://cnx.rice.edu/cnxml" xmlns:m="http://www.w3.org/1998/Math/MathML"><title>Motion with Constant Acceleration</title><content>
<para id="p1">For constant acceleration the final velocity is <m:math><m:mrow><m:msub><m:mi>v</m:mi><m:mi>f</m:mi></m:msub><m:mo>=</m:mo><m:msub><m:mi>v</m:mi><m:mn>0</m:mn></m:msub><m:mo>+</m:mo><m:mi>a</m:mi><m:mi>t</m:mi></m:mrow></m:math> where t is the elapsed time.</para>
<equation id="e1"><m:math><m:mrow><m:mi>x</m:mi><m:mo>=</m:mo><m:msub><m:mi>x</m:mi><m:mn>0</m:mn></m:msub><m:mo>+</m:mo><m:msub><m:mi>v</m:mi><m:mn>0</m:mn></m:msub><m:mi>t</m:mi><m:mo>+</m:mo><m:mfrac><m:mn>1</m:mn><m:mn>2</m:mn></m:mfrac><m:mi>a</m:mi><m:msup><m:mi>t</m:mi><m:mn>2</m:mn></m:msup></m:mrow></m:math></equation>
<example id="ex1"><title>Calculating Displacement of an Accelerating Car</title><exercise><problem><para>A car starts from rest and accelerates at 2.0 m/s² for 5.0 s. How far does it travel?</para></problem>
<solution><para>Use x = ½ a t² = 0.5 × 2.0 × 25 = 25 m. The car travels 25 meters.</para></solution></exercise></example>
<exercise id="q1"><problem><para>End of chapter: a bus accelerates for 10 s, find its speed.</para></problem></exercise></content></document>""")
check(S.openstax_lang(os.path.join(d2, "collections", "university-physics-volume-1.collection.xml")) == "en", "OpenStax: an English book is recognised (translations are left out)")
title2, lic2, mods2 = S.openstax_book(d2, os.path.join(d2, "collections", "university-physics-volume-1.collection.xml"), keep_math=True)
t2 = mods2[0][2] if mods2 else ""
check("v_f = v_0 + a t" in t2 and "x = x_0 + v_0 t + 1/2 a t^2" in t2, "Subject packs: formulas kept as plain text: " + t2[:160])
check("Example: Calculating Displacement" in t2 and "The car travels 25 meters" in t2 and "accelerates at 2.0" in t2, "Subject packs: a worked example (question and solution) is kept")
check("End of chapter" not in t2, "Subject packs: end-of-chapter exercises (no answers) are left out")
sr = S.subject_rows(title2, "https://openstax.org/details/books/university-physics-volume-1", mods2)
check(sr and sr[0]["t"] == "University Physics Volume 1 — Motion Along a Straight Line — Motion with Constant Acceleration", "Subject packs: passages titled book — chapter — section")
man, db = pack("physics", sr)
r = search(db, "how far does a car travel accelerating from rest")
check(r and "Constant Acceleration" in r[0][0], "a physics question finds the worked example")

# ---- geography (Factbook geography + GeoNames physical features) ----
G = ["\t".join(["360713", "Nile", "Nile", "Nil,Nilo,Nile River,Le Nil,Nilen,Nijl,Neilos,ナイル川,نهر النيل", "30.1", "31.2", "H", "STM", "EG", "", "11", "", "", "", "0", "", "15", "Africa/Cairo", "2020-01-01"]),
     "\t".join(["1283416", "Mount Everest", "Mount Everest", "Chomolungma,Sagarmatha,エベレスト", "27.988", "86.925", "T", "PK", "NP", "", "01", "", "", "", "0", "8848", "8812", "Asia/Kathmandu", "2020-01-01"]),
     "\t".join(["999", "Small Creek", "Small Creek", "", "40.0", "-75.0", "H", "STM", "US", "", "PA", "", "", "", "0", "", "50", "America/New_York", "2020-01-01"]),
     "\t".join(["361058", "Cairo", "Cairo", "القاهرة", "30.04", "31.24", "P", "PPLC", "EG", "", "11", "", "", "", "9000000", "", "23", "Africa/Cairo", "2020-01-01"])]
gr = S.geo_feature_rows(G, {"EG": "Egypt", "NP": "Nepal", "US": "United States"}, {"EG.11": "Cairo Governorate"})
check(len(gr) == 2 and gr[0]["t"] == "Nile (نهر النيل) — river, Egypt" and "Mount Everest — peak, Nepal" == gr[1]["t"] and "elevation 8,848 m" in gr[1]["x"],
      "Geography: well-known features (Arabic name, many languages, high peaks) with elevation; small creeks and cities left out")
gname, grows = B.country_rows("africa", "eg", {"Geography": {"Area": {"total": {"text": "1,001,450 sq km"}}, "Climate": {"text": "desert; hot, dry summers with moderate winters"}}})
check(any("Climate" in r["t"] and "desert" in r["x"] for r in grows), "Geography: each country's geography from the Factbook")
gn, gr2 = B.country_rows("africa", "eg", {"Government": {"Country name": {"conventional short form": {"text": "Egypt"}}}, "Geography": {"Climate": {"text": "desert"}}})
check(gn == "Egypt" and any(r["t"].startswith("Egypt — ") for r in gr2), "Geography: rows carry the country's name, not its code")
man, db = pack("geography", gr + grows)
r = search(db, "how high is mount everest")
check(r and "Everest" in r[0][0], "a geography question finds the feature")
r = search(db, "نهر النيل")
check(r and "Nile" in r[0][0], "an Arabic name finds it too")

# ---- coding (Python reST, MDN / Kotlin Markdown): code blocks kept whole, with their lines ----
MD = """---
title: Array.prototype.map()
slug: Web/JavaScript/Reference/Global_Objects/Array/map
---

{{JSRef}}

The **`map()`** method of {{jsxref("Array")}} instances creates a new array populated with the results of calling a provided function on every element.

## Syntax

```js
map(callbackFn)
map(callbackFn, thisArg)
```

## Examples

### Mapping an array of numbers to square roots

```js
const numbers = [1, 4, 9];
const roots = numbers.map((num) => Math.sqrt(num));
// roots is now     [1, 2, 3]
```
"""
ms = S.md_sections(MD)
check([p for p, _ in ms] == ["", "Syntax", "Examples › Mapping an array of numbers to square roots"], "Coding: Markdown sections with their heading path: " + str([p for p, _ in ms]))
allb = "\n".join(b for _, b in ms)
check("of Array instances" in allb and "{{" not in allb and "slug:" not in allb, "Coding: MDN macros and front matter cleaned")
dr = S.doc_rows("MDN JavaScript — Array.prototype.map()", ms, "https://developer.mozilla.org/x")
code = [r for r in dr if "Math.sqrt" in r["x"]][0]
check("const numbers = [1, 4, 9];\nconst roots" in code["x"] and "// roots is now     [1, 2, 3]" in code["x"], "Coding: code keeps its lines and spacing")
RST = """Data Structures
***************

More on Lists
=============

The list data type has some more methods. Here are all of the methods of list objects:

.. method:: list.append(x)
   :noindex:

   Add an item to the end of the list.  Similar to ``a[len(a):] = [x]``.

An example that uses most of the list methods::

   >>> fruits = ['orange', 'apple', 'pear']
   >>> fruits.count('apple')
   1

See :func:`sorted` and :ref:`the tutorial <tut-sort>`.
"""
rs = S.rst_sections(RST)
check(rs and rs[-1][0] == "Data Structures › More on Lists" and "method: list.append(x)" in rs[-1][1] and "See sorted and the tutorial." in rs[-1][1] and ">>> fruits.count('apple')" in rs[-1][1],
      "Coding: Python reST headings, roles and examples read: " + (rs[-1][0] if rs else "nothing"))
man, db = pack("coding", dr + S.doc_rows("Python docs", rs, "https://docs.python.org/3/tutorial/datastructures.html"))
r = search(db, "how to add an item to the end of a python list")
check(r and "Python docs" in r[0][0], "a coding question finds the docs: " + (r[0][0] if r else "nothing"))
txt = db.execute("SELECT text FROM passages WHERE text LIKE '%Math.sqrt%'").fetchone()[0]
check("\nconst roots" in txt, "the pack keeps the code's line breaks for the phone")

print("ALL PASSED" if not fails else f"{fails} FAILED")
sys.exit(1 if fails else 0)
