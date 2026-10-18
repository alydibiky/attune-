#!/usr/bin/env python3
"""v6.36 — the generic-foods pack (Ali: "add all knowledge packs that will make the food app stronger than Yazio in all aspects").

The products pack (build_food_pack.py) has a million packaged foods with their LABEL numbers. What a food diary needs as much is
the plain foods and dishes — "rice, white, cooked", "lentil soup", "chicken breast, grilled" — with every vitamin and mineral and
the portions people really eat ("1 cup = 158 g", "1 medium = 118 g"). Sources, all free for commercial use:

  USDA FoodData Central (public domain, CC0):
    Foundation Foods      ~400 foods, lab-analysed, the newest values
    FNDDS (survey foods)  ~5,400 foods AS EATEN — mixed dishes, cooked foods, drinks — with household portions
    SR Legacy             ~7,800 foods, the classic reference table, with portions
  (next: the Canadian Nutrient File, Open Government Licence – Canada — its site did not answer from the build machines yet)

Output (out/): foodgen-000.tsv.gz + manifest.json — the products pack's 16 columns (code name ar brand kcal p c f fib sug sat salt
serving egypt grade nova) + two more: micro (JSON, per 100 g) and portions (JSON, name → grams). code = "usda:<fdc_id>".
Arabic names: each food's first words translated by the dictionary below (Egyptian words), so «رز مطبوخ» finds "Rice, cooked".

  python3 tools/build_food_generic.py out --fdc <folder with the three unzipped FDC csv folders>
"""
import sys, os, csv, json, gzip, hashlib, time, re, argparse

csv.field_size_limit(1 << 30)

# FDC nutrient ids → our keys (per 100 g). Energy: 1008, else the Atwater energies (Foundation foods)
N = {"1008": "kcal", "2047": "kcal_a", "2048": "kcal_s", "1003": "p", "1005": "c", "1004": "f", "1079": "fib", "2000": "sug", "1063": "sug2",
     "1258": "sat", "1093": "na",
     "1089": "fe", "1087": "ca", "1162": "vc", "1114": "vd", "1092": "k", "1090": "mg", "1178": "b12", "1106": "va",
     "1095": "zn", "1177": "fol", "1190": "fol_dfe", "1253": "chol", "1175": "b6", "1109": "ve", "1185": "vk", "1091": "ph", "1103": "se", "1057": "caff"}
# the survey foods (FNDDS) give the old nutrient NUMBERS instead of the ids
N.update({"208": "kcal", "203": "p", "205": "c", "204": "f", "291": "fib", "269": "sug", "606": "sat", "307": "na", "303": "fe", "301": "ca",
          "401": "vc", "328": "vd", "306": "k", "304": "mg", "418": "b12", "320": "va", "309": "zn", "417": "fol", "435": "fol_dfe", "601": "chol",
          "415": "b6", "323": "ve", "430": "vk", "305": "ph", "317": "se", "262": "caff"})
MICRO = ["fe", "ca", "vc", "vd", "k", "mg", "b12", "va", "zn", "na", "fol", "chol", "b6", "ve", "vk", "ph", "se", "caff"]

