#!/usr/bin/env python3
"""v6.15 — builds a whole-country offline map pack for Attune (run by .github/workflows/map-pack.yml).

  region <code.poly> <out.geojson>            Geofabrik's country outline -> GeoJSON (for `pmtiles extract --region`)
  places <country.osm.pbf> <out.sqlite>       every named place, street, shop, amenity -> SQLite + FTS4 search index
  overture <code> <region.geojson> <sqlite>   v6.20: + Overture Maps' places of the country (shops, clinics, compounds…)
  find <sqlite> <out.bin>                     v6.27: the ONLINE search file — the index cut into small pieces by word start
  manifest <code> <name> <date> <dir> <files…> -> <code>-manifest.json with sizes and SHA-256
  assets <fonts_dir> <sprites_dir> <outdir>   fonts + icons -> map-assets.zip + assets-manifest.json

The search key's normalisation must equal offlinemap.js normalize() and MapPacks.kt normalize().
Tested by tests/unit/v722maps.test.mjs (the normalisation) and tests/e2e_v722mapbuilder.py.
"""
import hashlib, json, math, os, re, sqlite3, sys, unicodedata, zipfile

AR_DIAC = re.compile("[ً-ْـ\u06D6-\u06ED]")


def normalize(s):
    t = (s or "").lower()
    t = AR_DIAC.sub("", t.replace("\u0670", "ا"))   # the dagger alef (ٰ) is an alef
    for a, b in (("أ", "ا"), ("إ", "ا"), ("آ", "ا"), ("ٱ", "ا"), ("ى", "ي"), ("ة", "ه"), ("ؤ", "و"), ("ئ", "ي"), ("ı", "i")):
        t = t.replace(a, b)
    t = t.translate({ord(c): str(i) for i, c in enumerate("٠١٢٣٤٥٦٧٨٩")}).translate({ord(c): str(i) for i, c in enumerate("۰۱۲۳۴۵۶۷۸۹")})   # ٩٠ = 90
    t = "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")
    t = "".join(c if unicodedata.category(c)[0] in "LN" else " " for c in t)
    return " ".join(t.split())


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


