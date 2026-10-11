#!/usr/bin/env python3
"""v6.20 — the offline route graph of a country for Attune's Maps (Ali: "what's the point of maps if it will redirect me
to another map"). Run by .github/workflows/map-pack.yml next to the map and the search index.

  python3 tools/build_route_graph.py <code> <region.geojson> <out/code-route.bin>

Source: Overture Maps' transportation theme (segments + connectors; built from OpenStreetMap, ODbL — the same data as the
map). Every road piece between two junctions becomes an edge; the phone (web-src/route.js) finds the fastest car route
or the shortest walk with A* on it, offline.

A country is ≈ 3.7 million road pieces (Egypt) — too much to load at once on a phone. The file is cut into squares of
0.1° (≈ 11 km) plus a backbone (motorway … secondary roads of the whole country); the phone reads only the squares a trip
needs (by byte range) and, for a long trip, the backbone. Layout: see build() and graph_blob(); flags 1 = car, 2 = walk.
"""
import json, math, re, struct, sys

CAR = {"motorway": 100, "trunk": 80, "primary": 60, "secondary": 50, "tertiary": 40, "unclassified": 35, "residential": 30,
       "living_street": 15, "service": 15, "unknown": 25}
WALK = set(CAR) - {"motorway", "trunk"} | {"footway", "pedestrian", "steps", "path", "track", "cycleway", "bridleway"}
VEHICLE_MODES = {"vehicle", "motor_vehicle", "car", "motorcar"}


def wkb_points(b):
    """WKB Point / LineString (2D, either byte order) -> [(lon, lat), …]."""
    b = bytes(b)
    o = "<" if b[0] == 1 else ">"
    kind = struct.unpack(o + "I", b[1:5])[0] & 0xFF
    if kind == 1:
        return [struct.unpack(o + "dd", b[5:21])]
    n = struct.unpack(o + "I", b[5:9])[0]
    return [struct.unpack(o + "dd", b[9 + 16 * i: 25 + 16 * i]) for i in range(n)]


def metres(a, b):
    """Distance between (lon, lat) points, metres (equirectangular — exact enough for a road piece)."""
    k = math.cos(math.radians((a[1] + b[1]) / 2))
    return math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 111_195


def access(rules):
    """Overture access_restrictions -> (car forward, car backward, walk). A one-way street stops cars, not people walking."""
    cf = cb = walk = True
    for r in rules or []:
        if (r or {}).get("access_type") != "denied":
            continue
        w = r.get("when") or {}
        modes = set(w.get("mode") or [])
        heading = w.get("heading")
        cars = not modes or bool(modes & VEHICLE_MODES)
        feet = bool(modes & {"foot", "pedestrian"}) or (not modes and not heading)
        if r.get("between"):
            continue                                   # part of the road only (a gate): kept routable
        if cars:
            if heading == "forward": cf = False
            elif heading == "backward": cb = False
            else: cf = cb = False
        if feet:
            walk = False
    return cf, cb, walk


def max_speed(limits):
    for s in limits or []:
        m = (s or {}).get("max_speed") or {}
        if m.get("value") and not s.get("between"):
            v = float(m["value"]) * (1.609 if m.get("unit") == "mph" else 1)
            return max(5, min(130, round(v * 0.85)))   # people drive a little under the limit on average
    return None


def split_at(pts, cons):
    """The line's points and its junctions [(id, at 0..1)] -> [(id_a, id_b, [bend points], metres)] between junctions."""
    cum = [0.0]
    for i in range(1, len(pts)):
        cum.append(cum[-1] + metres(pts[i - 1], pts[i]))
    total = cum[-1] or 1e-9

    def point_at(d):
        for i in range(1, len(cum)):
            if cum[i] >= d:
                t = 0 if cum[i] == cum[i - 1] else (d - cum[i - 1]) / (cum[i] - cum[i - 1])
                return (pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t), i
        return pts[-1], len(pts) - 1

    out, cons = [], sorted(cons, key=lambda c: c[1])
    for (ca, a), (cb, b) in zip(cons, cons[1:]):
        da, db = a * total, b * total
        if db - da < 0.5:
            continue
        _, ia = point_at(da)
        _, ib = point_at(db)
        bends = [p for i, p in enumerate(pts) if ia <= i < ib and da < cum[i] < db]
        out.append((ca, cb, bends, db - da))
    return out


CELL = 0.1                    # a square of ≈ 11 km: a trip in town reads a few of them, not the whole country
BACKBONE = {"motorway", "trunk", "primary", "secondary"}


