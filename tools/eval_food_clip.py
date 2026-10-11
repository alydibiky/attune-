#!/usr/bin/env python3
"""Measures the photo fast path (v6.10) on real photos: the bank built by build_food_clip_bank.py + the image model.

  python3 tools/eval_food_clip.py <bank dir with food-clip-bank.json + food-clip-vision.onnx> <testset.pkl>

testset.pkl = {"f101": [(class_name, jpeg bytes)…], "me": [(dish name, jpeg bytes)…]} made from Hugging Face datasets
(ethz/food101 validation — research use, so the photos are never committed; WissMah/middle_eastern_mixed_food_dataset).
Prints top-1 / top-5 against the whole bank (what the phone does) and the confidence rule's precision and coverage.
"""
import base64, io, json, os, pickle, re, sys, time
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_food_clip_bank as B

# Middle-Eastern photos: a dish counts as found when the answer names one of these words
ME_KEYS = [("grape leaves|warak|yalanji|dolma", "grape leaves|warak enab|dolma|yalanji|mahshi"), ("tabbouleh", "tabbouleh"), ("burger", "burger"),
           ("pizza", "pizza"), ("molokhia", "molokhia"), ("manakish|manakeesh|zaatar", "manakish|zaatar"), ("salmon", "salmon"), ("hummus", "hummus|fatta"),
           ("omelette", "omelette|eggs"), ("pancake", "pancake"), ("yogurt|parfait", "yogurt"), ("alfredo|pasta|penne|tortellini|gnocchi|noodles", "pasta|alfredo|negresco|bolognese|ravioli|gnocchi|lasagna"),
           ("kafta|kofta", "kofta|kafta"), ("tacos", "tacos"), ("fries", "fries"), ("curry", "curry"), ("schnitzel", "schnitzel|pane|breaded"), ("sandwich|ciabatta", "sandwich|toast|club"),
           ("salad", "salad|tabbouleh|fattoush"), ("french toast", "french toast"), ("rice", "rice|kabsa|biryani|mandi|curry")]
# Arab dishes (WissMah/middle_eastern_mixed_food_dataset_golden, 3 photos per dish name): the dish and what counts as found
ARAB_KEYS = [("hummus|msabaha|msabbaha", "hummus"), ("warak|grape|yalanji", "grape leaves|vine leaves|warak enab"), ("kibbeh", "kibbeh"),
             ("kunafa|kataifi|knafeh", "kunafa|knafeh|kunefe"), ("shish.barak", "shish barak"), ("shawarma", "shawarma"), ("tabbouleh", "tabbouleh"),
             ("qatayef|atayef", "qatayef"), ("manakish|manakeesh", "manakish|manakeesh"), ("kebab|kofta|kafta", "kofta|kafta|kebab"), ("sfiha", "sfiha|fatayer")]


def prep(b, size, mean, std):
    im = Image.open(io.BytesIO(b)).convert("RGB")
    w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((size, size), Image.BILINEAR)
    a = (np.asarray(im, np.float32) / 255.0 - np.array(mean, np.float32)) / np.array(std, np.float32)
    return a.transpose(2, 0, 1)


ARAB = set("eg sa ae ma dz tn lb sy jo iq sd ly kw qa bh om ye ps".split())


def prior_of(cc, user, p):
    """The same rule as web-src/fitclip.js priorOf()."""
    if not p or not cc: return 0.0
    if cc == "base": return p["own"] if user == "eg" else 0.0
    if cc in ("intl", "plain", "not"): return 0.0
    if cc == user: return p["own"]
    if cc in ARAB and user in ARAB: return p["region"]
    return p["other"]