# ---- the country outline -------------------------------------------------------------------------------------
def poly_to_geojson(text):
    """Osmosis .poly (Geofabrik) -> GeoJSON MultiPolygon. Sections starting with '!' are holes."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    polys, i = [], 1
    while i < len(lines) and lines[i] != "END":
        hole = lines[i].startswith("!")
        i += 1
        ring = []
        while lines[i] != "END":
            x, y = lines[i].split()[:2]
            ring.append([float(x), float(y)])
            i += 1
        i += 1
        if ring and ring[0] != ring[-1]:
            ring.append(ring[0])
        if hole and polys:
            polys[-1].append(ring)
        elif not hole:
            polys.append([ring])
    return {"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {}, "geometry": {"type": "MultiPolygon", "coordinates": polys}}]}


# ---- the search index ------------------------------------------------------------------------------------------
PLACE_RANK = {"city": 95, "town": 85, "suburb": 75, "borough": 75, "village": 70, "quarter": 65, "neighbourhood": 65,
              "hamlet": 55, "locality": 50, "isolated_dwelling": 40, "island": 60, "square": 45}
POI_KEYS = ("amenity", "shop", "tourism", "office", "craft", "leisure", "healthcare", "historic", "aeroway", "railway",
            "public_transport", "man_made", "natural", "building")


def kind_and_rank(tags):
    """-> (kind, rank) for a feature worth finding, else None. Higher rank = shown first."""
    if "place" in tags:
        p = tags["place"]
        return "place/" + p, PLACE_RANK.get(p, 45)
    if tags.get("highway") in ("motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified",
                               "living_street", "pedestrian", "service", "road", "track"):
        return "street/" + tags["highway"], 30 if tags["highway"] not in ("motorway", "trunk", "primary") else 40
    # v6.27 (Ali: "compounds like Google Maps"): a gated compound is usually drawn as a named residential area
    # (landuse=residential, often residential=gated) — it was left out of search before
    # (a plain named residential area is often a town or a resort — only a gated one is called a compound)
    if tags.get("residential") == "gated" or tags.get("gated") == "yes":
        return "place/compound", 62
    if tags.get("landuse") == "residential":
        return "place/residential_area", 60
    if tags.get("railway") in ("station", "halt", "tram_stop") or tags.get("public_transport") == "station":
        return "transport/station", 50
    if tags.get("aeroway") in ("aerodrome", "terminal"):
        return "transport/airport", 60
    for k in POI_KEYS:
        v = tags.get(k)
        if not v or v == "no":
            continue
        if k == "building" and v in ("yes", "house", "residential", "apartments", "roof"):
            continue                       # a named ordinary building is not a place people search for
        return f"{k}/{v}", 35 if k in ("shop", "craft", "office") else 42
    return None


def open_index(path):
    if os.path.exists(path):
        os.remove(path)
    db = sqlite3.connect(path)
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("PRAGMA synchronous=OFF")
    db.execute("CREATE TABLE places(id INTEGER PRIMARY KEY, name TEXT, name_ar TEXT, name_en TEXT, kind TEXT, lat REAL, lon REAL, rank INTEGER)")
    db.execute('CREATE VIRTUAL TABLE places_fts USING fts4(key, prefix="2,3")')
    return db


class Index:
    """Collects places; streets with the same name within ~1 km are kept once."""
    def __init__(self, path):
        self.db, self.n, self.seen = open_index(path), 0, set()

    def add(self, tags, lat, lon):
        name = tags.get("name") or tags.get("name:ar") or tags.get("name:en")
        if not name:
            return
        kr = kind_and_rank(tags)
        if not kr:
            return
        kind, rank = kr
        if kind.startswith("street/"):
            k = (normalize(name), round(lat, 2), round(lon, 2))
            if k in self.seen:
                return
            self.seen.add(k)
        key = normalize(" ".join(x for x in (name, tags.get("name:ar", ""), tags.get("name:en", ""), tags.get("alt_name", ""), tags.get("old_name", "")) if x))
        if not key:
            return
        self.n += 1
        self.db.execute("INSERT INTO places VALUES (?,?,?,?,?,?,?,?)", (self.n, name, tags.get("name:ar", ""), tags.get("name:en", ""), kind, round(lat, 6), round(lon, 6), rank))
        self.db.execute("INSERT INTO places_fts(rowid, key) VALUES (?,?)", (self.n, key))

    def close(self):
        self.db.execute("CREATE INDEX places_kind ON places(kind, lat, lon)")   # "Fuel near me" without a full scan
        self.db.commit()
        self.db.execute("INSERT INTO places_fts(places_fts) VALUES('optimize')")
        self.db.commit()
        self.db.execute("VACUUM")
        self.db.close()
        return self.n


def build_places(pbf, out):
    import osmium  # pip install osmium

    idx = Index(out)

    class H(osmium.SimpleHandler):
        def node(self, n):
            if "name" in n.tags or "name:ar" in n.tags:
                idx.add(dict(n.tags), n.location.lat, n.location.lon)

        def way(self, w):
            if not ("name" in w.tags or "name:ar" in w.tags):
                return
            try:
                pts = [(nd.lat, nd.lon) for nd in w.nodes if nd.location.valid()]
            except Exception:
                return
            if pts:
                mid = pts[len(pts) // 2] if "highway" in w.tags else (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
                idx.add(dict(w.tags), mid[0], mid[1])

    # big countries (the USA's named extract is 3.4 GB) keep the node positions in a file, not in memory: the runner's
    # 16 GB was not enough and it was shut down
    nodes = out + ".nodes"
    big = os.path.getsize(pbf) > 1_000_000_000
    try:
        H().apply_file(pbf, locations=True, idx=("sparse_file_array," + nodes) if big else "flex_mem")
    finally:
        if os.path.exists(nodes):
            os.remove(nodes)
    return idx.close()


# ---- v6.20: more places from Overture Maps -----------------------------------------------------------------------
# Ali: "a lot of places is not in the map". OpenStreetMap is thin in Egypt for shops, clinics and compounds; Overture
# Maps' Places (Meta, Microsoft, Foursquare, AllThePlaces — CDLA-Permissive-2.0 / Apache-2.0 / CC0, commercial use OK)
# add them. Measured on Cairo + Giza (Oct 2026): 148,524 places, 88,042 with confidence ≥ 0.5 — Palm Hills, Madinaty,
# Mall of Arabia, SODIC, B.TECH, Seoudi… Only places with a commercial-safe licence, a real name (no phone-number
# adverts), confidence ≥ 0.5, open, and in this country are added; a name already in the index nearby is kept once.
OVERTURE_BUCKET = "overturemaps-us-west-2"
OVERTURE_OK = {"CDLA-Permissive-2.0", "CDLA-Permissive-1.0", "Apache-2.0", "CC0-1.0", "CC-BY-4.0", "ODbL-1.0", "MIT"}
OV_KIND = {"gas_station": "amenity/fuel", "fueling_station": "amenity/fuel", "fast_food_restaurant": "amenity/fast_food",
           "coffee_shop": "amenity/cafe", "cafe": "amenity/cafe", "pharmacy_and_drug_store": "amenity/pharmacy", "pharmacy": "amenity/pharmacy",
           "hospital": "amenity/hospital", "atm": "amenity/atm", "bank_or_credit_union": "amenity/bank", "bank": "amenity/bank",
           "muslim_place_of_worship": "amenity/place_of_worship", "christian_place_of_worship": "amenity/place_of_worship",
           "place_of_worship": "amenity/place_of_worship"}
SPAM = re.compile(r"\d{7,}|\b01[0125]\d{8}\b|\+20\d")
CLOSED = {"permanently_closed", "closed", "temporarily_closed"}
AR_ANY = re.compile("[\u0600-\u06FF]")


def ov_kind(cat):
    """Overture's category -> the index's kind (OpenStreetMap's words where the map's buttons look for them)."""
    c = cat or ""
    if c in OV_KIND:
        return OV_KIND[c]
    if c.endswith("restaurant"):
        return "amenity/restaurant"
    if c.endswith("clinic") or c in ("dentist", "doctor"):
        return "amenity/clinic"
    return "poi/" + (c or "place")


def ov_keep(r, country):
    """One Overture row (names, basic_category, confidence, addresses, sources, operating_status) -> keep it?"""
    name = ((r.get("names") or {}).get("primary") or "").strip()
    if not name or len(name) > 90 or SPAM.search(name):
        return False
    if (r.get("confidence") or 0) < 0.5 or (r.get("operating_status") or "") in CLOSED:
        return False
    if not any((s or {}).get("license") in OVERTURE_OK for s in (r.get("sources") or [])):
        return False
    ad = r.get("addresses") or []
    return bool(ad) and str((ad[0] or {}).get("country") or "").upper() == country.upper()   # an empty country (None) is not this one


def overture_release(fs):
    """The newest Overture release folder (release/YYYY-MM-DD.N/)."""
    from pyarrow.fs import FileSelector
    rel = [i.path.split("/")[-1] for i in fs.get_file_info(FileSelector(OVERTURE_BUCKET + "/release/")) if i.type.name == "Directory"]
    return sorted(rel)[-1]


def add_overture(code, region_geojson, index_path, table=None):
    """Adds Overture's places of the country to an index built by build_places. `table` (tests): rows instead of S3."""
    if table is None:
        import pyarrow.dataset as pds, pyarrow.fs as pfs, pyarrow.compute as pc
        g = json.load(open(region_geojson))
        xs, ys = [], []
        for f in g["features"]:
            for poly in f["geometry"]["coordinates"]:
                for x, y in poly[0]:
                    xs.append(x); ys.append(y)
        fs = pfs.S3FileSystem(anonymous=True, region="us-west-2")
        rel = overture_release(fs)
        d = pds.dataset(f"{OVERTURE_BUCKET}/release/{rel}/theme=places/type=place/", filesystem=fs, format="parquet")
        flt = (pc.field("bbox", "xmin") >= min(xs)) & (pc.field("bbox", "xmin") <= max(xs)) & (pc.field("bbox", "ymin") >= min(ys)) & (pc.field("bbox", "ymin") <= max(ys))
        table = d.to_table(columns=["names", "basic_category", "confidence", "addresses", "bbox", "sources", "operating_status"], filter=flt).to_pylist()
        print(f"overture {rel}: {len(table)} places in the box", flush=True)
    db = sqlite3.connect(index_path)
    near = {}
    for name, lat, lon in db.execute("SELECT name, lat, lon FROM places"):
        near.setdefault(normalize(name), []).append((lat, lon))
    n = db.execute("SELECT COALESCE(MAX(id), 0) FROM places").fetchone()[0]
    added = 0
    for r in table:
        if not ov_keep(r, code):
            continue
        name = r["names"]["primary"].strip()
        lat, lon = r["bbox"]["ymin"], r["bbox"]["xmin"]
        k = normalize(name)
        if not k or any(abs(a - lat) < 0.0015 and abs(b - lon) < 0.0015 for a, b in near.get(k, ())):
            continue                       # already in the index here (≈ 150 m)
        near.setdefault(k, []).append((lat, lon))
        n += 1; added += 1
        ar = name if AR_ANY.search(name) else ""
        en = "" if ar and not re.search("[A-Za-z]", name) else name
        db.execute("INSERT INTO places VALUES (?,?,?,?,?,?,?,?)", (n, name, ar, en, ov_kind(r.get("basic_category")), round(lat, 6), round(lon, 6), 34))
        db.execute("INSERT INTO places_fts(rowid, key) VALUES (?,?)", (n, k))
    db.commit()
    db.execute("INSERT INTO places_fts(places_fts) VALUES('optimize')")
    db.commit()
    db.execute("VACUUM")
    db.close()
    print(f"overture: +{added} places", flush=True)
    return added


