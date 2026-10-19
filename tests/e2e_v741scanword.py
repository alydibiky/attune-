"""v6.41 S2 a photo of a printed page → a real Word file with its layout: the phone reads the lines and where they are (no AI);
the heading, the paragraph and the table come out as Word's own heading, paragraph and table.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741scanword.py
"""
import base64, zipfile, io, json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
L = lambda t, x, y, w, h: {"text": t, "x": x, "y": y, "w": w, "h": h}
LINES = [L("Quotation", 100, 80, 420, 64), L("Thank you for your enquiry. Please find our prices for the crane hire below,", 100, 200, 980, 34),
         L("valid for thirty days from today.", 100, 244, 460, 34), L("Item", 100, 340, 90, 34), L("Days", 600, 342, 90, 34), L("Price", 900, 340, 110, 34),
         L("Tadano 50 t", 100, 392, 220, 34), L("3", 600, 394, 20, 34), L("54,000", 900, 392, 130, 34),
         L("Liebherr 100 t", 100, 444, 260, 34), L("2", 600, 446, 20, 34), L("70,000", 900, 444, 130, 34)]
OCR = {"text": "\n".join(l["text"] for l in LINES), "lines": LINES, "width": 1190, "height": 1684}
INIT = ("(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__ocr = 0;"
        "N.readText = function (id) { window.__ocr++; setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify(" + json.dumps(OCR) + ")); }, 30); }; })();")
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'convert'}}))")
    page.wait_for_selector("[data-testid=convert]", timeout=5000)
    page.set_input_files("[data-testid=convert-file]", files=[{"name": "quote.jpg", "mimeType": "image/jpeg", "buffer": PNG}])
    page.wait_for_selector("[data-testid=convert-to-docx]", timeout=5000); page.click("[data-testid=convert-to-docx]")
    page.click("[data-testid=convert-go]")
    page.wait_for_selector("[data-testid=convert-result]", timeout=15000)
    check(page.evaluate("window.__ocr") == 1, "read on the phone — no AI model needed (none is installed)")
    page.locator("[data-testid=convert-save]").click(); page.wait_for_timeout(300)
    saved = page.evaluate("window.__mock.lastSaved")
    doc = zipfile.ZipFile(io.BytesIO(base64.b64decode(saved["b64"]))).read("word/document.xml").decode()
    check("<w:tbl>" in doc and "Tadano 50 t" in doc and "54,000" in doc, "the table is a real Word table")
    check("Heading" in doc or "w:pStyle" in doc, "the title is a heading")
    check("valid for thirty days" in doc, "the paragraph is kept")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
