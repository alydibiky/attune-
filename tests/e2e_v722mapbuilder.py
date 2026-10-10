"""v6.15 — the country-map builder (tools/build_map_pack.py): the outline, the search index, the manifest.
   python3 tests/e2e_v722mapbuilder.py        (the index part needs: pip install osmium; skipped without it)
"""
import json, os, sqlite3, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import build_map_pack as B

fails = 0
def check(ok, what):
    global fails
    print(("PASS " if ok else "FAIL ") + what)
    if not ok: fails += 1

# the normalisation: the same answers as offlinemap.js (tests/unit/v722maps.test.mjs checks the JS side)
check(B.normalize("مَدِينَةُ نَصْر") == "مدينه نصر", "Arabic diacritics and ة are folded: " + B.normalize("مَدِينَةُ نَصْر"))
check(B.normalize("إسكندرية") == B.normalize("اسكندريه"), "alef forms and ta marbuta match")
check(B.normalize("Şişli, İstanbul") == "sisli istanbul", "Turkish letters fold: " + B.normalize("Şişli, İstanbul"))
check(B.normalize("Ring Rd. (Cairo)") == "ring rd cairo", "punctuation becomes spaces")

# the outline
poly = "egypt\n1\n  25.0 22.0\n  37.0 22.0\n  37.0 32.0\n  25.0 32.0\nEND\n!2\n  30 25\n  31 25\n  31 26\nEND\nEND\n"
g = B.poly_to_geojson(poly)
coords = g["features"][0]["geometry"]["coordinates"]
check(len(coords) == 1 and len(coords[0]) == 2 and coords[0][0][0] == coords[0][0][-1], "a .poly outline (with a hole) becomes a closed GeoJSON MultiPolygon")

# the search index from a tiny OSM file
OSM = """<?xml version='1.0' encoding='UTF-8'?>
<osm version="0.6">
 <node id="1" lat="30.0566" lon="31.3300" version="1"><tag k="place" v="suburb"/><tag k="name" v="مدينة نصر"/><tag k="name:en" v="Nasr City"/></node>
 <node id="2" lat="30.0444" lon="31.2357" version="1"><tag k="place" v="city"/><tag k="name" v="القاهرة"/><tag k="name:en" v="Cairo"/></node>
 <node id="3" lat="30.0600" lon="31.3400" version="1"><tag k="amenity" v="fuel"/><tag k="name" v="Wataniya"/></node>
 <node id="4" lat="30.0700" lon="31.3500" version="1"><tag k="building" v="yes"/><tag k="name" v="Some house"/></node>
 <node id="10" lat="30.0500" lon="31.3000" version="1"/><node id="11" lat="30.0510" lon="31.3010" version="1"/>
 <node id="12" lat="30.0520" lon="31.3020" version="1"/><node id="13" lat="30.0530" lon="31.3030" version="1"/>
 <way id="100" version="1"><nd ref="10"/><nd ref="11"/><tag k="highway" v="primary"/><tag k="name" v="شارع عباس العقاد"/><tag k="name:en" v="Abbas El Akkad St"/></way>
 <way id="101" version="1"><nd ref="12"/><nd ref="13"/><tag k="highway" v="primary"/><tag k="name" v="شارع عباس العقاد"/></way>
</osm>"""
try:
    import osmium  # noqa: F401
    HAVE_OSMIUM = True
except ImportError:
    HAVE_OSMIUM = False
    print("SKIP the search index (pip install osmium to test it)")
with tempfile.TemporaryDirectory() as d:
  if HAVE_OSMIUM:
    src = os.path.join(d, "t.osm"); open(src, "w").write(OSM)
    out = os.path.join(d, "eg-places.sqlite")
    n = B.build_places(src, out)
    check(n == 4, "4 things to find (a city, a district, a fuel station, one street — the second piece of the same street within 1 km is kept once; a plain house is skipped): %d" % n)
    db = sqlite3.connect(out)
    q = lambda s: [r[0] for r in db.execute("SELECT p.name FROM places_fts f JOIN places p ON p.id=f.rowid WHERE f.key MATCH ? ORDER BY p.rank DESC", (" ".join(w + "*" for w in B.normalize(s).split()),))]
    check(q("مدينه نصر") == ["مدينة نصر"], "Arabic search with a different spelling finds the district")
    check(q("nasr") == ["مدينة نصر"], "the English name finds it too")
    check(q("عباس العق") == ["شارع عباس العقاد"], "a street by the start of its words")
    check(q("cairo") == ["القاهرة"], "the city by its English name")
    check(db.execute("SELECT kind FROM places WHERE name='Wataniya'").fetchone()[0] == "amenity/fuel", "a fuel station is kept with its kind")
    db.close()
    m = B.manifest("eg", "Egypt", "2026-10-09", d, ["eg-places.sqlite"])
    check(m["files"][0]["bytes"] == os.path.getsize(out) and len(m["files"][0]["sha256"]) == 64 and os.path.exists(os.path.join(d, "eg-manifest.json")), "the manifest lists each file with its size and SHA-256")

print("ALL PASSED" if not fails else f"{fails} FAILED")
sys.exit(1 if fails else 0)
