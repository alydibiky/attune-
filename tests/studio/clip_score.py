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
rows = {}
for d in sorted(glob.glob(os.path.join(root, "*", ""))):
    name = os.path.basename(os.path.dirname(d)); sc = []; tm = []
    for i, p in enumerate(prompts):
        f = os.path.join(d, f"{i}.png")
        if not os.path.exists(f): sc.append(None); continue
        with torch.no_grad():
            x = pr(text=[p], images=Image.open(f).convert("RGB"), return_tensors="pt", padding=True, truncation=True)
            o = m(**x); s = torch.nn.functional.cosine_similarity(o.image_embeds, o.text_embeds).item() * 100
        sc.append(round(s, 1))
    t = json.load(open(os.path.join(d, "times.json"))) if os.path.exists(os.path.join(d, "times.json")) else {}
    rows[name] = (sc, t)
print("| Model | Mean CLIP | " + " | ".join(f"P{i+1}" for i in range(len(prompts))) + " | Seconds / picture |"); print("|---|---|" + "---|" * len(prompts) + "---|")
for name, (sc, t) in rows.items():
    ok = [x for x in sc if x is not None]
    print(f"| {name} | **{(sum(ok)/len(ok)) if ok else 0:.1f}** | " + " | ".join("—" if x is None else str(x) for x in sc) + f" | {t.get('mean', '?')} |")
print(); [print(f"- P{i+1}: {p}") for i, p in enumerate(prompts)]