# ---- the manifest and the shared fonts ------------------------------------------------------------------------
PART = 1_900_000_000          # GitHub release files must stay under 2 GB: bigger files are published in parts


def split_parts(path, part=PART):
    """Splits a big file into <name>.001, .002 … next to it (the phone appends them back into one file)."""
    out, i = [], 0
    with open(path, "rb") as src:
        while True:
            chunk = src.read(part)
            if not chunk:
                break
            i += 1
            p = f"{path}.{i:03d}"
            with open(p, "wb") as dst:
                dst.write(chunk)
            out.append({"name": os.path.basename(p), "bytes": len(chunk)})
    return out


def manifest(code, name, date, folder, files, part=PART):
    """Writes <code>-manifest.json and returns it; prints nothing. Files over `part` bytes get "parts" (and are split)."""
    import datetime
    entries = []
    for f in files:
        p = os.path.join(folder, os.path.basename(f))
        e = {"name": os.path.basename(f), "bytes": os.path.getsize(p), "sha256": sha256(p)}
        if e["bytes"] > part:
            e["parts"] = split_parts(p, part)
            os.remove(p)
        entries.append(e)
    m = {"code": code, "name": name, "date": date, "built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
         "source": "OpenStreetMap contributors (ODbL) · map tiles: Protomaps build · search: Geofabrik extract + Overture Maps Foundation places (CDLA-Permissive-2.0)",
         "files": entries}
    with open(os.path.join(folder, f"{code}-manifest.json"), "w") as fh:
        json.dump(m, fh, ensure_ascii=False, indent=1)
    return m


