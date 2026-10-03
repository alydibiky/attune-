#!/usr/bin/env python3
"""Build the Attune offline food pack from the Open Food Facts JSONL dump (open data, ODbL).

Reads the dump from stdin (decompressed JSON lines) or from a path, keeps every product with a name and a COMPLETE label
(energy, protein, carbs, fat — the same rule as web-src/fitdb.js fromOFF), drops impossible numbers, and writes:
  out/foodpack-NNN.tsv.gz   shards of ~60,000 rows, Egyptian / Arab-region products first, then by how often people scan them
  out/manifest.json         {version, built, count, egypt, shards:[{name, rows, bytes, sha256}]}
One product per line, tab separated:
  code name ar brand kcal p c f fib sug sat salt serving egypt grade nova
Nothing is guessed: every number comes from the product's own label. Run:
  curl -sL https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz | zcat | python3 tools/build_food_pack.py out
"""
import sys, os, json, gzip, hashlib, time, heapq

REGION = {"en:egypt", "en:saudi-arabia", "en:united-arab-emirates", "en:jordan", "en:lebanon", "en:kuwait", "en:qatar", "en:oman", "en:bahrain",
          "en:morocco", "en:tunisia", "en:algeria", "en:libya", "en:sudan", "en:iraq", "en:syria", "en:palestine", "en:yemen", "en:turkey"}
SHARD = 25000


def num(x):
    try:
        v = float(str(x).replace(",", "."))
        return v if v == v and abs(v) != float("inf") else None
    except Exception:
        return None


def clean(s):
    return " ".join(str(s or "").replace("\t", " ").replace("\n", " ").replace("\r", " ").split())[:90]


def row(p):
    n = p.get("nutriments") or {}
    kcal = num(n.get("energy-kcal_100g"))
    if kcal is None and num(n.get("energy_100g")) is not None:
        kcal = num(n.get("energy_100g")) / 4.184
    pr, c, f = num(n.get("proteins_100g")), num(n.get("carbohydrates_100g")), num(n.get("fat_100g"))
    if None in (kcal, pr, c, f) or kcal < 0 or kcal > 950:
        return None
    if pr < 0 or c < 0 or f < 0 or pr > 100 or c > 100 or f > 100 or pr + c + f > 105:
        return None
    fib = num(n.get("fiber_100g")) or 0
    est = pr * 4 + (c - fib) * 4 + fib * 2 + f * 9            # energy and macros must agree (as fitdb.consistent)
    if abs(est - kcal) > max(25, kcal * 0.3):
        return None
    code = "".join(ch for ch in str(p.get("code") or "") if ch.isdigit())
    en = clean(p.get("product_name_en") or p.get("product_name") or p.get("generic_name"))
    ar = clean(p.get("product_name_ar"))
    name = en or ar
    if not code or not name:
        return None
    brand = clean((p.get("brands") or "").split(",")[0])
    sug, sat = num(n.get("sugars_100g")), num(n.get("saturated-fat_100g"))
    salt = num(n.get("salt_100g"))
    if salt is None and num(n.get("sodium_100g")) is not None:
        salt = num(n.get("sodium_100g")) * 2.5
    sv = num(p.get("serving_quantity"))
    ct = set(p.get("countries_tags") or [])
    egypt = 1 if "en:egypt" in ct else 0
    region = 1 if ct & REGION else 0
    grade = str(p.get("nutriscore_grade") or "").upper()
    grade = grade if grade in list("ABCDE") else ""
    nova = str(int(p.get("nova_group"))) if str(p.get("nova_group") or "").isdigit() and 1 <= int(p.get("nova_group")) <= 4 else ""
    r1 = lambda v: "" if v is None else ("%.1f" % v).rstrip("0").rstrip(".")
    cols = [code, name, ar if ar != name else "", brand, str(round(kcal)), r1(pr), r1(c), r1(f), r1(fib), r1(sug), r1(sat), r1(salt),
            "" if not sv or sv <= 0 or sv > 2000 else str(round(sv)), str(egypt), grade, nova]
    scans = num(p.get("unique_scans_n")) or 0
    return (-(egypt * 2 + region), -scans), "\t".join(cols)


