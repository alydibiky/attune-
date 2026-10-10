"""Draft then clear: how much each early picture (the 384 px draft D, the step-1 preview Q1) looks like the clear
picture (CLIP image similarity to F, same seed), and how well each matches the prompt (CLIP score)."""
import sys, os, csv, torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

d = sys.argv[1]
prompts = [l.strip() for l in open(sys.argv[2]) if l.strip()]
m = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
p = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")


def unit(e):
    if not torch.is_tensor(e):   # newer versions return an output object
        e = getattr(e, "image_embeds", None) if getattr(e, "image_embeds", None) is not None else (getattr(e, "text_embeds", None) if getattr(e, "text_embeds", None) is not None else e.pooler_output)
    return e / e.norm(dim=-1, keepdim=True)


def img(f):
    with torch.no_grad():
        return unit(m.get_image_features(**p(images=Image.open(f).convert("RGB"), return_tensors="pt")))


def txt(t):
    with torch.no_grad():
        return unit(m.get_text_features(**p(text=[t], return_tensors="pt", padding=True, truncation=True)))


rows = list(csv.DictReader(open(os.path.join(d, "times.csv"))))
agg = {}
for r in rows:
    i = r["i"]
    F = img(f"{d}/{i}-F.png")
    tx = txt(prompts[int(i)])
    for v in ["F", "D", "Q1", "R", "I", "P", "Q"]:
        f = f"{d}/{i}-{v}.png"
        if not os.path.exists(f):
            continue
        e = img(f)
        a = agg.setdefault(v, [0.0, 0.0, 0])
        a[0] += float(e @ F.T)
        a[1] += 100 * float(e @ tx.T)
        a[2] += 1
print("| picture | looks like the final (CLIP sim) | prompt match (CLIP) |\n|---|---|---|")
for v, (s, c, n) in agg.items():
    print(f"| {v} | {s / n:.3f} | {c / n:.1f} |")
cols = [c for c in rows[0].keys() if c != "i"]
print("\nmean seconds:", {c: round(sum(float(r[c]) for r in rows if r[c] != "NA") / max(1, sum(1 for r in rows if r[c] != "NA")), 1) for c in cols})
