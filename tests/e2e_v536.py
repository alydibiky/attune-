"""v5.36 — File Converter: PDF → Word (a scanned page read by the AI), photos → PDF, CSV → Excel,
all on the phone; the result is saved with the phone's Save dialog.

  python3 tests/e2e_v536.py
"""
import base64, io, json, os, zipfile
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []

# The Android side (DocTools.kt) is stood in for: page 1 has text, page 2 is a scan.
NATIVE_PDF = """(() => { const N = window.AttuneNative, S = window.__mock;
  const R = (id, v) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), 30);
  N.pdfText = (id, arg) => { (S.pdfCalls = S.pdfCalls || []).push(['text', JSON.parse(arg)]);
    R(id, { count: 2, pages: [{ n: 1, text: "Lift plan\\n\\nThe 100 t crane lifts the 12 t beam at 14 m radius.", scan: false }, { n: 2, text: "", scan: true }] }); };
  N.pdfImages = (id, arg) => { const a = JSON.parse(arg); (S.pdfCalls = S.pdfCalls || []).push(['images', a]);
    R(id, { images: (a.pages && a.pages.length ? a.pages : [1, 2]).map((n) => ({ n, image: "data:image/jpeg;base64,/9j/4AAQSkZJRg==" })) }); };
  N.makePdf = (id, arg) => { const a = JSON.parse(arg); (S.pdfCalls = S.pdfCalls || []).push(['make', a]); R(id, { b64: btoa("%PDF-1.7 fake"), bytes: 13 }); };
})();"""

def pick(page, name, data, mime):
    page.set_input_files("[data-testid=convert-file]", files=[{"name": name, "mimeType": mime, "buffer": data}])

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    page.evaluate(NATIVE_PDF)
    page.evaluate("() => { window.__mock.vision = true; }")
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('File Converter')").first.click()
    page.wait_for_selector("[data-testid=convert]", timeout=5000)

    # ---- 1. PDF → Word: the text page copied, the scanned page read by the AI ----
    page.evaluate("() => { window.LocalEngineVisionForTest = true; }")
    pick(page, "lift-plan.pdf", b"%PDF-1.4 test", "application/pdf")
    check("PDF" in page.locator("[data-testid=convert-source]").inner_text(), "a PDF is recognised")
    check(page.locator("[data-testid=convert-to-docx]").count() == 1 and page.locator("[data-testid=convert-to-images]").count() == 1, "PDF → Word, text or pictures are offered")
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['# Load chart\\n\\n| Radius | Capacity |\\n| 14 m | 22.5 t |']; M.bodies = []; }")
    page.locator("[data-testid=convert-go]").click()
    page.wait_for_selector("[data-testid=convert-result]", timeout=20000)
    name = page.locator("[data-testid=convert-out-name]").inner_text()
    check(name == "lift-plan.docx", "the result is lift-plan.docx (%s)" % name)
    calls = page.evaluate("window.__mock.pdfCalls.map(c => c[0] + ':' + JSON.stringify(c[1].pages || []))")
    check(calls[:2] == ["text:[]", "images:[2]"], "the text is read on the phone, and only the scanned page 2 is turned into a picture (%s)" % calls)
    body = page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 2).map(b => JSON.stringify(b.messages).slice(0, 200))")
    check(len(body) == 1 and "Copy ALL the text" in body[0], "…and the AI reads that one scanned page")
    page.locator("[data-testid=convert-save]").click(); page.wait_for_timeout(300)
    saved = page.evaluate("window.__mock.lastSaved")
    check(saved["name"] == "lift-plan.docx" and saved["mime"].endswith("wordprocessingml.document"), "Save hands the Word file to the phone's Save dialog")
    z = zipfile.ZipFile(io.BytesIO(base64.b64decode(saved["b64"])))
    doc = z.read("word/document.xml").decode()
    check("The 100 t crane lifts the 12 t beam" in doc and "22.5 t" in doc and "<w:tbl>" in doc, "the Word file holds page 1's text and the scanned page's table, as a real table")

    # ---- 2. photos → one PDF ----
    page.locator("text=Convert another file").click(); page.wait_for_timeout(200)
    png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
    page.set_input_files("[data-testid=convert-file]", files=[{"name": "a.png", "mimeType": "image/png", "buffer": png}, {"name": "b.png", "mimeType": "image/png", "buffer": png}])
    check("2 photos" in page.locator("[data-testid=convert-source]").inner_text(), "several photos are taken together")
    page.locator("[data-testid=convert-go]").click()
    page.wait_for_selector("[data-testid=convert-result]", timeout=20000)
    mk = page.evaluate("window.__mock.pdfCalls.filter(c => c[0] === 'make').pop()[1]")
    check(len(mk.get("images", [])) == 2 and page.locator("[data-testid=convert-out-name]").inner_text().endswith(".pdf"), "photos → one PDF, one photo a page")

    # ---- 3. CSV → Excel (all in the page) ----
    page.locator("text=Convert another file").click(); page.wait_for_timeout(200)
    pick(page, "parts.csv", "Part,Qty\nشاكل,10\nSling,4\n".encode(), "text/csv")
    page.locator("[data-testid=convert-go]").click()
    page.wait_for_selector("[data-testid=convert-result]", timeout=20000)
    page.locator("[data-testid=convert-save]").click(); page.wait_for_timeout(300)
    saved = page.evaluate("window.__mock.lastSaved")
    xl = zipfile.ZipFile(io.BytesIO(base64.b64decode(saved["b64"]))).read("xl/worksheets/sheet1.xml").decode()
    check(saved["name"] == "parts.xlsx" and "شاكل" in xl and "<v>10</v>" in xl, "CSV → Excel: Arabic text kept, numbers stored as numbers")

    # ---- 4. Back closes the result first ----
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=convert-result]").count() == 0 and page.locator("[data-testid=convert-go]").count() == 1, "Back from the result returns to the file")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
