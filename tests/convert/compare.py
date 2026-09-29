"""v6.8 — how much of a document's formatting survived a conversion: the original .docx against the
converted one, part by part. python3 compare.py original.docx converted.docx [--png out.png]
Scores (0–100 %): text, headings, bold, italic, colour, font size, alignment, indents, lists, tables,
pictures, right-to-left paragraphs. --png renders page 1 of both side by side (LibreOffice + pdfium)."""
import sys, re, difflib, os, subprocess, tempfile, json
from docx import Document
from docx.oxml.ns import qn

def norm(t): return re.sub(r"\s+", " ", t or "").strip()

def eff(run, para, attr):
    v = getattr(run.font, attr)
    if v is None and attr in ("bold", "italic"):
        rPr = run._r.rPr
        if rPr is not None and rPr.find(qn("w:bCs" if attr == "bold" else "w:iCs")) is not None: v = True
    st = para.style
    while v is None and st is not None:
        v = getattr(st.font, attr); st = st.base_style
    return bool(v) if attr in ("bold", "italic") else v

def size_of(run, para, doc):
    v = run.font.size
    rPr = run._r.rPr
    if v is None and rPr is not None and rPr.find(qn("w:szCs")) is not None: v = int(rPr.find(qn("w:szCs")).get(qn("w:val"))) / 2 * 12700
    st = para.style
    while v is None and st is not None: v = st.font.size; st = st.base_style
    if v is None:
        d = doc.styles.element.find(qn("w:docDefaults"))
        sz = d.find(".//" + qn("w:sz")) if d is not None else None
        return int(sz.get(qn("w:val"))) / 2 if sz is not None else 11
    return round(v.pt if hasattr(v, "pt") else v / 12700, 1)

def colour(run):
    c = run.font.color
    try: return str(c.rgb) if c is not None and c.type is not None and c.rgb is not None and str(c.rgb) not in ("000000", "auto") else None
    except Exception: return None

def is_bidi(p):
    pPr = p._p.pPr
    return pPr is not None and pPr.find(qn("w:bidi")) is not None

def visual_align(p):
    a = p.alignment
    if a is None:
        st = p.style
        while a is None and st is not None: a = st.paragraph_format.alignment; st = st.base_style
    name = {None: "start", 0: "left", 1: "center", 2: "right", 3: "justify"}.get(int(a) if a is not None else None, str(a))
    if is_bidi(p):   # in a right-to-left paragraph "left" is the start (the right side) and "right" the left side
        return {"start": "right", "left": "right", "right": "left"}.get(name, name)
    return {"start": "left"}.get(name, name)

def indent(p):
    v = p.paragraph_format.left_indent or (p.paragraph_format.right_indent if is_bidi(p) else None)
    return (v.pt if v is not None else 0) > 12

def is_list(p):
    pPr = p._p.pPr
    return (pPr is not None and pPr.find(qn("w:numPr")) is not None) or "List" in (p.style.name or "") or bool(re.match(r"^\s*(\d+[.)]|[•●▪-])\s", p.text))

def is_heading(p, doc, body):
    if re.match(r"^(Heading|Title)", p.style.name or ""): return True
    sz = max([size_of(r, p, doc) for r in p.runs] or [body])
    return sz >= body * 1.18 and len(p.text) < 110

def read(path):
    doc = Document(path)
    paras = [p for p in doc.paragraphs if norm(p.text)]
    sizes = {}
    for p in paras:
        for r in p.runs:
            s = size_of(r, p, doc); sizes[s] = sizes.get(s, 0) + len(r.text)
    body = max(sizes, key=sizes.get) if sizes else 11
    out = {"paras": [], "tables": [], "images": len(doc.inline_shapes) + len(doc.element.body.findall(".//" + qn("wp:anchor"))), "body": body}
    for p in paras:
        runs = [(r.text, eff(r, p, "bold"), eff(r, p, "italic"), colour(r), size_of(r, p, doc), r.font.name) for r in p.runs if r.text]
        out["paras"].append({"text": norm(p.text), "head": is_heading(p, doc, body), "align": visual_align(p), "indent": indent(p), "list": is_list(p), "bidi": is_bidi(p), "runs": runs,
                             "size": max([x[4] for x in runs] or [body])})
    for t in doc.tables:
        rtl = t._tbl.tblPr is not None and t._tbl.tblPr.find(qn("w:bidiVisual")) is not None
        rows = [[norm(c.text) for c in r.cells] for r in t.rows]
        out["tables"].append([list(reversed(r)) for r in rows] if rtl else rows)   # as seen: left to right
    return out