# English food words → Egyptian Arabic (the words people type). The first 1–3 words of a USDA name are translated.
AR = {
 "rice": "رز", "white": "أبيض", "brown": "بني", "cooked": "مطبوخ", "boiled": "مسلوق", "fried": "مقلي", "grilled": "مشوي", "roasted": "محمّر",
 "baked": "في الفرن", "raw": "ني", "steamed": "على البخار", "stewed": "مطهي", "canned": "معلّب", "dried": "مجفف", "frozen": "مجمد", "fresh": "طازة",
 "chicken": "فراخ", "breast": "صدر", "thigh": "ورك", "wing": "جناح", "drumstick": "دبوس", "leg": "ورك", "beef": "لحمة بقري", "veal": "بتلو",
 "lamb": "ضاني", "mutton": "ضاني", "goat": "ماعز", "liver": "كبدة", "kidney": "كلاوي", "turkey": "رومي", "duck": "بط", "pigeon": "حمام", "rabbit": "أرانب",
 "fish": "سمك", "tuna": "تونة", "salmon": "سلمون", "sardines": "سردين", "sardine": "سردين", "shrimp": "جمبري", "squid": "كاليماري", "crab": "كابوريا",
 "tilapia": "بلطي", "mackerel": "ماكريل", "anchovy": "أنشوجة", "cod": "قد", "egg": "بيض", "eggs": "بيض", "omelet": "أومليت", "yolk": "صفار",
 "milk": "لبن", "yogurt": "زبادي", "cheese": "جبنة", "feta": "فيتا", "cottage": "قريش", "cream": "كريمة", "butter": "زبدة", "ghee": "سمنة",
 "bread": "عيش", "toast": "توست", "pita": "عيش شامي", "roll": "عيش فينو", "croissant": "كرواسون", "cake": "كيك", "cookie": "بسكوت", "cookies": "بسكوت",
 "biscuit": "بسكويت", "pasta": "مكرونة", "macaroni": "مكرونة", "spaghetti": "اسباجيتي", "noodles": "نودلز", "pizza": "بيتزا", "sandwich": "ساندوتش",
 "burger": "برجر", "hamburger": "همبرجر", "fries": "بطاطس مقلية", "potato": "بطاطس", "potatoes": "بطاطس", "sweet": "حلو", "corn": "دُرة",
 "oats": "شوفان", "oatmeal": "شوفان", "wheat": "قمح", "bulgur": "برغل", "flour": "دقيق", "cereal": "سيريال", "beans": "فول", "fava": "فول",
 "broadbeans": "فول", "lentils": "عدس", "lentil": "عدس", "chickpeas": "حمص", "hummus": "حمص بالطحينة", "peas": "بسلة", "soup": "شوربة",
 "salad": "سلطة", "tomato": "طماطم", "tomatoes": "طماطم", "cucumber": "خيار", "onion": "بصل", "onions": "بصل", "garlic": "توم", "pepper": "فلفل",
 "peppers": "فلفل", "carrot": "جزر", "carrots": "جزر", "lettuce": "خس", "cabbage": "كرنب", "spinach": "سبانخ", "okra": "بامية", "eggplant": "باذنجان",
 "zucchini": "كوسة", "squash": "كوسة", "cauliflower": "قرنبيط", "broccoli": "بروكلي", "mushrooms": "مشروم", "olives": "زيتون", "olive": "زيتون",
 "oil": "زيت", "sugar": "سكر", "honey": "عسل", "jam": "مربى", "chocolate": "شوكولاتة", "ice": "آيس", "juice": "عصير", "tea": "شاي", "coffee": "قهوة",
 "water": "مية", "soda": "مياه غازية", "cola": "كولا", "apple": "تفاح", "apples": "تفاح", "banana": "موز", "bananas": "موز", "orange": "برتقال",
 "oranges": "برتقال", "mango": "مانجة", "mangos": "مانجة", "guava": "جوافة", "grapes": "عنب", "watermelon": "بطيخ", "melon": "كانتلوب", "dates": "بلح",
 "figs": "تين", "strawberries": "فراولة", "pomegranate": "رمان", "peach": "خوخ", "peaches": "خوخ", "apricot": "مشمش", "apricots": "مشمش", "lemon": "ليمون",
 "lemons": "ليمون", "lime": "ليمون", "pear": "كمثرى", "pears": "كمثرى", "plum": "برقوق", "cherries": "كريز", "kiwi": "كيوي", "pineapple": "أناناس",
 "avocado": "أفوكادو", "coconut": "جوز هند", "nuts": "مكسرات", "almonds": "لوز", "peanuts": "سوداني", "peanut": "سوداني", "walnuts": "عين جمل",
 "pistachio": "فستق", "cashew": "كاجو", "hazelnuts": "بندق", "seeds": "بذور", "sesame": "سمسم", "tahini": "طحينة", "sauce": "صوص", "ketchup": "كاتشب",
 "mayonnaise": "مايونيز", "mustard": "مستردة", "vinegar": "خل", "salt": "ملح", "spices": "بهارات", "sausage": "سجق", "salami": "سلامي",
 "bacon": "بيكون", "ham": "هام", "meatballs": "كفتة", "steak": "ستيك", "roast": "روستو", "ground": "مفروم", "minced": "مفروم", "fillet": "فيليه",
 "nuggets": "ناجتس", "pancakes": "بان كيك", "waffles": "وافل", "donut": "دونات", "doughnut": "دونات", "pie": "فطيرة", "pastry": "فطير", "muffin": "مافن",
 "popcorn": "فشار", "chips": "شيبسي", "crackers": "كراكرز", "pudding": "مهلبية", "custard": "كاسترد", "rice pudding": "رز بلبن", "milkshake": "ميلك شيك",
 "smoothie": "سموزي", "beer": "بيرة", "wine": "نبيذ", "skim": "خالي الدسم", "whole": "كامل الدسم", "lowfat": "قليل الدسم", "nonfat": "خالي الدسم",
 "dry": "ناشف", "unsalted": "من غير ملح", "salted": "مملّح", "plain": "سادة", "mixed": "مشكل", "stuffed": "محشي", "vegetables": "خضار", "vegetable": "خضار",
 "fruit": "فاكهة", "lean": "قليل الدهن", "fat": "دهن", "skin": "بالجلد", "skinless": "من غير جلد", "boneless": "من غير عضم",
}
# two-word names in Arabic order ("chicken breast" → «صدر فراخ»)
AR.update({"chicken breast": "صدر فراخ", "chicken thigh": "ورك فراخ", "chicken wing": "جناح فراخ", "chicken wings": "جناح فراخ",
  "chicken drumstick": "دبوس فراخ", "chicken liver": "كبدة فراخ", "beef liver": "كبدة بقري", "egg white": "بياض بيض", "egg yolk": "صفار بيض",
  "olive oil": "زيت زيتون", "sweet potato": "بطاطا", "sweet potatoes": "بطاطا", "ice cream": "آيس كريم", "orange juice": "عصير برتقال",
  "apple juice": "عصير تفاح", "peanut butter": "زبدة سوداني", "cream cheese": "جبنة كريمي", "green beans": "فاصوليا خضرا", "kidney beans": "فاصوليا حمرا",
  "fava beans": "فول", "broad beans": "فول", "black tea": "شاي", "brown rice": "رز بني", "white rice": "رز أبيض", "ground beef": "لحمة مفرومة",
  "french fries": "بطاطس محمرة", "corn flakes": "كورن فليكس", "whole wheat": "قمح كامل", "rice pudding": "رز بلبن"})