def usda_rows(folder):
    """USDA FoodData Central, Branded Foods (public domain): branded_food.csv + food.csv + food_nutrient.csv → the same rows. Per 100 g."""
    import csv
    csv.field_size_limit(10 ** 9)
    NID = {1008: "kcal", 2047: "kcal", 2048: "kcal", 1003: "p", 1005: "c", 1004: "f", 1079: "fib", 2000: "sug", 1063: "sug", 1258: "sat", 1093: "na"}
    meta = {}
    with open(os.path.join(folder, "branded_food.csv"), newline="", encoding="utf-8", errors="replace") as fh:
        for r in csv.DictReader(fh):
            g = "".join(ch for ch in (r.get("gtin_upc") or "") if ch.isdigit())
            if len(g) >= 8:
                sv = num(r.get("serving_size")) if (r.get("serving_size_unit") or "").lower() in ("g", "grm", "ml", "mlt") else None
                meta[r["fdc_id"]] = [g, clean(r.get("brand_name") or r.get("brand_owner")), sv]
    names = {}
    with open(os.path.join(folder, "food.csv"), newline="", encoding="utf-8", errors="replace") as fh:
        for r in csv.DictReader(fh):
            if r["fdc_id"] in meta:
                names[r["fdc_id"]] = clean(r.get("description"))
    nut = {}
    with open(os.path.join(folder, "food_nutrient.csv"), newline="", encoding="utf-8", errors="replace") as fh:
        for r in csv.DictReader(fh):
            f = r["fdc_id"]
            if f not in meta:
                continue
            try:
                k = NID.get(int(r["nutrient_id"]))
            except Exception:
                continue
            if k:
                v = num(r.get("amount"))
                if v is not None:
                    d = nut.setdefault(f, {})
                    if k == "kcal" and "kcal" in d and int(r["nutrient_id"]) != 1008:
                        continue
                    d[k] = v
    out = []
    for f, (g, brand, sv) in meta.items():
        d = nut.get(f) or {}
        name = names.get(f)
        if not name or any(k not in d for k in ("kcal", "p", "c", "f")):
            continue
        kcal, pr, c, fa, fib = d["kcal"], d["p"], d["c"], d["f"], d.get("fib", 0)
        if kcal < 0 or kcal > 950 or min(pr, c, fa) < 0 or max(pr, c, fa) > 100 or pr + c + fa > 105:
            continue
        if abs(pr * 4 + (c - fib) * 4 + fib * 2 + fa * 9 - kcal) > max(25, kcal * 0.3):
            continue
        r1 = lambda v: "" if v is None else ("%.1f" % v).rstrip("0").rstrip(".")
        salt = d["na"] * 2.5 / 1000 if "na" in d else None          # USDA sodium is mg per 100 g → salt g
        cols = [g, name.title() if name.isupper() else name, "", brand, str(round(kcal)), r1(pr), r1(c), r1(fa), r1(fib), r1(d.get("sug")), r1(d.get("sat")), r1(salt),
                "" if not sv or sv <= 0 or sv > 2000 else str(round(sv)), "0", "", ""]
        out.append(((0, 0), "\t".join(cols)))
    return out


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "out"
    usda = None
    args = [a for a in sys.argv[2:]]
    if "--usda" in args:
        i = args.index("--usda"); usda = args[i + 1]; del args[i:i + 2]
    src = open(args[0], "rb") if args else sys.stdin.buffer
    if args and args[0].endswith(".gz"):
        src = gzip.open(args[0], "rb")
    os.makedirs(out, exist_ok=True)
    t0 = time.time(); seen = set(); rows = []; total = 0; bad = 0
    for line in src:
        total += 1
        try:
            p = json.loads(line)
        except Exception:
            bad += 1
            continue
        r = row(p)
        if not r:
            continue
        code = r[1].split("\t", 1)[0]
        if code in seen:
            continue
        seen.add(code)
        rows.append(r)
        if total % 500000 == 0:
            print("read", total, "kept", len(rows), "in", int(time.time() - t0), "s", flush=True)
    off_count = len(rows)
    if usda:
        try:
            have = {r[1].split("\t", 1)[0].lstrip("0") for r in rows}
            added = 0
            for r in usda_rows(usda):
                key = r[1].split("\t", 1)[0].lstrip("0")
                if key in have:
                    continue
                have.add(key); rows.append(r); added += 1
            print("USDA branded foods added:", added, flush=True)
        except Exception as e:
            print("USDA step skipped:", e, flush=True)
    rows.sort(key=lambda x: x[0])
    shards = []; egypt = 0
    for i in range(0, len(rows), SHARD):
        part = rows[i:i + SHARD]
        name = "foodpack-%03d.tsv.gz" % (i // SHARD)
        path = os.path.join(out, name)
        with gzip.open(path, "wb", compresslevel=9) as g:
            g.write(("\n".join(x[1] for x in part) + "\n").encode("utf-8"))
        egypt += sum(1 for x in part if x[1].split("\t")[13] == "1")
        h = hashlib.sha256(open(path, "rb").read()).hexdigest()
        shards.append({"name": name, "rows": len(part), "bytes": os.path.getsize(path), "sha256": h})
    man = {"version": 1, "built": time.strftime("%Y-%m-%d"), "count": len(rows), "egypt": egypt, "off": off_count, "source": "Open Food Facts (ODbL)" + (" + USDA FoodData Central Branded Foods (public domain)" if usda else ""), "shards": shards}
    json.dump(man, open(os.path.join(out, "manifest.json"), "w"), indent=1)
    print("DONE: read %d lines (%d unreadable), kept %d products (%d Egyptian) in %d shards, %.1f MB" % (
        total, bad, len(rows), egypt, len(shards), sum(s["bytes"] for s in shards) / 1e6))


if __name__ == "__main__":
    main()
