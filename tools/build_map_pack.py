#!/usr/bin/env python3
"""v6.15 — builds a whole-country offline map pack for Attune (run by .github/workflows/map-pack.yml).

  region <code.poly> <out.geojson>            Geofabrik's country outline -> GeoJSON (for `pmtiles extract --region`)
  places <country.osm.pbf> <out.sqlite>       every named place, street, shop, amenity -> SQLite + FTS4 search index
  manifest <code> <name> <date> <dir> <files…> -> <code>-manifest.json with sizes and SHA-256
  assets <fonts_dir> <sprites_dir> <outdir>   fonts + icons -> map-assets.zip + assets-manifest.json

The search key's normalisation must equal offlinemap.js normalize() and MapPacks.kt normalize().
Tested by tests/unit/v722maps.test.mjs (the normalisation) and tests/e2e_v722mapbuilder.py.
"""
import hashlib, json, os, re, sqlite3, sys, unicodedata, zipfile

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
         "source": "OpenStreetMap contributors (ODbL) · map tiles: Protomaps build · search: Geofabrik extract",
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


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "region":
        json.dump(poly_to_geojson(open(sys.argv[2]).read()), open(sys.argv[3], "w"))
    elif cmd == "places":
        print("places:", build_places(sys.argv[2], sys.argv[3]))
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
