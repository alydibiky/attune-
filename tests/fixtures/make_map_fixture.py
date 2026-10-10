"""Makes tests/fixtures/cairo-mini.pmtiles: a tiny vector map in the Protomaps layer layout (earth, water, roads,
places) around central Cairo, zoom 5–13 — enough for the e2e test to check that a country pack is drawn offline.
   pip install pmtiles mapbox-vector-tile ; python3 tests/fixtures/make_map_fixture.py
"""
import gzip, json, math, os
import mapbox_vector_tile as MVT
from pmtiles.tile import zxy_to_tileid, TileType, Compression
from pmtiles.writer import Writer

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cairo-mini.pmtiles")
R = 6378137.0
def merc(lon, lat): return (math.radians(lon) * R, math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * R)
def tile_bounds(z, x, y):
    n, size = 2 ** z, 2 * math.pi * R
    return (-math.pi * R + x / n * size, math.pi * R - (y + 1) / n * size, -math.pi * R + (x + 1) / n * size, math.pi * R - y / n * size)
def lonlat_tile(lon, lat, z):
    n = 2 ** z
    return int((lon + 180) / 360 * n), int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)

W, S, E, N = 31.15, 29.98, 31.40, 30.12            # central Cairo
NILE = [(31.225, 29.98), (31.228, 30.03), (31.232, 30.06), (31.235, 30.12)]
ROADS = [("Ring Road", "الطريق الدائري", "highway", [(31.16, 30.0), (31.25, 30.11), (31.38, 30.10)]),
         ("Salah Salem", "صلاح سالم", "major_road", [(31.25, 30.03), (31.30, 30.06), (31.33, 30.08)]),
         ("Abbas El Akkad", "عباس العقاد", "minor_road", [(31.33, 30.06), (31.345, 30.055)])]
PLACES = [("Cairo", "القاهرة", "locality", 31.2357, 30.0444, 3), ("Nasr City", "مدينة نصر", "neighbourhood", 31.33, 30.057, 10)]

def line(pts): return "LINESTRING (" + ", ".join("%f %f" % merc(*p) for p in pts) + ")"
def make(z, x, y):
    b = tile_bounds(z, x, y)
    ew, es = merc(W - 1, S - 1); ee, en = merc(E + 1, N + 1)
    layers = [
        {"name": "earth", "features": [{"geometry": "POLYGON ((%f %f, %f %f, %f %f, %f %f, %f %f))" % (ew, es, ee, es, ee, en, ew, en, ew, es), "properties": {"kind": "earth"}}]},
        {"name": "water", "features": [{"geometry": line(NILE).replace("LINESTRING", "LINESTRING"), "properties": {"kind": "river", "name": "Nile", "name:ar": "النيل"}}]},
        {"name": "roads", "features": [{"geometry": line(p), "properties": {"kind": k, "name": n, "name:ar": a, "min_zoom": 5}} for n, a, k, p in ROADS]},
        {"name": "places", "features": [{"geometry": "POINT (%f %f)" % merc(lon, lat), "properties": {"kind": k, "name": n, "name:ar": a, "min_zoom": mz, "population_rank": 15}} for n, a, k, lon, lat, mz in PLACES]},
    ]
    return MVT.encode(layers, default_options={"quantize_bounds": b, "extents": 4096})

with open(OUT, "wb") as f:
    w = Writer(f)
    tiles = []
    for z in range(5, 14):
        x0, y0 = lonlat_tile(W, N, z); x1, y1 = lonlat_tile(E, S, z)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                tiles.append((zxy_to_tileid(z, x, y), gzip.compress(make(z, x, y))))
    for tid, data in sorted(tiles):
        w.write_tile(tid, data)
    w.finalize({"tile_type": TileType.MVT, "tile_compression": Compression.GZIP, "min_zoom": 5, "max_zoom": 13,
                "min_lon_e7": int(W * 1e7), "min_lat_e7": int(S * 1e7), "max_lon_e7": int(E * 1e7), "max_lat_e7": int(N * 1e7),
                "center_zoom": 11, "center_lon_e7": int(31.2357e7), "center_lat_e7": int(30.0444e7)},
               {"vector_layers": [{"id": l} for l in ("earth", "water", "roads", "places")], "attribution": "test"})
print(OUT, os.path.getsize(OUT), "bytes,", len(tiles), "tiles")
