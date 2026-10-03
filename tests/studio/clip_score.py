#!/usr/bin/env python3
"""CLIP prompt-match: how well does each picture show what the prompt asked? (cosine similarity ×100 with openai/clip-vit-base-patch32).
   python3 clip_score.py out_dir  → reads out_dir/<model>/<n>.png and prompts.txt, prints a markdown table.
A rough but objective yardstick: 'a red crane over the sea' scores clearly below 'a red crane lifting a beam on a site' for the second prompt."""
import sys, os, glob, json
from PIL import Image
import torch
from transformers import CLIPModel, CLIPProcessor
root = sys.argv[1]
prompts = [l.strip() for l in open(os.path.join(root, "prompts.txt")) if l.strip()]
m = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").eval(); pr = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
# PICK=1: also PickScore (a CLIP-H model tuned on human picture preferences) so we do not tune to CLIP alone
pk = None
if os.environ.get("PICK"):
    from transformers import AutoModel, AutoProcessor
    try: pk = (AutoModel.from_pretrained("yuvalkirstain/PickScore_v1").eval(), AutoProcessor.from_pretrained("laion/CLIP-ViT-H-14-laion2B-s32B-b79K"))
    except Exception as e: print("PickScore unavailable:", e)
def pick(p, img):
    with torch.no_grad():
        x = pk[1](text=[p], images=img, return_tensors="pt", padding=True, truncation=True, max_length=77)
        ie = pk[0].get_image_features(pixel_values=x["pixel_values"]); te = pk[0].get_text_features(input_ids=x["input_ids"], attention_mask=x["attention_mask"])
        return torch.nn.functional.cosine_similarity(ie, te).item() * 100
def sharp(img):
    """Clarity: variance of the Laplacian on the grey picture resized to 512 px (fair across sizes; higher = crisper detail)."""
    import numpy as np
    g = np.asarray(img.convert("L").resize((512, 512), Image.LANCZOS), dtype=np.float32)
    lap = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float(lap.var())
short_sheet = True   # contact sheet per candidate (sheet-<name>.png) so pictures can be compared by eye
rows = {}
for d in sorted(glob.glob(os.path.join(root, "*", ""))):
    name = os.path.basename(os.path.dirname(d)); sc = []; tm = []; ps = []; sh = []
    for i, p in enumerate(prompts):
        f = os.path.join(d, f"{i}.png")
        if not os.path.exists(f): sc.append(None); continue
        with torch.no_grad():
            x = pr(text=[p], images=Image.open(f).convert("RGB"), return_tensors="pt", padding=True, truncation=True)
            o = m(**x); s = torch.nn.functional.cosine_similarity(o.image_embeds, o.text_embeds).item() * 100
        sc.append(round(s, 1))
        sh.append(sharp(Image.open(f)))
        if pk:
            try: ps.append(pick(p, Image.open(f).convert("RGB")))
            except Exception as e: print("PickScore failed:", e); pk = None
    t = json.load(open(os.path.join(d, "times.json"))) if os.path.exists(os.path.join(d, "times.json")) else {}
    rows[name] = (sc, t, ps, sh)
    if short_sheet:
        ims = [Image.open(os.path.join(d, f"{i}.png")).convert("RGB").resize((256, 256)) for i in range(len(prompts)) if os.path.exists(os.path.join(d, f"{i}.png"))]
        if ims:
            W = 5; sheet = Image.new("RGB", (256 * W, 256 * ((len(ims) + W - 1) // W)), "white")
            for k, im in enumerate(ims): sheet.paste(im, ((k % W) * 256, (k // W) * 256))
            sheet.save(os.path.join(root, f"sheet-{name}.png"))
short = len(prompts) > 8   # many prompts: a compact table (means only)
print("| Model | Mean CLIP | " + ("Mean PickScore | Sharpness | Missing | " if short else " | ".join(f"P{i+1}" for i in range(len(prompts))) + " | ") + "Seconds / picture |")
print("|---|---|" + ("---|---|---|" if short else "---|" * len(prompts)) + "---|")
for name, (sc, t, ps, sh) in rows.items():
    ok = [x for x in sc if x is not None]
    mid = (f"{(sum(ps)/len(ps)) if ps else 0:.2f} | {(sum(sh)/len(sh)) if sh else 0:.0f} | {len(sc)-len(ok)} | " if short else " | ".join("—" if x is None else str(x) for x in sc) + " | ")
    print(f"| {name} | **{(sum(ok)/len(ok)) if ok else 0:.1f}** | " + mid + f"{t.get('mean', '?')} |")
print(); [print(f"- P{i+1}: {p}") for i, p in enumerate(prompts)]
