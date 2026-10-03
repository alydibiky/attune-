#!/usr/bin/env python3
"""Builds the photo fast path's files (v6.10): the image model, its runtime and the name bank.

Ali: "I want the photo recognition to be as fast as Yazio". A small image encoder on the phone turns a photo into
one vector; the bank holds one vector per food name, made here by the matching text encoder. The phone only compares
them (a dot product per name) — no language model, about a second, offline.

  python3 tools/build_food_clip_bank.py out/   → out/: food-clip-bank.json, food-clip-vision.onnx, the runtime, food-clip-manifest.json

What it does:
  1. reads every food of the app's table (web-src/fit.js FOODS, through node) and tools/food_clip_names.tsv
     (more names, dishes the table doesn't have, and things that are not food);
  2. one entry per food: its English names in a few phrasings → the text encoder → averaged → one unit vector;
  3. stores the vectors as int8 with one scale per row (≈ 0.5 KB a name) in food-clip-bank.json.
The model: an int8 image encoder (CLIP ViT-B/32, MIT licence; measured in PLANS / HANDOFF: 67 % top-1, 87 % top-5 on
Food-101 zero-shot, ≈ 210 ms a photo in the page, measured).
"""
import base64, json, os, subprocess, sys, urllib.request
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_REPO = "Xenova/clip-vit-base-patch32"
MODEL_FILES = {"vision": "onnx/vision_model_quantized.onnx", "text": "onnx/text_model.onnx", "tokenizer": "tokenizer.json"}
ORT_VERSION = "1.22.0"
ORT_FILES = ["ort.wasm.min.js", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]
TEMPLATES = ["a photo of {}, a type of food.", "a photo of {}.", "a close-up photo of a plate of {}."]
TEMPLATES_NOT_FOOD = ["a photo of {}."]
IMAGE = {"size": 224, "mean": [0.48145466, 0.4578275, 0.40821073], "std": [0.26862954, 0.26130258, 0.27577711]}
SKIP = {"whey", "sweetener", "sugar", "sugar-brown", "lemon", "tomato-paste", "molasses", "garlic", "beer-free", "energy-drink", "diet-cola", "sparkling", "juice-box"}