def uploads(m, folder):
    """The files to publish for a manifest: each file, or its parts, and the manifest itself."""
    names = [p["name"] for e in m["files"] for p in (e.get("parts") or [e])]
    return [os.path.join(folder, n) for n in names] + [os.path.join(folder, m["code"] + "-manifest.json")]


def country(code):
    here = os.path.dirname(os.path.abspath(__file__))
    for c in json.load(open(os.path.join(here, "map_countries.json"))):
        if c["code"] == code:
            return c
    raise SystemExit(f"Unknown country {code}")


def assets(fonts, sprites, outdir):
    os.makedirs(outdir, exist_ok=True)
    z = os.path.join(outdir, "map-assets.zip")
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for base, prefix in ((fonts, "fonts"), (sprites, "sprites")):
            for d, _, fs in os.walk(base):
                for f in fs:
                    p = os.path.join(d, f)
                    zf.write(p, os.path.join(prefix, os.path.relpath(p, base)))
    m = {"version": 1, "files": [{"name": "map-assets.zip", "bytes": os.path.getsize(z), "sha256": sha256(z)}]}
    with open(os.path.join(outdir, "assets-manifest.json"), "w") as f:
        json.dump(m, f, indent=1)
    return m


# ---- v6.27: online search without downloading (Ali: "every place, free") -------------------------------------------------
# <code>-find.bin = the places index cut into pieces by the first 3 letters of each word, each piece gzip'd, so the app
# reads ONE small piece (median 0.3 KB, 99% under ~45 KB for Egypt) by an HTTP range request to the free GitHub release
# (MapPacks.range / packs.mapRange) instead of downloading the 130 MB index. Very common words (شارع, street, al…: in
# more than 0.4 % of places) are not used to cut — a place is filed under its other words. The Arabic article "ال" is
# skipped when cutting (the key itself keeps it). Format: "AFIND1 " + 8-digit length of the index + "\n" (16 bytes),
# then the index (gzip JSON {v, common, shards: {prefix: [offset from the first piece, length]}}), then the pieces (gzip, one place per
# line: name, name_ar, name_en, kind, lat, lon, rank, key — tab-separated; name_ar/name_en empty when equal to name).
# "common" in the index = {word: how many places have it}. Read by web-src/offlinemap.js netFind() (the same rules).
FIND_COMMON, FIND_VERY = 0.004, 0.015
AREA_KINDS = {"place/compound", "place/residential_area", "place/neighbourhood", "place/quarter", "place/suburb"}