WHY = "--why" in sys.argv
def words(runs, pick):
    return [w for t, b, i, c, s, f in runs if pick(b, i, c) for w in re.findall(r"[\w%]+", t)]

def score(a, b):
    res = {}
    ta = " ".join(p["text"] for p in a["paras"]); tb = " ".join(p["text"] for p in b["paras"])
    res["text"] = difflib.SequenceMatcher(None, ta, tb, autojunk=False).ratio()
    # match each original paragraph to the converted one with the most similar text
    pairs = []
    for p in a["paras"]:
        best, bs = None, 0
        for q in b["paras"]:
            r = difflib.SequenceMatcher(None, p["text"], q["text"]).ratio() if abs(len(p["text"]) - len(q["text"])) < max(len(p["text"]), 20) else 0
            if r > bs: best, bs = q, r
        pairs.append((p, best if bs > 0.6 else None))
    def frac(xs): xs = list(xs); return sum(xs) / len(xs) if xs else 1.0
    res["headings"] = frac(q is not None and q["head"] for p, q in pairs if p["head"])
    res["alignment"] = frac(q is not None and q["align"] == p["align"] for p, q in pairs)
    if WHY:
        for p, q in pairs:
            if q is None: print("  MISSING", p["text"][:60])
            elif q["align"] != p["align"]: print("  ALIGN", p["align"], "→", q["align"], p["text"][:50])
            elif abs(q["size"] - p["size"]) > 1: print("  SIZE", p["size"], "→", q["size"], p["text"][:50])
    res["indents"] = frac(q is not None and q["indent"] for p, q in pairs if p["indent"])
    res["lists"] = frac(q is not None and q["list"] for p, q in pairs if p["list"])
    res["rtl"] = frac(q is not None and q["bidi"] for p, q in pairs if p["bidi"] or re.search(r"[؀-ۿ]", p["text"]))
    res["font size"] = frac(q is not None and abs(q["size"] - p["size"]) <= 1 for p, q in pairs)
    for name, pick in [("bold", lambda b, i, c: b), ("italic", lambda b, i, c: i), ("colour", lambda b, i, c: c is not None)]:
        want = [w for p, q in pairs for w in words(p["runs"], pick) if not p["head"]]
        got = set(w for p, q in pairs if q is not None for w in words(q["runs"], pick))
        extra = [w for p, q in pairs if q is not None and not p["head"] for w in words(q["runs"], pick) if w not in set(words(p["runs"], pick))]
        res[name] = frac(w in got for w in want) if want else (1.0 if not extra else 0.5)
    cells_a = [c for t in a["tables"] for r in t for c in r]; cells_b = [c for t in b["tables"] for r in t for c in r]
    res["tables"] = frac(x == y for x, y in zip(cells_a, cells_b)) * (min(len(cells_a), len(cells_b)) / max(len(cells_a), 1)) if cells_a else 1.0
    res["pictures"] = min(b["images"], a["images"]) / a["images"] if a["images"] else 1.0
    return res

def render(path, out_png, tmp):
    subprocess.run(["soffice", "--headless", "--norestore", "--convert-to", "pdf", "--outdir", tmp, path], capture_output=True, timeout=180)
    pdf = os.path.join(tmp, os.path.splitext(os.path.basename(path))[0] + ".pdf")
    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument(pdf)
    return [doc[i].render(scale=1.2).to_pil() for i in range(min(len(doc), 2))]

if __name__ == "__main__":
    a, b = sys.argv[1], sys.argv[2]
    r = score(read(a), read(b))
    print(json.dumps({k: round(v * 100) for k, v in r.items()}, ensure_ascii=False))
    if "--png" in sys.argv:
        from PIL import Image
        png = sys.argv[sys.argv.index("--png") + 1]
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(tmp + "/a"); os.makedirs(tmp + "/b")
            pa = render(a, None, tmp + "/a"); pb = render(b, None, tmp + "/b")
        w = max(x.width for x in pa + pb); h = max(x.height for x in pa + pb)
        n = max(len(pa), len(pb))
        img = Image.new("RGB", (w * 2 + 20, h * n + 10 * n), "white")
        for i in range(n):
            if i < len(pa): img.paste(pa[i], (0, i * (h + 10)))
            if i < len(pb): img.paste(pb[i], (w + 20, i * (h + 10)))
        img.save(png)