# USDA names are "Head, kind, detail, method": the head (and the kind when it makes a known pair) is the food; after it only these
# safe details are added — a wrong Arabic name is worse than none
SAFE = {"cooked", "boiled", "fried", "grilled", "roasted", "baked", "raw", "steamed", "stewed", "canned", "dried", "frozen", "fresh",
        "plain", "salted", "unsalted", "skinless", "boneless", "stuffed", "mixed", "ground", "minced"}
DAIRY = {"milk", "yogurt", "cheese"}
FAT = {"whole": "كامل الدسم", "skim": "خالي الدسم", "nonfat": "خالي الدسم", "lowfat": "قليل الدسم", "low fat": "قليل الدسم", "reduced fat": "قليل الدسم"}
PAIRS = {("egg", "white"): "بياض بيض", ("egg", "yolk"): "صفار بيض", ("egg", "whole"): "بيض", ("beans", "snap"): "فاصوليا خضرا",
         ("beans", "kidney"): "فاصوليا حمرا", ("beans", "navy"): "فاصوليا بيضا", ("beans", "white"): "فاصوليا بيضا", ("beans", "pinto"): "فاصوليا",
         ("beans", "fava"): "فول", ("broadbeans", "mature seeds"): "فول", ("nuts", "almonds"): "لوز", ("nuts", "walnuts"): "عين جمل",
         ("nuts", "pistachio nuts"): "فستق", ("nuts", "cashew nuts"): "كاجو", ("nuts", "hazelnuts or filberts"): "بندق", ("rice", "white"): "رز أبيض",
         ("rice", "brown"): "رز بني", ("chicken", "breast"): "صدر فراخ", ("chicken", "thigh"): "ورك فراخ", ("chicken", "wing"): "جناح فراخ",
         ("chicken", "liver"): "كبدة فراخ", ("beef", "liver"): "كبدة بقري", ("cheese", "feta"): "جبنة فيتا", ("cheese", "cottage"): "جبنة قريش",
         ("cheese", "mozzarella"): "جبنة موتزاريلا", ("cheese", "cheddar"): "جبنة شيدر", ("oil", "olive"): "زيت زيتون", ("potatoes", "french fried"): "بطاطس محمرة"}