def pieces_of(segments, connectors):
    """-> (nodes [(gid, lat_e6, lon_e6)], pieces [(u, v, bends, metres, name, flags_fwd, flags_bwd, speed, cls)], names)."""
    pos = {c["id"]: wkb_points(c["geometry"])[0] for c in connectors}
    node, coords = {}, []

    def nid(cid):
        if cid not in node:
            p = pos[cid]; node[cid] = len(coords); coords.append((round(p[1] * 1e6), round(p[0] * 1e6)))
        return node[cid]

    names, name_ix, out = [""], {"": 0}, []
    for s in segments:
        cls = s.get("class") or "unknown"
        if s.get("subtype") != "road" or (cls not in CAR and cls not in WALK):
            continue
        cons = [(c["connector_id"], c["at"]) for c in (s.get("connectors") or []) if c["connector_id"] in pos]
        if len(cons) < 2:
            continue
        cf, cb, walk = access(s.get("access_restrictions"))
        car = cls in CAR
        cf, cb, walk = cf and car, cb and car, walk and cls in WALK
        if not (cf or cb or walk):
            continue
        speed = max_speed(s.get("speed_limits")) or CAR.get(cls, 5)
        nm = ((s.get("names") or {}).get("primary") or "").strip().replace("\n", " ")
        if nm not in name_ix:
            name_ix[nm] = len(names); names.append(nm)
        for ca, cb_, bends, m in split_at(wkb_points(s["geometry"]), cons):
            u, v = nid(ca), nid(cb_)
            if u != v:
                out.append((u, v, [(round(p[1] * 1e6), round(p[0] * 1e6)) for p in bends], m, name_ix[nm],
                            (1 if cf else 0) | (2 if walk else 0), (1 if cb else 0) | (2 if walk else 0), speed, cls))
    return coords, out, names


def merge_chains(coords, pieces):
    """A junction where only two pieces of the same road meet (same name, access, speed) is not a junction: the two
    pieces become one, so the phone searches fewer nodes. Directions are kept (a one-way chain stays one-way)."""
    inc = {}
    for i, p in enumerate(pieces):
        inc.setdefault(p[0], []).append(i); inc.setdefault(p[1], []).append(i)
    dead, out = set(), []
    def same(a, b): return a[4] == b[4] and a[7] == b[7] and a[8] == b[8]
    for i, p in enumerate(pieces):
        if i in dead:
            continue
        u, v, bends, m, nm, ff, fb, sp, cls = p
        dead.add(i)
        # walk forward from v while v is a plain joint
        for _ in range(100000):
            js = [j for j in inc.get(v, ()) if j not in dead]
            if len(inc.get(v, ())) != 2 or len(js) != 1 or not same(p, pieces[js[0]]):
                break
            q = pieces[js[0]]
            if q[0] == v: nv, qb, qf, qb2 = q[1], q[2], q[5], q[6]
            else: nv, qb, qf, qb2 = q[0], q[2][::-1], q[6], q[5]
            if (qf, qb2) != (ff, fb) or nv == u:
                break
            dead.add(js[0]); bends = bends + [coords[v]] + qb; m += q[3]; v = nv
        out.append((u, v, bends, m, nm, ff, fb, sp, cls))
    return out