def find_stem(w):
    return w[2:] if w.startswith("ال") and len(w) > 4 else w


def build_find(sqlite_path, out):
    import collections, gzip
    db = sqlite3.connect(sqlite_path)
    rows = db.execute("SELECT p.name, p.name_ar, p.name_en, p.kind, p.lat, p.lon, p.rank, f.key FROM places p JOIN places_fts f ON f.rowid = p.id").fetchall()
    df = collections.Counter()
    for r in rows:
        df.update({find_stem(w) for w in r[7].split() if len(w) >= 2})
    common = {w for w, c in df.items() if c > len(rows) * FIND_COMMON}
    shards = collections.defaultdict(list)
    for name, ar, en, kind, lat, lon, rank, key in rows:
        ws = {find_stem(w) for w in key.split() if len(w) >= 2}
        if not ws:
            continue
        # its uncommon words, + its rarest common word unless that one is very common (شارع, street…): a search made
        # only of common words ("مستشفى السلام") reads the piece of its rarest word — the same rule as netFind()
        good = [w for w in ws if w not in common]
        rare = sorted((w for w in ws if w in common), key=lambda w: (df[w], w))[:1]   # ties: by the word (netFind does the same)
        if rare and (df[rare[0]] <= len(rows) * FIND_VERY or not good):
            good += rare
        rec = "\t".join(x.replace("\t", " ").replace("\n", " ") for x in (name, ar if ar != name else "", en if en != name else "", kind, "%.5f" % lat, "%.5f" % lon, str(rank), key))
        for p in {w[:3] for w in good}:
            shards[p].append(rec)
    blobs, table, off = [], {}, 0
    for p in sorted(shards):
        b = gzip.compress("\n".join(shards[p]).encode("utf-8"), 9, mtime=0)
        table[p] = [off, len(b)]; blobs.append(b); off += len(b)
    # v6.27: the named areas (compounds, residential areas, neighbourhoods) by map square (0.25°), so the online map can
    # LABEL them where you look — the basemap only labels neighbourhoods drawn as points
    squares = collections.defaultdict(list)
    for name, ar, en, kind, lat, lon, rank, key in rows:
        if kind in AREA_KINDS:
            squares["%d:%d" % (math.floor(lat * 4), math.floor(lon * 4))].append("\t".join(x.replace("\t", " ").replace("\n", " ") for x in (name, ar if ar != name else "", en if en != name else "", kind, "%.5f" % lat, "%.5f" % lon, str(rank), key)))
    areas = {}
    for k in sorted(squares):
        b = gzip.compress("\n".join(squares[k]).encode("utf-8"), 9, mtime=0)
        areas[k] = [off, len(b)]; blobs.append(b); off += len(b)
    # offsets count from the first piece (just after the index), so the index's own size never moves them
    idx = gzip.compress(json.dumps({"v": 1, "common": {w: df[w] for w in sorted(common)}, "shards": table, "areas": areas}, ensure_ascii=False).encode("utf-8"), 9, mtime=0)
    with open(out, "wb") as f:
        f.write(("AFIND1 %08d\n" % len(idx)).encode("ascii")); f.write(idx)
        for b in blobs:
            f.write(b)
    return {"places": len(rows), "pieces": len(table), "common": len(common), "area_squares": len(areas), "bytes": os.path.getsize(out), "biggest": max(v[1] for v in table.values()) if table else 0}


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "region":
        json.dump(poly_to_geojson(open(sys.argv[2]).read()), open(sys.argv[3], "w"))
    elif cmd == "places":
        print("places:", build_places(sys.argv[2], sys.argv[3]))
    elif cmd == "overture":            # code region.geojson index.sqlite — adds Overture's places (v6.20)
        add_overture(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "find":                # sqlite out.bin — the online search file (v6.27)
        print("find:", json.dumps(build_find(sys.argv[2], sys.argv[3])))
    elif cmd == "manifest":            # prints the files to upload, one per line
        m = manifest(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6:])
        print("\n".join(uploads(m, sys.argv[5])))
    elif cmd == "country":             # code -> "gf<TAB>name<TAB>maxzoom" for the workflow
        c = country(sys.argv[2]); print(f"{c['gf']}\t{c['en']}\t{c.get('maxzoom', 15)}")
    elif cmd == "all":                 # every country code, as a JSON list (the weekly run)
        print(json.dumps([c["code"] for c in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "map_countries.json")))]))
    elif cmd == "assets":
        print(json.dumps(assets(sys.argv[2], sys.argv[3], sys.argv[4])))
    else:
        print(__doc__)
        sys.exit(2)
