"""v6.40 (upgrade W4) — Shop → Stock → Catalogue: the items with prices and stock as a WhatsApp message (with the wa.me order
link) and a PDF; after stock changes it says "share the new one".
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740catalogue.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = "try{localStorage.setItem('attune:start','home')}catch(e){}(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__shared = []; window.__pdf = []; N.share = function (t) { window.__shared.push(t); }; N.htmlToPdf = function (id, arg) { window.__pdf.push(JSON.parse(arg).html); setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ b64: 'JVBERi0x' })); }, 20); }; N.shareFile = function (id) { setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ ok: true })); }, 20); }; })();"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=shop-open]", timeout=8000); page.click("[data-testid=shop-open]")
    page.fill("[data-testid=shop-sentence]", "A cafe called Bean — we sell muffins, 2 staff"); page.click("[data-testid=shop-read]")
    page.fill("[data-testid=shop-tax]", "14"); page.check("[data-testid=shop-tax-ok]")
    prices = page.locator("[data-testid=shop-price]"); names = page.locator("[data-testid=shop-confirm] input[dir=auto]").all()
    for i in range(prices.count()):
        n = names[i + 1].input_value() if i + 1 < len(names) else ""
        if n in ("Muffins", "Cappuccino"): prices.nth(i).fill("50")
    page.click("[data-testid=shop-create]"); page.wait_for_selector("[data-testid=shop-sell]", timeout=5000)
    page.click("[data-testid=shop-tab-stock]"); page.wait_for_selector("[data-testid=shop-catalogue]", timeout=4000)
    page.fill("[data-testid=shop-catalogue-phone]", "01012345678")
    page.click("[data-testid=shop-catalogue-msg]"); page.wait_for_timeout(200)
    t = page.evaluate("window.__shared[0] || ''")
    check("Bean — today's prices" in t and "Cappuccino — 50" in t and "wa.me/201012345678" in t, "the message: %s" % t.replace("\n", " ")[:140])
    page.click("[data-testid=shop-catalogue-pdf]"); page.wait_for_function("window.__pdf.length === 1", timeout=5000)
    check("Order on WhatsApp" in page.evaluate("window.__pdf[0]"), "the PDF has Order on WhatsApp buttons")
    check(page.locator("[data-testid=shop-catalogue-changed]").count() == 0, "no 'share the new one' right after sharing")
    page.locator("[data-testid=shop-stock-item]:has-text('Muffins') button").first.click()
    page.fill("[data-testid=shop-receive]", "6"); page.click("[data-testid=shop-edit-save]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=shop-catalogue-changed]").count() == 1, "stock came in: it says share the new one")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