def graph_blob(gids, coords, pieces):
    """One square's graph (or the backbone): its nodes by country-wide id and a CSR of directed edges.
      u32 N, E, P · gid u32[N] lat i32[N] lon i32[N] · first u32[N+1] · to u32[E] len u32[E] (dm) name u32[E]
      geom u32[E] (top bit: backwards) · pts i32[2P] · gcount u16[E] · flags u8[E] · speed u8[E] (padded to 4)"""
    local = {g: i for i, g in enumerate(gids)}
    edges, pts = [], []
    for u, v, bends, m, nm, ff, fb, sp, cls in pieces:
        g = len(pts) // 2
        for la, lo in bends:
            pts += [la, lo]
        dm = max(1, min(0xFFFFFFFF, round(m * 10)))
        if ff: edges.append((local[u], local[v], dm, nm, g, len(bends), ff, sp))
        if fb: edges.append((local[v], local[u], dm, nm, g | 0x80000000, len(bends), fb, sp))
    edges.sort(key=lambda e: e[0])
    n, e_n = len(gids), len(edges)
    first = [0] * (n + 1)
    for e in edges: first[e[0] + 1] += 1
    for i in range(n): first[i + 1] += first[i]
    out = bytearray(struct.pack("<3I", n, e_n, len(pts) // 2))
    pk = lambda f, xs: out.extend(struct.pack(f"<{len(xs)}{f}", *xs))
    pk("I", gids); pk("i", [coords[g][0] for g in gids]); pk("i", [coords[g][1] for g in gids]); pk("I", first)
    for k in (1, 2, 3, 4): pk("I", [e[k] for e in edges])
    pk("i", pts); pk("H", [min(e[5], 65535) for e in edges]); pk("B", [e[6] for e in edges]); pk("B", [min(255, e[7]) for e in edges])
    out.extend(b"\0" * (-len(out) % 4))
    return bytes(out)


def cell_of(lat_e6, lon_e6):
    return f"{math.floor(lat_e6 / 1e6 / CELL)}_{math.floor(lon_e6 / 1e6 / CELL)}"


def build(segments, connectors):
    """-> (bytes of <code>-route.bin, info). The file: "ATRG" u32 version=2, u32 directory bytes, the directory (JSON:
    {cell, names: [offset, bytes], backbone: [offset, bytes], cells: {"lat_lon": [offset, bytes]}}), then the blobs.
    A piece is in the square of each of its two ends; the backbone (motorway … secondary) covers the whole country."""
    coords, pieces, names = pieces_of(segments, connectors)
    n0 = len(pieces)
    pieces = merge_chains(coords, pieces)
    cells = {}
    for p in pieces:
        for c in {cell_of(*coords[p[0]]), cell_of(*coords[p[1]])}:
            cells.setdefault(c, []).append(p)
    blobs, d = [], {"cell": CELL, "cells": {}}
    def add(key, blob):
        blobs.append((key, blob))
    nb = "\n".join(names).encode("utf-8"); nb += b"\0" * (-len(nb) % 4)
    add(("names",), nb)
    back = [p for p in pieces if p[8] in BACKBONE]
    add(("backbone",), graph_blob(sorted({x for p in back for x in (p[0], p[1])}), coords, back))
    for c, ps in sorted(cells.items()):
        add(("cell", c), graph_blob(sorted({x for p in ps for x in (p[0], p[1])}), coords, ps))
    # the directory's offsets are counted from the end of the directory
    off = 0
    for key, blob in blobs:
        if key[0] == "cell": d["cells"][key[1]] = [off, len(blob)]
        else: d[key[0]] = [off, len(blob)]
        off += len(blob)
    dj = json.dumps(d, separators=(",", ":")).encode(); dj += b" " * (-len(dj) % 4)
    out = b"ATRG" + struct.pack("<2I", 2, len(dj)) + dj + b"".join(b for _, b in blobs)
    info = {"pieces": n0, "merged": len(pieces), "nodes": len(coords), "cells": len(cells), "backbone_bytes": len(blobs[1][1]),
            "biggest_cell": max(len(b) for k, b in blobs if k[0] == "cell") if cells else 0, "bytes": len(out)}
    return out, info


def read_overture(region_geojson, release=None):
    """The country's roads and junctions from Overture (S3, no key), cut to the outline's box."""
    import pyarrow.dataset as pds, pyarrow.fs as pfs, pyarrow.compute as pc
    from build_map_pack import OVERTURE_BUCKET, overture_release
    g = json.load(open(region_geojson))
    xs = [x for f in g["features"] for poly in f["geometry"]["coordinates"] for x, _ in poly[0]]
    ys = [y for f in g["features"] for poly in f["geometry"]["coordinates"] for _, y in poly[0]]
    fs = pfs.S3FileSystem(anonymous=True, region="us-west-2")
    rel = release or overture_release(fs)
    box = (pc.field("bbox", "xmin") >= min(xs)) & (pc.field("bbox", "xmax") <= max(xs)) & (pc.field("bbox", "ymin") >= min(ys)) & (pc.field("bbox", "ymax") <= max(ys))
    con = pds.dataset(f"{OVERTURE_BUCKET}/release/{rel}/theme=transportation/type=connector/", filesystem=fs, format="parquet")
    con = [{"id": i, "geometry": g} for b in con.to_batches(columns=["id", "geometry"], filter=box) for i, g in zip(b.column("id").to_pylist(), b.column("geometry").to_pylist())]
    print(f"overture {rel}: {len(con)} junctions", flush=True)
    seg = pds.dataset(f"{OVERTURE_BUCKET}/release/{rel}/theme=transportation/type=segment/", filesystem=fs, format="parquet")
    def rows():   # the roads batch by batch: a whole country as Python objects at once is more than the runner's memory
        for b in seg.to_batches(columns=["subtype", "class", "names", "connectors", "access_restrictions", "speed_limits", "geometry"], filter=box & (pc.field("subtype") == "road"), batch_size=50000):
            yield from b.to_pylist()
    return rows(), con


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__); sys.exit(2)
    import os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    seg, con = read_overture(sys.argv[2])
    data, info = build(seg, con)
    open(sys.argv[3], "wb").write(data)
    print("route graph:", json.dumps(info))
