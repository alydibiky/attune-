"""v5.39 — Translate a document: PDF → translated PDF (or Word), subtitles → translated subtitles.
The AI translates numbered pieces; code puts them back in place (headings, tables, numbers).

  python3 tests/e2e_v539.py
"""
import base64, io, json, zipfile
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []

NATIVE_PDF = """(() => { const N = window.AttuneNative, S = window.__mock;
  const R = (id, v) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), 30);
  N.pdfText = (id, arg) => R(id, { count: 1, pages: [{ n: 1, text: "# Lift plan\\n\\nThe 100 t crane lifts the 12 t beam.\\n\\nCrane | Radius\\nLTM 1100 | 14 m", scan: false }] });
  N.makePdf = (id, arg) => { (S.pdfCalls = S.pdfCalls || []).push(JSON.parse(arg)); R(id, { b64: btoa("%PDF-1.7 fake"), bytes: 13 }); };
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
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('File Converter')").first.click()
    page.wait_for_selector("[data-testid=convert]", timeout=5000)

    # ---- 1. PDF → translated Arabic PDF ----
    pick(page, "lift-plan.pdf", b"%PDF-1.4 test", "application/pdf")
    page.locator("[data-testid=convert-to-translate]").click()
    check(page.locator("[data-testid=convert-translate]").count() == 1, "Translate shows the language and PDF / Word choice")
    page.select_option("[data-testid=convert-tlang]", "ar")
    page.evaluate("""() => { const M = window.__mock; M.bodies = [];
      M.fakeQueue = ['[[1]] خطة الرفع\\n[[2]] الونش 100 طن بيرفع الكمرة 12 طن.\\n[[3]] الونش\\n[[4]] نصف القطر\\n[[5]] LTM 1100']; }""")
    page.locator("[data-testid=convert-go]").click()
    page.wait_for_selector("[data-testid=convert-result]", timeout=20000)
    name = page.locator("[data-testid=convert-out-name]").inner_text()
    check(name == "lift-plan-ar.pdf", "the result is lift-plan-ar.pdf (%s)" % name)
    sent = page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 2).map(b => JSON.stringify(b.messages))")
    check(len(sent) == 1 and "into Arabic" in sent[0] and "[[2]] The 100 t crane lifts the 12 t beam." in sent[0] and "14 m" not in sent[0], "one batch goes to the AI, numbered; the number-only cell (14 m) isn't sent")
    blocks = page.evaluate("window.__mock.pdfCalls.pop().blocks")
    check([b["type"] for b in blocks] == ["h1", "p", "table"] and blocks[0]["text"] == "خطة الرفع", "the PDF keeps its heading, paragraph and table — now in Arabic")
    check(blocks[2]["rows"] == [["الونش", "نصف القطر"], ["LTM 1100", "14 m"]], "table cells translated in place; the model name and the number stay")
    check("check important names" in page.locator("[data-testid=convert-result]").inner_text(), "a note to check names and numbers")

    # ---- 2. …or as a Word file, a piece the AI skipped is retried alone ----
    page.locator("text=Convert another file").click(); page.wait_for_timeout(150)
    pick(page, "lift-plan.pdf", b"%PDF-1.4 test", "application/pdf")
    page.locator("[data-testid=convert-to-translate]").click(); page.locator("[data-testid=convert-tfmt-docx]").click()
    page.evaluate("""() => { const M = window.__mock; M.bodies = [];
      M.fakeQueue = ['[[1]] Plan de levage\\n[[3]] Grue\\n[[4]] Rayon\\n[[5]] LTM 1100', '[[1]] La grue de 100 t soulève la poutre de 12 t.']; }""")
    page.select_option("[data-testid=convert-tlang]", "fr")
    page.locator("[data-testid=convert-go]").click()
    page.wait_for_selector("[data-testid=convert-result]", timeout=20000)
    page.locator("[data-testid=convert-save]").click(); page.wait_for_timeout(300)
    saved = page.evaluate("window.__mock.lastSaved")
    doc = zipfile.ZipFile(io.BytesIO(base64.b64decode(saved["b64"]))).read("word/document.xml").decode()
    check(saved["name"] == "lift-plan-fr.docx" and "La grue de 100 t" in doc and "Plan de levage" in doc and "<w:tbl>" in doc, "French Word file; the skipped sentence was asked again on its own")

    # ---- 3. subtitles → translated subtitles ----
    page.locator("text=Convert another file").click(); page.wait_for_timeout(150)
    pick(page, "film.srt", "1\n00:00:01,000 --> 00:00:02,500\nHello there\n\n2\n00:00:03,000 --> 00:00:04,000\nLift it slowly\n".encode(), "application/x-subrip")
    page.locator("[data-testid=convert-to-translate]").click()
    check(page.locator("[data-testid=convert-tfmt-pdf]").count() == 0, "subtitles stay subtitles (no PDF / Word choice)")
    page.select_option("[data-testid=convert-tlang]", "ar")
    page.evaluate("() => { window.__mock.fakeQueue = ['[[1]] أهلاً\\n[[2]] ارفعه بالراحة']; }")
    page.locator("[data-testid=convert-go]").click()
    page.wait_for_selector("[data-testid=convert-result]", timeout=20000)
    page.locator("[data-testid=convert-save]").click(); page.wait_for_timeout(300)
    s = page.evaluate("window.__mock.lastSaved")
    check(s["name"] == "film-ar.srt" and "00:00:03,000 --> 00:00:04,000\nارفعه بالراحة" in s["text"], "film-ar.srt: same timings, Arabic lines")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