def prep2(b, im):
    """v2: each model's own way of looking at the photo (CLIP: the centre square; SigLIP: the whole photo, squeezed)."""
    from PIL import Image as I
    img = I.open(io.BytesIO(b)).convert("RGB"); s = im["size"]
    if im.get("fit") == "stretch": img = img.resize((s, s), I.BILINEAR)
    else:
        w, h = img.size; m = min(w, h)
        img = img.crop(((w - m) // 2, (h - m) // 2, (w - m) // 2 + m, (h - m) // 2 + m)).resize((s, s), I.BILINEAR)
    a = (np.asarray(img, np.float32) / 255.0 - np.array(im["mean"], np.float32)) / np.array(im["std"], np.float32)
    return a.transpose(2, 0, 1)


def main_v2(d, ts, bank, user="eg"):
    import onnxruntime as ort
    names = [e["names"] for e in B.entries()]
    assert len(names) == bank["count"], "the bank was built from another names list"
    n = bank["count"]; P = np.array([prior_of(it[4] if len(it) > 4 else "", user, bank.get("prior")) for it in bank["items"]], np.float32)
    encs = []
    for e in bank["encoders"]:
        q = np.frombuffer(base64.b64decode(e["vec"]), np.int8).reshape(n, e["dim"]).astype(np.float32) * np.array(e["scale"], np.float32)[:, None]
        q /= np.linalg.norm(q, axis=1, keepdims=True)
        sess = ort.InferenceSession(os.path.join(d, e["file"]), providers=["CPUExecutionProvider"])
        encs.append((e, q, sess))
    data = pickle.load(open(ts, "rb"))
    def norm(s): return " " + re.sub(r"[^a-z ]", " ", s.lower().replace("_", " ")) + " "
    def sq(s): return re.sub(r"(es|s)\b", "", re.sub(r"[^a-z ]", " ", s.lower().replace("_", " "))).replace(" ", "")
    def has(k, words): return any(norm(w).strip() in norm(x) or sq(w) in sq(x) for x in names[k] for w in words.split("|"))
    for set_name, items, ok in [
        ("food101", data["f101"], lambda lab, k: has(k, lab.replace("_", " ")) or has(k, lab.replace("_", " ").rstrip("s"))),
        ("middle_east", [(n_, b) for n_, b in data["me"] if any(re.search(a, n_.lower().replace("_", " ")) for a, _ in ME_KEYS)],
         lambda lab, k: any(has(k, want) for a, want in ME_KEYS if re.search(a, lab.lower().replace("_", " ")))),
        ("arab_dishes", [(n_, b) for n_, b in data.get("arab", []) if any(re.search(a, n_.lower().replace("_", " ")) for a, _ in ARAB_KEYS)],
         lambda lab, k: any(has(k, want) for a, want in ARAB_KEYS if re.search(a, lab.lower().replace("_", " ")))),
    ]:
        if not items: continue
        S = np.zeros((len(items), n), np.float32)
        for e, T, sess in encs:
            outs = [o.name for o in sess.get_outputs()]; oi = outs.index(e["output"]) if e.get("output") in outs else len(outs) - 1
            E = np.concatenate([sess.run(None, {"pixel_values": np.stack([prep2(b, e["image"]) for _, b in items[i:i + 16]])})[oi] for i in range(0, len(items), 16)])
            E = E / np.linalg.norm(E, axis=1, keepdims=True); x = E @ T.T
            S += (x - x.mean(1, keepdims=True)) / x.std(1, keepdims=True)
        S += P[None, :]
        top = np.argsort(-S, 1)[:, :5]
        z = bank.get("temp", 1.5) * (S - S.max(1, keepdims=True)); p = np.exp(z); p /= p.sum(1, keepdims=True); conf = p.max(1)
        c1 = np.array([ok(lab, top[i, 0]) for i, (lab, _) in enumerate(items)]); c5 = np.array([any(ok(lab, k) for k in top[i]) for i, (lab, _) in enumerate(items)])
        sel = conf >= bank.get("auto", 0.6)
        print(set_name, json.dumps({"n": len(items), "top1": round(float(c1.mean()), 3), "top5": round(float(c5.mean()), 3),
                                    "auto": round(float(sel.mean()), 3), "auto_right": round(float(c1[sel].mean()) if sel.any() else 0, 3)}), flush=True)


def main():
    d, ts = sys.argv[1], sys.argv[2]
    _b = json.load(open(os.path.join(d, "food-clip-bank.json")))
    if _b.get("v") == 2: return main_v2(d, ts, _b, os.environ.get("FIT_COUNTRY", "eg"))
    import onnxruntime as ort
    bank = json.load(open(os.path.join(d, "food-clip-bank.json")))
    names = [e["names"] for e in B.entries()]
    assert len(names) == bank["count"], "the bank was built from another names list"
    q = np.frombuffer(base64.b64decode(bank["vec"]), np.int8).reshape(bank["count"], bank["dim"]).astype(np.float32)
    T = q * np.array(bank["scale"], np.float32)[:, None]
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    sess = ort.InferenceSession(os.path.join(d, bank["file"]), providers=["CPUExecutionProvider"])
    im = bank["image"]
    data = pickle.load(open(ts, "rb"))

    def embed(items):
        out = []
        for i in range(0, len(items), 32):
            x = np.stack([prep(b, im["size"], im["mean"], im["std"]) for _, b in items[i:i + 32]])
            out.append(sess.run(None, {"pixel_values": x})[0])
        e = np.concatenate(out); return e / np.linalg.norm(e, axis=1, keepdims=True)

    def norm(s): return " " + re.sub(r"[^a-z ]", " ", s.lower().replace("_", " ")) + " "
    def has(k, words): return any(norm(w).strip() in norm(n) for n in names[k] for w in words.split("|"))

    res = {}
    for set_name, items, ok in [
        ("food101", data["f101"], lambda lab, k: has(k, lab.replace("_", " ")) or has(k, lab.replace("_", " ").rstrip("s"))),
        ("middle_east", [(n, b) for n, b in data["me"] if any(re.search(a, n.lower().replace("_", " ")) for a, _ in ME_KEYS)],
         lambda lab, k: any(has(k, want) for a, want in ME_KEYS if re.search(a, lab.lower().replace("_", " ")))),
        ("arab_dishes", [(n, b) for n, b in data.get("arab", []) if any(re.search(a, n.lower().replace("_", " ")) for a, _ in ARAB_KEYS)],
         lambda lab, k: any(has(k, want) for a, want in ARAB_KEYS if re.search(a, lab.lower().replace("_", " ")))),
    ]:
        if not items: continue
        E = embed(items)
        sim = E @ T.T - bank.get("biasWeight", 0) * np.array(bank.get("bias", [0] * bank["count"]), np.float32)[None, :]
        top = np.argsort(-sim, 1)[:, :5]
        p = np.exp(100 * (sim - sim.max(1, keepdims=True))); p /= p.sum(1, keepdims=True)
        conf = p[np.arange(len(items)), top[:, 0]]
        c1 = np.array([ok(lab, top[i, 0]) for i, (lab, _) in enumerate(items)])
        c5 = np.array([any(ok(lab, k) for k in top[i]) for i, (lab, _) in enumerate(items)])
        r = {"n": len(items), "top1": round(float(c1.mean()), 3), "top5": round(float(c5.mean()), 3), "rule": {}}
        for th in [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]:
            sel = conf >= th
            r["rule"][th] = {"auto": round(float(sel.mean()), 3), "precision": round(float(c1[sel].mean()) if sel.any() else 0, 3)}
        res[set_name] = r
        print(set_name, json.dumps(r))
        if set_name == "arab_dishes":
            for i, (lab, _) in enumerate(items[:400]):
                if not c1[i]: print("  miss:", lab, "→", [bank["items"][k][2] for k in top[i][:3]])
    x = np.random.rand(1, 3, im["size"], im["size"]).astype(np.float32)
    so = ort.SessionOptions(); so.intra_op_num_threads = 1
    s1 = ort.InferenceSession(os.path.join(d, bank["file"]), so, providers=["CPUExecutionProvider"])
    for _ in range(3): s1.run(None, {"pixel_values": x})
    t = time.time()
    for _ in range(10): s1.run(None, {"pixel_values": x})
    t2 = time.time()
    for _ in range(100): (T @ x.reshape(-1)[:bank["dim"]])
    print("image model, one core: %.0f ms; bank compare: %.2f ms" % ((t2 - t) * 100, (time.time() - t2) * 10))


if __name__ == "__main__":
    main()
