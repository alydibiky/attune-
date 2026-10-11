"""v6.20 — more places in the offline map search from Overture Maps (Ali: "a lot of places is not in the map").
No browser: tools/build_map_pack.py add_overture() on rows shaped like Overture's (the real step reads them from S3)."""
import os, sys, sqlite3, tempfile
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, "..", "tools"))
import build_map_pack as B
from harness import check, finish

def row(name, cat="restaurant", conf=0.8, cc="EG", lic="CDLA-Permissive-2.0", lat=30.0, lon=31.2, status="open"):
    return {"names": {"primary": name, "common": None}, "basic_category": cat, "confidence": conf, "operating_status": status,
            "addresses": [{"country": cc}], "sources": [{"license": lic, "dataset": "meta"}], "bbox": {"xmin": lon, "ymin": lat, "xmax": lon, "ymax": lat}}

d = tempfile.mkdtemp(); p = os.path.join(d, "eg-places.sqlite")
idx = B.Index(p); idx.add({"name": "Palm Hills", "place": "suburb"}, 30.01, 30.98); idx.add({"name": "Seoudi", "shop": "supermarket"}, 30.05, 31.2); idx.close()
rows = [row("Badya Palm Hills", "real_estate_service", lat=30.0, lon=30.9), row("Seoudi", "food_and_beverage_store", lat=30.0501, lon=31.2001),
        row("Seoudi", "food_and_beverage_store", lat=29.96, lon=31.25), row("ونش رفع اثاث 01012597477"), row("Low confidence cafe", conf=0.3),
        row("Closed shop", status="permanently_closed"), row("Over the border", cc="SD"), row("Unknown licence", lic="CC-BY-NC-4.0"),
        row("No country given", cc=None), row("Shell Fuel", "gas_station"), row("صيدلية العزبي", "pharmacy_and_drug_store"), row("مسجد الحصري", "muslim_place_of_worship"), row("Dr. Ahmed Dental", "dental_clinic")]
n = B.add_overture("eg", None, p, table=rows)
db = sqlite3.connect(p)
names = [r[0] for r in db.execute("SELECT name FROM places ORDER BY id")]
check(n == 6, "6 places added (%d): %s" % (n, names[2:]))
check(names.count("Seoudi") == 2, "a place already in the index nearby is kept once; the same name elsewhere is added")
check(not any(x in " ".join(names) for x in ("01012597477", "Low confidence", "Closed shop", "Over the border", "Unknown licence", "No country given")),
      "phone-number adverts, low confidence, closed, another country and a non-commercial licence are left out")
kinds = dict(db.execute("SELECT name, kind FROM places"))
check(kinds["Shell Fuel"] == "amenity/fuel" and kinds["صيدلية العزبي"] == "amenity/pharmacy" and kinds["مسجد الحصري"] == "amenity/place_of_worship" and kinds["Dr. Ahmed Dental"] == "amenity/clinic",
      "the map's buttons find them: fuel, pharmacy, mosque, clinic (%s)" % kinds)
ar = db.execute("SELECT name_ar, name_en FROM places WHERE name = 'صيدلية العزبي'").fetchone()
check(ar == ("صيدلية العزبي", ""), "an Arabic name is the Arabic name")
hit = db.execute("SELECT p.name FROM places_fts f JOIN places p ON p.id = f.rowid WHERE f.key MATCH ?", ("palm* hills*",)).fetchall()
check(len(hit) == 2, "searching «palm hills» finds the area and the compound: %s" % hit)
finish()