def app_foods():
    js = "import * as F from './web-src/fit.js'; console.log(JSON.stringify(F.FOODS.map((f) => ({ id: f.id, en: f.en, ar: f.ar, names: f.names }))));"
    out = subprocess.run(["node", "--input-type=module", "-e", js], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def latin(s):
    return not any("؀" <= ch <= "ۿ" for ch in s)


def clean(n):
    n = n.replace("(", ", ").replace(")", "").replace(" / ", " or ").strip(" ,")
    return " ".join(n.split())


def entries():
    """→ [{kind, id, en, ar, names}] — kind: "id" exact table food, "like" an estimate from a table food, "name" found by name, "not" not food."""
    foods = app_foods()
    by_id = {f["id"]: f for f in foods}
    out, at = [], {}
    for f in foods:
        if f["id"].endswith(("-raw", "-dry")) or f["id"] in SKIP: continue
        names = [clean(n) for n in f["names"] if latin(n)]
        at[f["id"]] = len(out)
        out.append({"kind": "id", "id": f["id"], "en": f["en"], "ar": f["ar"], "names": list(dict.fromkeys(names))})
    bad = []
    for line in open(os.path.join(ROOT, "tools", "food_clip_names.tsv"), encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("#"): continue
        cols = line.split("\t") + ["", ""]
        tag, names, ar = cols[0].strip(), [n.strip() for n in cols[1].split("|") if n.strip()], cols[2].strip()
        if not names: continue
        if tag == "!":
            out.append({"kind": "not", "id": "", "en": names[0], "ar": "", "names": names}); continue
        if tag == "-":
            out.append({"kind": "name", "id": "", "en": names[0], "ar": ar, "names": names}); continue
        like = tag.startswith("~"); fid = tag.lstrip("~")
        if fid not in by_id: bad.append(fid); continue
        if like:
            out.append({"kind": "like", "id": fid, "en": names[0][:1].upper() + names[0][1:], "ar": ar, "names": names}); continue
        if fid not in at:
            at[fid] = len(out); f = by_id[fid]
            out.append({"kind": "id", "id": fid, "en": f["en"], "ar": f["ar"], "names": []})
        e = out[at[fid]]
        e["names"] = list(dict.fromkeys(e["names"] + names))
    if bad: raise SystemExit("food_clip_names.tsv names foods the table doesn't have: " + ", ".join(sorted(set(bad))))
    for e in out:
        if e["kind"] in ("like", "name") and (not e["ar"] or not all(not ("a" <= c.lower() <= "z") for c in e["ar"])):
            raise SystemExit(f"Arabic name missing or has Latin letters: {e['en']}")
    return out


def fetch(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".part"
    urllib.request.urlretrieve(url, tmp); os.replace(tmp, path)
    return path


class TextEncoder:
    def __init__(self, cache):
        import onnxruntime as ort
        from tokenizers import Tokenizer
        base = f"https://huggingface.co/{MODEL_REPO}/resolve/main/"
        self.tok = Tokenizer.from_file(fetch(base + MODEL_FILES["tokenizer"], os.path.join(cache, "tokenizer.json")))
        self.sess = ort.InferenceSession(fetch(base + MODEL_FILES["text"], os.path.join(cache, "text_model.onnx")), providers=["CPUExecutionProvider"])

    def __call__(self, texts):
        out = []
        for i in range(0, len(texts), 64):
            part = texts[i:i + 64]
            ids = np.full((len(part), 77), 49407, np.int64)   # padded with the end token, as the model was trained
            for j, t in enumerate(part):
                e = self.tok.encode(t).ids[:77]
                if e[-1] != 49407: e[-1] = 49407
                ids[j, :len(e)] = e
            out.append(self.sess.run(None, {"input_ids": ids})[0])
        x = np.concatenate(out).astype(np.float32)
        return x / np.linalg.norm(x, axis=1, keepdims=True)


def embed(items, enc):
    texts, owner = [], []
    for k, e in enumerate(items):
        for n in e["names"][:8]:
            for t in (TEMPLATES_NOT_FOOD if e["kind"] == "not" else TEMPLATES):
                texts.append(t.format(n)); owner.append(k)
    v = enc(texts); owner = np.array(owner)
    m = np.zeros((len(items), v.shape[1]), np.float32)
    np.add.at(m, owner, v)
    return m / np.linalg.norm(m, axis=1, keepdims=True), len(texts)


def quantize(m):
    scale = np.abs(m).max(axis=1) / 127.0
    q = np.round(m / scale[:, None]).clip(-127, 127).astype(np.int8)
    return q, scale


CALIB_URL = "https://huggingface.co/api/datasets/ethz/food101/parquet/default/train/5.parquet"
BIAS_WEIGHT = 0.5   # measured: Food-101 top-1 67.1 → 69.1 %, Middle-Eastern plates 45.6 → 51.1 %


def image_prep(b):
    from PIL import Image
    import io
    im = Image.open(io.BytesIO(b)).convert("RGB")
    w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((IMAGE["size"], IMAGE["size"]), Image.BILINEAR)
    a = (np.asarray(im, np.float32) / 255.0 - np.array(IMAGE["mean"], np.float32)) / np.array(IMAGE["std"], np.float32)
    return a.transpose(2, 0, 1)


def calib_bias(vision_path, T, cache, n=600):
    """How much every name attracts ANY food photo (its mean similarity over 600 ordinary food photos). Some names
    ("ful medames") sit close to every brown plate; half of this is taken off their score on the phone. Only the
    600 numbers are kept — no photo is shipped."""
    import onnxruntime as ort, pyarrow.parquet as pq
    t = pq.read_table(fetch(CALIB_URL, os.path.join(cache, "calib.parquet")), columns=["image"])
    imgs = t.column("image").to_pylist()
    idx = np.random.default_rng(0).choice(len(imgs), min(n, len(imgs)), replace=False)
    sess = ort.InferenceSession(vision_path, providers=["CPUExecutionProvider"])
    out = []
    for i in range(0, len(idx), 32):
        x = np.stack([image_prep(imgs[j]["bytes"]) for j in idx[i:i + 32]])
        out.append(sess.run(None, {"pixel_values": x})[0])
    e = np.concatenate(out); e /= np.linalg.norm(e, axis=1, keepdims=True)
    return (e @ T.T).mean(0)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out = args[0] if args else "out"
    cache = os.environ.get("FOOD_CLIP_CACHE", os.path.join(out, ".cache"))
    os.makedirs(out, exist_ok=True)
    base = f"https://huggingface.co/{MODEL_REPO}/resolve/main/"
    vision = fetch(base + MODEL_FILES["vision"], os.path.join(out, "food-clip-vision.onnx"))
    items = entries()
    m, n_texts = embed(items, TextEncoder(cache))
    q, scale = quantize(m)
    T = q.astype(np.float32) * scale[:, None]; T /= np.linalg.norm(T, axis=1, keepdims=True)
    bias = calib_bias(vision, T, cache) if "--no-calib" not in sys.argv else np.zeros(len(items))
    bank = {
        "v": 1, "model": MODEL_REPO, "file": "food-clip-vision.onnx", "dim": int(m.shape[1]), "image": IMAGE,
        "count": len(items), "texts": n_texts, "biasWeight": BIAS_WEIGHT,
        "items": [[e["kind"], e["id"], e["en"], e["ar"]] for e in items],
        "scale": [round(float(s), 7) for s in scale],
        "bias": [round(float(b), 4) for b in bias],
        "vec": base64.b64encode(q.tobytes()).decode(),
    }
    with open(os.path.join(out, "food-clip-bank.json"), "w", encoding="utf-8") as f: json.dump(bank, f, ensure_ascii=False, separators=(",", ":"))
    # the runtime (onnxruntime-web, MIT) from the npm registry
    fetch(f"https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-{ORT_VERSION}.tgz", os.path.join(cache, "ort.tgz"))
    import tarfile
    with tarfile.open(os.path.join(cache, "ort.tgz")) as t:
        for f in ORT_FILES:
            with open(os.path.join(out, f), "wb") as w: w.write(t.extractfile("package/dist/" + f).read())
    files = {f: os.path.getsize(os.path.join(out, f)) for f in sorted(os.listdir(out)) if not f.startswith(".") and not f.endswith(".json")}
    files["food-clip-bank.json"] = os.path.getsize(os.path.join(out, "food-clip-bank.json"))
    manifest = {"v": 1, "model": MODEL_REPO, "ort": ORT_VERSION, "count": len(items), "texts": n_texts, "files": [{"name": k, "bytes": v} for k, v in files.items()]}
    with open(os.path.join(out, "food-clip-manifest.json"), "w") as f: json.dump(manifest, f, indent=1)
    kinds = {}
    for e in items: kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
    print(f"bank: {len(items)} foods ({kinds}), {n_texts} name phrasings, {files['food-clip-bank.json'] // 1024} KB; files: {files}")


if __name__ == "__main__":
    main()
