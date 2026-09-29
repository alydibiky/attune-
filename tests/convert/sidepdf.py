"""v6.8 — two PDFs' pages side by side (the original's printout and ours). python3 sidepdf.py a.pdf b.pdf out.png"""
import sys
import pypdfium2 as pdfium
from PIL import Image
pa = [pg.render(scale=1.2).to_pil() for pg in pdfium.PdfDocument(sys.argv[1])][:int(sys.argv[4]) if len(sys.argv) > 4 else 3]
pb = [pg.render(scale=1.2).to_pil() for pg in pdfium.PdfDocument(sys.argv[2])][:int(sys.argv[4]) if len(sys.argv) > 4 else 3]
w = max(x.width for x in pa + pb); h = max(x.height for x in pa + pb); n = max(len(pa), len(pb))
img = Image.new("RGB", (w * 2 + 20, (h + 10) * n), "#888")
for i in range(n):
    if i < len(pa): img.paste(pa[i], (0, i * (h + 10)))
    if i < len(pb): img.paste(pb[i], (w + 20, i * (h + 10)))
img.save(sys.argv[3])
