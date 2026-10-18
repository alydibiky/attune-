"""v6.40 (upgrade S3) — Ask a PDF calculates: "total of the amount column" is answered by code over every row of the PDF's
tables (rebuilt from where the words sit, pdfWords), across pages; "Tables → Excel" saves them.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740pdftables.py
"""
import json, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def W(x, y, t): return [x, y, len(t) * 0.012, 0.012, t]
def row(y, a, b, c): return [W(0.08, y, a), W(0.45, y, b), W(0.7, y, c)]
P1 = row(0.2, "Item", "Qty", "Amount") + row(0.23, "Crane", "2", "18,000") + row(0.26, "Trailer", "1", "4,500.50") + row(0.29, "Rigger", "3", "(500)")
P2 = row(0.1, "Item", "Qty", "Amount") + row(0.13, "Fuel", "10", "2,000")
NATIVE = """(() => { const N = window.AttuneNative, S = window.__mock; S.saved = [];
  const R = (id, v) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), 25);
  N.pdfText = (id) => R(id, { count: 2, pages: [{ n: 1, text: "Invoice list Item Qty Amount Crane 2 18,000", scan: false }, { n: 2, text: "Item Qty Amount Fuel 10 2,000", scan: false }] });
  N.pdfWords = (id, arg) => { const a = JSON.parse(arg); R(id, { pages: a.pages.map((n) => ({ n, ar: 0.707, words: n === 1 ? %P1% : %P2% })) }); };
  N.pdfImages = (id, arg) => R(id, { images: [] });
  N.saveFile = (id, arg) => { S.saved.push(JSON.parse(arg)); R(id, { ok: true }); };
})();""".replace("%P1%", json.dumps(P1)).replace("%P2%", json.dumps(P2))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate(NATIVE)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Ask a PDF')").first.click()
    page.wait_for_selector("[data-testid=pdfchat-home]", timeout=5000)
    page.set_input_files("[data-testid=pdfchat-file]", files=[{"name": "invoice.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 test"}])
    page.wait_for_selector("[data-testid=pdfchat]", timeout=8000)
    page.evaluate("() => { const M = window.__mock; M.bodies = []; M.fakeQueue = ['THE MODEL SHOULD NOT BE ASKED']; }")
    page.fill("[data-testid=pdf-input]", "What is the total of the amount column?"); page.click("[data-testid=pdf-send]")
    page.wait_for_selector("[data-testid=pdf-msg-ai]", timeout=10000)
    t = page.locator("[data-testid=pdf-msg-ai]").last.inner_text()
    check("24,000.5" in t and "calculated by code from 4 rows" in t and "MODEL" not in t, "the total, by code over both pages: %s" % t.replace("\n", " ")[:160])
    check(page.locator("[data-testid=pdf-msg-ai]").last.locator("[data-testid=pdf-cite]").count() == 1, "with its page as a chip")
    b = page.locator("[data-testid=pdf-export-tables]")
    if b.count() == 0:
        rt = page.locator("[data-testid=pdf-tab-read]")
        if rt.count(): rt.first.click(); page.wait_for_timeout(400)
    page.locator("[data-testid=pdf-export-tables]").first.click()
    page.wait_for_function("window.__mock.saved.length === 1", timeout=6000)
    sv = page.evaluate("window.__mock.saved[0]")
    z = base64.b64decode(sv["b64"])
    check(sv["name"].endswith("tables.xlsx") and z[:2] == b"PK" and b"Amount" in z, "Tables → Excel: one .xlsx with the table")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
