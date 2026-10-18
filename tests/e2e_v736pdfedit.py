"""v6.32 — Converter → Edit a PDF (Ali: "add Edit a PDF directly … in the converters page for minimalism in a good way").
The first Converter row opens a PDF in the editor: tap a line to change it, tap an empty spot to add text, highlight by
dragging over words, draw, sign (kept on the device), and Pages (turn, delete, add a blank page); Undo; Save gives a new
PDF ("…-edited.pdf") made by the phone (pdfEdit op "edit"). Screenshots go to SHOTS (default tests/shots-v736).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736pdfedit.py
"""
import os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-v736")
os.makedirs(SHOTS, exist_ok=True)
def shot(page, name): page.screenshot(path=os.path.join(SHOTS, name + ".png"))

PAGES = [["Delta Lift - Invoice", "No. 2026-118 12 Oct 2026", "Bill to: Nile Towers Co., Cairo", "Lift maintenance, October", "Monthly service 4,500", "Door sensor 1,250", "Total (EGP) 5,750"],
         ["Terms", "Pay within 15 days.", "Thank you for your business."], ["Notes", "Page three."]]
NATIVE = r"""((PAGES) => { const A = window.AttuneNative, S = window.__mock; S.edits = [];
  const R = (id, v) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), 20);
  const boxes = (n) => { const out = []; PAGES[(n - 1) % PAGES.length].forEach((l, li) => { let x = 0.08; const y = 0.08 + li * 0.05; const h = li ? 0.022 : 0.03;
    for (const t of l.split(" ")) { const w = t.length * (li ? 0.0125 : 0.017); out.push([+x.toFixed(4), y, +w.toFixed(4), h, t]); x += w + 0.008; } }); return out; };
  const svg = (n, W) => { const H = Math.round(W * 1.414); let s = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'><rect width='100%' height='100%' fill='#fffdf6'/>`;
    for (const b of boxes(n)) s += `<text x='${b[0] * W}' y='${(b[1] + b[3] * 0.8) * H}' font-family='serif' font-size='${b[3] * H * 0.9}' textLength='${b[2] * W}' lengthAdjust='spacingAndGlyphs'>${b[4].replace(/&/g, "&amp;")}</text>`;
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(s + "</svg>"))); };
  A.pdfText = (id) => R(id, { count: 3, pages: [{ n: 1, text: "x", scan: false }] });
  A.pdfWords = (id, arg) => { const a = JSON.parse(arg); R(id, { pages: a.pages.map((n) => ({ n, ar: 0.7072, words: boxes(n) })) }); };
  A.pdfImages = (id, arg) => { const a = JSON.parse(arg); R(id, { images: a.pages.map((n) => ({ n, image: svg(n, Math.min(a.width || 800, 800)) })) }); };
  A.pdfEdit = (id, arg) => { const a = JSON.parse(arg); S.edits.push(a); R(id, { files: [{ n: 1, b64: "JVBERi0xLjQK", pages: (a.order || []).length || 3 }] }); };
})"""
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"

def at(page, fx, fy, what="click"):
    b = page.locator("[data-testid=pdfedit-page]").bounding_box()
    x, y = b["x"] + fx * b["width"], b["y"] + fy * b["height"]
    if what == "click": page.mouse.click(x, y)
    return x, y
def drag(page, a, b, steps=8):
    x0, y0 = at(page, *a, what=None); x1, y1 = at(page, *b, what=None)
    page.mouse.move(x0, y0); page.mouse.down(); page.mouse.move(x1, y1, steps=steps); page.mouse.up()

