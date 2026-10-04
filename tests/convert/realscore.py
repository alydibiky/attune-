"""v6.10 — how close a converted Word file is to a REAL PDF (no original .docx to compare with).
python3 realscore.py original.pdf converted.docx expect.json [--png side.png]
Scores (0–100):
  text       words of the PDF's text layer found in the same order in the Word file (difflib ratio)
  paragraphs / tables / pictures / pages   counts against the expected numbers (expect.json, written by hand
             from looking at the original), 100 = exact, minus 100 * |diff| / expected
  ssim       how alike the pages look: the Word file printed by LibreOffice, each page against the original's
             page (grey, 60 dpi, 7x7 windows); a missing page scores 0
Prints one JSON line."""
import sys, re, json, os, difflib, subprocess, tempfile, shutil
import numpy as np
import pypdfium2 as pdfium
from PIL import Image
from docx import Document

def words(t): return re.findall(r"\w+|[^\w\s]", t or "", re.U)

def docx_pdf(path):
    tmp = tempfile.mkdtemp()
    prof = "file://" + os.path.join(tmp, "lo")
    src = os.path.join(tmp, "in.docx"); shutil.copy(path, src)
    subprocess.run(["soffice", "-env:UserInstallation=" + prof, "--headless", "--norestore", "--convert-to", "pdf", "--outdir", tmp, src], capture_output=True, timeout=240)
    return os.path.join(tmp, "in.pdf")

def pages(pdf, scale=60 / 72):
    return [np.asarray(pg.render(scale=scale).to_pil().convert("L"), dtype=np.float64) for pg in pdfium.PdfDocument(pdf)]

def box(a, k=7):
    c = np.cumsum(np.cumsum(np.pad(a, ((1, 0), (1, 0))), 0), 1)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)

def ssim(a, b):
    h, w = min(a.shape[0], b.shape[0]), min(a.shape[1], b.shape[1])
    a, b = a[:h, :w], b[:h, :w]
    C1, C2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    ma, mb = box(a), box(b)
    va, vb, cab = box(a * a) - ma * ma, box(b * b) - mb * mb, box(a * b) - ma * mb
    return float(np.mean(((2 * ma * mb + C1) * (2 * cab + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2))))

def cnt(got, want): return max(0, round(100 - 100 * abs(got - want) / max(want, 1))) if want is not None else None

def main():
    a = sys.argv[1:]
    png = a[a.index("--png") + 1] if "--png" in a else None
    pdf, dx, ex = a[0], a[1], json.load(open(a[2])) if len(a) > 2 and a[2].endswith(".json") else {}
    d = Document(dx)
    paras = [p for p in d.paragraphs if p.text.strip()]
    body = " ".join(p.text for p in d.paragraphs) + " " + " ".join(c.text for t in d.tables for r in t.rows for c in r.cells)
    ref = " ".join(pg.get_textpage().get_text_range() for pg in pdfium.PdfDocument(pdf))
    wa, wb = words(ref), words(body)
    sm = difflib.SequenceMatcher(None, wa, wb, autojunk=False)
    text = round(100 * sum(m.size for m in sm.get_matching_blocks()) / max(len(wa), 1))
    pics = len(d.inline_shapes)
    out_pdf = docx_pdf(dx)
    pa, pb = pages(pdf), pages(out_pdf) if os.path.exists(out_pdf) else []
    s = [ssim(pa[i], pb[i]) if i < len(pb) else 0 for i in range(len(pa))]
    r = {"text": text, "paragraphs": cnt(len(paras), ex.get("paragraphs")), "tables": cnt(len(d.tables), ex.get("tables", 0)),
         "pictures": cnt(pics, ex.get("pictures", 0)), "pages": cnt(len(pb), len(pa)), "ssim": round(100 * sum(s) / max(len(s), 1), 1)}
    print(json.dumps({k: v for k, v in r.items() if v is not None}))
    if png and os.path.exists(out_pdf):
        subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "sidepdf.py"), pdf, out_pdf, png, str(len(pa))])

main()