def ar_name(en):
    parts = [p.strip().lower() for p in re.split(r",|\(|\)", en) if p.strip()]
    if not parts: return ""
    head = parts[0]
    if len(parts) > 1 and (head, parts[1]) in PAIRS: out, rest = [PAIRS[(head, parts[1])]], parts[2:]
    elif head in ("soup", "salad", "juice", "sauce", "pie", "cake", "sandwich") and len(parts) > 1 and parts[1] in AR: out, rest = [AR[head] + " " + AR[parts[1]]], parts[2:]
    elif head in AR: out, rest = [AR[head]], parts[1:]
    else:
        ws = head.split()
        if len(ws) == 2 and " ".join(ws) in AR: out, rest = [AR[" ".join(ws)]], parts[1:]
        else: return ""
    for p in rest[:4]:
        if p in SAFE and p in AR: out.append(AR[p])
        elif head in DAIRY and p in FAT: out.append(FAT[p])
    return " ".join(dict.fromkeys(out))

def num(x):
    try:
        v = float(x); return v if v == v else None
    except Exception: return None

def read_folder(d, kind):
    """One FDC csv folder → {fdc_id: {"en", "n": {key: v}, "portions": {name: g}, "src"}} for the foods of that kind."""
    keep = {}
    with open(os.path.join(d, "food.csv"), newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["data_type"] == kind: keep[r["fdc_id"]] = {"en": r["description"].strip(), "n": {}, "portions": {}, "src": kind}
    with open(os.path.join(d, "food_nutrient.csv"), newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            x = keep.get(r["fdc_id"]); k = N.get(r["nutrient_id"])
            if x is None or not k: continue
            v = num(r["amount"])
            if v is not None: x["n"][k] = v
    units = {}
    mu = os.path.join(d, "measure_unit.csv")
    if os.path.exists(mu):
        with open(mu, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f): units[r["id"]] = r["name"]
    pp = os.path.join(d, "food_portion.csv")
    if os.path.exists(pp):
        with open(pp, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                x = keep.get(r["fdc_id"]); g = num(r["gram_weight"])
                if x is None or not g or g <= 0: continue
                desc = (r.get("portion_description") or "").strip()
                if not desc or desc.lower().startswith("quantity not specified"):
                    amt = (r.get("amount") or "").strip(); u = units.get(r.get("measure_unit_id"), "")
                    mod = (r.get("modifier") or "").strip()
                    if u == "undetermined": u = ""
                    desc = " ".join(t for t in [amt, u, mod] if t and not t.isdigit() or t == amt).strip()
                desc = re.sub(r"\s+", " ", desc)[:40]
                if desc and not re.match(r"^\d{4,}$", desc) and desc.lower() != "quantity not specified" and len(x["portions"]) < 8:
                    x["portions"].setdefault(desc, round(g, 1))
    return keep

def finish(x):
    n = x["n"]
    kcal = n.get("kcal") or n.get("kcal_s") or n.get("kcal_a")
    p, c, fat = n.get("p"), n.get("c"), n.get("f")
    if kcal is None or p is None or c is None or fat is None: return None
    if kcal < 0 or kcal > 950 or p + c + fat > 105: return None
    micro = {}
    for k in MICRO:
        v = n.get(k) if k != "fol" else (n.get("fol") if n.get("fol") is not None else n.get("fol_dfe"))
        if v is not None and v >= 0: micro[k] = round(v, 2) if v < 10 else round(v, 1)
    sug = n.get("sug") if n.get("sug") is not None else n.get("sug2")
    salt = round(n["na"] * 2.5 / 1000, 2) if n.get("na") is not None else None
    return {"kcal": round(kcal), "p": round(p, 1), "c": round(c, 1), "f": round(fat, 1), "fib": round(n.get("fib") or 0, 1),
            "sug": None if sug is None else round(sug, 1), "sat": None if n.get("sat") is None else round(n["sat"], 1), "salt": salt, "micro": micro}

def norm_name(s): return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("out"); ap.add_argument("--fdc", required=True)
    a = ap.parse_args()
    folders = {}
    for root, dirs, files in os.walk(a.fdc):
        if "food.csv" in files and "food_nutrient.csv" in files:
            for kind, tag in (("foundation_food", "foundation"), ("survey_fndds_food", "survey"), ("sr_legacy_food", "sr_legacy")):
                if tag in root: folders[kind] = root
    rows, seen = [], set()
    count = {}
    for kind in ("foundation_food", "survey_fndds_food", "sr_legacy_food"):   # the newest values first; a name kept once
        if kind not in folders: print("missing", kind, file=sys.stderr); continue
        for fid, x in read_folder(folders[kind], kind).items():
            fx = finish(x)
            if not fx: continue
            key = norm_name(x["en"])
            if key in seen: continue
            seen.add(key)
            portions = x["portions"]
            serving = next(iter(portions.values()), "")
            rows.append([("usda:" + fid), x["en"][:90], ar_name(x["en"]), "", fx["kcal"], fx["p"], fx["c"], fx["f"], fx["fib"],
                         "" if fx["sug"] is None else fx["sug"], "" if fx["sat"] is None else fx["sat"], "" if fx["salt"] is None else fx["salt"],
                         serving, 0, "", 0, json.dumps(fx["micro"], separators=(",", ":")), json.dumps(portions, separators=(",", ":"), ensure_ascii=False)])
            count[kind] = count.get(kind, 0) + 1
    os.makedirs(a.out, exist_ok=True)
    text = "\n".join("\t".join(str(c).replace("\t", " ").replace("\n", " ") for c in r) for r in rows) + "\n"
    name = "foodgen-000.tsv.gz"
    with gzip.open(os.path.join(a.out, name), "wt", encoding="utf-8", compresslevel=9) as f: f.write(text)
    path = os.path.join(a.out, name)
    sha = hashlib.sha256(open(path, "rb").read()).hexdigest()
    with_ar = sum(1 for r in rows if r[2])
    man = {"version": 1, "built": time.strftime("%Y-%m-%d"), "count": len(rows), "arabic": with_ar, "sources": count,
           "license": "USDA FoodData Central — public domain (CC0)", "shards": [{"name": name, "rows": len(rows), "bytes": os.path.getsize(path), "sha256": sha}]}
    json.dump(man, open(os.path.join(a.out, "manifest.json"), "w"), indent=1)
    print(f"generic foods: {len(rows)} ({count}) · with an Arabic name: {with_ar} · {os.path.getsize(path)/1e6:.1f} MB")

if __name__ == "__main__":
    main()