with sync_playwright() as p:
    br = p.chromium.launch()
    for desk in (None, (1280, 860)):
        errors.clear()
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=desk, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
        page.goto(env.url); page.wait_for_selector("[data-testid=phone-home], [data-testid=desk-home], body", timeout=15000)
        page.evaluate(NATIVE + "(%s)" % __import__("json").dumps(PAGES))
        tag = "desk" if desk else "phone"
        # v6.36: the Converter is a Students tab (Ali's board)
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'convert'}}))"); page.wait_for_timeout(500)
        rows = page.locator("[data-testid=convert-tools] [data-testid^=convert-tool-]")
        check(rows.count() == 4 and rows.first.get_attribute("data-testid") == "convert-tool-edit", tag + ": Converter's first row is 'Edit a PDF' (still 4 rows)")
        if not desk: shot(page, "1-converter")
        with page.expect_file_chooser() as fc: page.click("[data-testid=convert-tool-edit]")
        fc.value.set_files(files=[{"name": "invoice-oct.pdf", "mimeType": "application/pdf", "buffer": PDF}])
        page.wait_for_selector("[data-testid=pdfedit-pic]", timeout=8000); page.wait_for_timeout(300)
        check(page.inner_text("[data-testid=pdfedit-at]").strip().endswith("3"), tag + ": the editor opens on page 1 of 3")
        check(page.locator("[data-testid=pdfedit-save]").is_disabled(), tag + ": Save waits for a change")
        # Text: tap the 'Bill to' line (3rd line: y = 0.08 + 2*0.05) → it opens with its words
        at(page, 0.2, 0.19); page.wait_for_selector("[data-testid=pdfedit-input]")
        check(page.input_value("[data-testid=pdfedit-input]") == "Bill to: Nile Towers Co., Cairo", tag + ": tapping a line opens it with its own words")
        page.fill("[data-testid=pdfedit-input]", "Bill to: Nile Towers Co., New Cairo")
        if not desk: shot(page, "2-change-line")
        page.click("[data-testid=pdfedit-done]"); page.wait_for_timeout(150)
        check("New Cairo" in page.inner_text("[data-testid=pdfedit-page]"), tag + ": the changed line shows on the page")
        # an empty spot → new text (Arabic, drawn as a picture when saved)
        at(page, 0.5, 0.75); page.wait_for_selector("[data-testid=pdfedit-input]")
        check(page.input_value("[data-testid=pdfedit-input]") == "", tag + ": an empty spot starts a new text")
        page.fill("[data-testid=pdfedit-input]", "تم الدفع"); page.click("[data-testid=pdfedit-done]")
        # Highlight the total line
        page.click("[data-testid=pdfedit-tool-highlight]"); drag(page, (0.09, 0.391), (0.3, 0.391))
        # Draw
        page.click("[data-testid=pdfedit-tool-draw]"); drag(page, (0.1, 0.6), (0.4, 0.65), steps=12)
        # Sign: make a signature, then place it
        page.click("[data-testid=pdfedit-tool-sign]"); at(page, 0.7, 0.85); page.wait_for_selector("[data-testid=pdfedit-signpad]")
        cb = page.locator("[data-testid=pdfedit-signcanvas]").bounding_box()
        page.mouse.move(cb["x"] + 30, cb["y"] + 100); page.mouse.down(); page.mouse.move(cb["x"] + 140, cb["y"] + 40, steps=10); page.mouse.move(cb["x"] + 220, cb["y"] + 110, steps=10); page.mouse.up()
        page.click("[data-testid=pdfedit-sign-use]"); page.wait_for_timeout(150)
        check(page.evaluate("!!localStorage.getItem('attune:pdfedit:sign')"), tag + ": the signature is kept on the device")
        at(page, 0.7, 0.85); page.wait_for_timeout(150)
        check(page.locator("[data-testid=pdfedit-sig]").count() == 1, tag + ": the signature is placed where tapped")
        if not desk: shot(page, "3-highlight-draw-sign")
        # Undo removes the last thing (the signature)
        page.click("[data-testid=pdfedit-undo]"); page.wait_for_timeout(100)
        check(page.locator("[data-testid=pdfedit-sig]").count() == 0, tag + ": Undo takes the signature off")
        at(page, 0.7, 0.85); page.wait_for_timeout(100)
        # Pages: turn page 2, delete page 3, add a blank page
        page.click("[data-testid=pdfedit-tool-pages]"); page.wait_for_selector("[data-testid=pdfedit-thumb]")
        check(page.locator("[data-testid=pdfedit-thumb]").count() == 3, tag + ": Pages shows every page")
        page.locator("[data-testid=pdfedit-turn]").nth(1).click(); page.locator("[data-testid=pdfedit-del]").nth(2).click(); page.click("[data-testid=pdfedit-blank]")
        page.wait_for_timeout(400)
        if not desk: shot(page, "4-pages")
        check(page.locator("[data-testid=pdfedit-thumb]").count() == 3, tag + ": one page deleted, one blank page added")
        page.click("[data-testid=pdfedit-save]"); page.wait_for_selector("[data-testid=convert-result]", timeout=8000)
        e = page.evaluate("window.__mock.edits.filter((x) => x.op === 'edit').pop()")
        kinds = [i["kind"] for i in e["items"]]
        check(kinds == ["cover", "text", "image", "highlight", "ink", "image"], tag + ": the phone gets cover+text, Arabic as a picture, highlight, drawing, signature (%s)" % kinds)
        check(e["items"][1]["text"] == "Bill to: Nile Towers Co., New Cairo" and abs(e["items"][1]["base"] - 0.19 - 0.022 * 0.82 * 0 ) < 0.03, tag + ": the new line keeps its place")
        check(e["items"][0]["color"].lower() != "#ffffff", tag + ": the cover takes the paper's own colour (%s)" % e["items"][0]["color"])
        check(e["order"] == [{"n": 1, "rot": 0}, {"n": 2, "rot": 90}, {"n": 0, "rot": 0}], tag + ": the new page order with the turn")
        check(page.inner_text("[data-testid=convert-out-name]").strip() == "invoice-oct-edited.pdf", tag + ": a new file, the original is untouched")
        if not desk: shot(page, "5-saved")
        check(real_errors(errors) == [], tag + ": no page errors: " + str(real_errors(errors)[:3]))
        ctx.close()
    br.close()
finish()
