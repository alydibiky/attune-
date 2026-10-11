#!/usr/bin/env python3
"""Turns the MM-Food-100K photos into the phone's two image vectors (v6.18), for training the photo fast path.

Ali: "I want an accuracy of above 80 percent". The fast path knows dishes only from their names (text vectors); real
photos of each dish teach it what the dish looks like, and each photo's labelled calories and grams let a new photo
borrow the amounts of the photos most like it.

MM-Food-100K (Humanbased-AI/MM-Food-100K, OpenRAIL licence: commercial use allowed) is a table of 100,000 phone photos
with dish name, ingredients, grams per ingredient and calories. The photos live on file.b18a.io (reachable from GitHub's
machines, not from every sandbox), so this runs in .github/workflows/food-train.yml, one shard per machine:

  python3 tools/embed_mmfood.py <shard> <shards> <out dir>
  → <out>/mmfood-<shard>.npz: clip (n×512 float16), siglip (n×768 float16), row (n, the CSV row number)

Each photo is read the way the phone reads it (web-src/fitclip.js: CLIP the centre square, SigLIP the whole photo
squeezed), with the same int8 models the phone downloads. No photo is kept — only the vectors.
"""
import csv, io, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_food_clip_bank as B

CSV_URL = "https://huggingface.co/datasets/Humanbased-AI/MM-Food-100K/resolve/main/MM-Food-100K.csv"


def rows(cache):
    path = B.fetch(CSV_URL, os.path.join(cache, "MM-Food-100K.csv"))
    csv.field_size_limit(10 ** 7)
    return list(csv.DictReader(open(path, encoding="utf-8")))


def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "attune-train"}), timeout=30) as r: return r.read()
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def prep(b):
    """→ (clip input, siglip input) or None. JPEG draft mode decodes at ≈ 1/4–1/8 size: much faster, same 224 px result."""
    try:
        img = Image.open(io.BytesIO(b)); img.draft("RGB", (448, 448)); img = img.convert("RGB")
    except Exception:
        return None
    out = []
    for cfg in B.ENCODERS:
        im, s = cfg["image"], cfg["image"]["size"]
        if im.get("fit") == "stretch": x = img.resize((s, s), Image.BILINEAR)
        else:
            w, h = img.size; m = min(w, h)
            x = img.crop(((w - m) // 2, (h - m) // 2, (w - m) // 2 + m, (h - m) // 2 + m)).resize((s, s), Image.BILINEAR)
        a = (np.asarray(x, np.float32) / 255.0 - np.array(im["mean"], np.float32)) / np.array(im["std"], np.float32)
        out.append(a.transpose(2, 0, 1))
    return out


def main():
    shard, shards, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    cache = os.environ.get("FOOD_CLIP_CACHE", os.path.join(out, ".cache"))
    os.makedirs(out, exist_ok=True)
    import onnxruntime as ort
    sess = []
    for cfg in B.ENCODERS:
        p = B.fetch(f"https://huggingface.co/{cfg['repo']}/resolve/main/{cfg['vision']}", os.path.join(cache, cfg["file"]))
        s = ort.InferenceSession(p, providers=["CPUExecutionProvider"])
        names = [o.name for o in s.get_outputs()]
        sess.append((s, names.index(cfg["output"]) if cfg["output"] in names else len(names) - 1))
    R = rows(cache)
    mine = [i for i in range(len(R)) if i % shards == shard and float(R[i].get("food_prob") or 0) >= 0.5]
    limit = int(os.environ.get("LIMIT", "0") or 0)
    if limit: mine = mine[:limit]
    print(f"shard {shard}/{shards}: {len(mine)} photos", flush=True)
    E = [[], []]; done = []; t0 = time.time(); failed = 0
    with ThreadPoolExecutor(48) as pool:
        for start in range(0, len(mine), 64):
            part = mine[start:start + 64]
            blobs = list(pool.map(lambda i: get(R[i]["image_url"]), part))
            ok = [(i, p) for i, b in zip(part, blobs) for p in [prep(b) if b else None] if p]
            failed += len(part) - len(ok)
            if not ok: continue
            for k, (s, oi) in enumerate(sess):
                v = s.run(None, {"pixel_values": np.stack([p[k] for _, p in ok])})[oi]
                E[k].append((v / np.linalg.norm(v, axis=1, keepdims=True)).astype(np.float16))
            done += [i for i, _ in ok]
            if start % 1280 == 0:
                el = time.time() - t0
                print(f"  {len(done)} done, {failed} failed, {el / 60:.1f} min, {len(done) / max(el, 1):.1f}/s", flush=True)
    np.savez_compressed(os.path.join(out, f"mmfood-{shard}.npz"), clip=np.concatenate(E[0]), siglip=np.concatenate(E[1]), row=np.array(done, np.int32))
    print(f"shard {shard}: {len(done)} photos, {failed} failed, {(time.time() - t0) / 60:.1f} min", flush=True)


if __name__ == "__main__":
    main()
