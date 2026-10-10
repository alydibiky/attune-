"""v6.10 — where each line of a PDF lands in the converted Word file (printed by LibreOffice): dx / dy in points per
line, matched by its first words, and the mean |dy|.   python3 linepos.py original.pdf converted.docx [-q]"""
import sys, subprocess, shutil, tempfile
import pdfplumber

def lines(pdf):
    return [(i, l["text"], round(l["x0"], 1), round(l["bottom"], 1)) for i, p in enumerate(pdfplumber.open(pdf).pages) for l in p.extract_text_lines()]

def main():
    pdf, dx = sys.argv[1], sys.argv[2]
    t = tempfile.mkdtemp(); shutil.copy(dx, t + "/in.docx")
    subprocess.run(["soffice", "-env:UserInstallation=file://" + t + "/lo", "--headless", "--convert-to", "pdf", "--outdir", t, t + "/in.docx"], capture_output=True)
    a, b = lines(pdf), lines(t + "/in.pdf")
    used, ds = set(), []
    for x in a:
        key = x[1][:12]
        y = next((y for k, y in enumerate(b) if k not in used and y[0] == x[0] and y[1][:12] == key and len(key) >= 4), None)
        if y: used.add(b.index(y)); ds.append(abs(y[3] - x[3]))
        if "-q" not in sys.argv: print(x[0], f"{x[1][:18]:18s}", "dx=%5.1f dy=%5.1f" % (y[2] - x[2], y[3] - x[3]) if y else "   --")
    print("lines matched %d/%d, mean |dy| %.1f pt" % (len(ds), len(a), sum(ds) / max(len(ds), 1)))

main()
