"""Draft then clear: how much each final looks like the draft (CLIP image similarity) and how well it matches the prompt."""
import sys, os, csv, torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

d = sys.argv[1]
prompts = [l.strip() for l in open(sys.argv[2]) if l.strip()]
m = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
p = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")


def img(f):
    with torch.no_grad():
        e = m.get_image_features(**p(images=Image.open(f).convert("RGB"), return_tensors="pt"))
    return e / e.norm(dim=-1, keepdim=True)


def txt(t):
    with torch.no_grad():
        e = m.get_text_features(**p(text=[t], return_tensors="pt", padding=True, truncation=True))
    return e / e.norm(dim=-1, keepdim=True)


rows = list(csv.DictReader(open(os.path.join(d, "times.csv"))))
agg = {}
for r in rows:
    i = r["i"]
    D = img(f"{d}/{i}-D.png")
    tx = txt(prompts[int(i)])
    for v in ["D", "F", "R", "I", "P"]:
        f = f"{d}/{i}-{v}.png"
        if not os.path.exists(f):
            continue
        e = img(f)
        a = agg.setdefault(v, [0.0, 0.0, 0])
        a[0] += float(e @ D.T)
        a[1] += 100 * float(e @ tx.T)
        a[2] += 1
print("| variant | similar to draft | prompt match (CLIP) |\n|---|---|---|")
for v, (s, c, n) in agg.items():
    print(f"| {v} | {s / n:.3f} | {c / n:.1f} |")
cols = ["F", "P", "P_first_preview", "D", "R", "I"]
print("\nmean seconds:", {c: round(sum(float(r[c]) for r in rows if r[c] != "NA") / max(1, sum(1 for r in rows if r[c] != "NA")), 1) for c in cols})
