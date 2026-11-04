"""v6.45 Business client portal: Fleet → a client → Client page → PIN → Make the page → the saved HTML opened in a real
browser: locked (no name, no number) → wrong PIN refused → right PIN shows the balance, invoices, payments, job orders.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v745portal.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=fleet-open]", timeout=8000); page.click("[data-testid=fleet-open]")
    page.click("[data-testid=fleet-demo]"); page.wait_for_selector("[data-testid=fleet-today]")
    page.click("[data-testid=fleet-tab-fleet]"); page.click("[data-testid=fleet-seg-clients]"); page.locator("[data-testid=fleet-client]").first.click()
    page.wait_for_selector("[data-testid=fleet-client-detail]")
    name = page.locator("[data-testid=fleet-client-detail] p").first.inner_text()
    owed = page.inner_text("[data-testid=fleet-balance]").split(" ")[0]
    page.click("[data-testid=fleet-portal-open]"); page.wait_for_selector("[data-testid=fleet-portal]")
    page.fill("[data-testid=fleet-portal-pin]", "48"); page.wait_for_timeout(100)
    check(page.locator("[data-testid=fleet-portal-make]").is_disabled(), "a PIN under 4 digits can't be used")
    page.fill("[data-testid=fleet-portal-pin]", "4826"); page.click("[data-testid=fleet-portal-lang-en]"); page.click("[data-testid=fleet-portal-make]")
    page.wait_for_function("window.__mock.lastSaved && /^account-.*\\.html$/.test(window.__mock.lastSaved.name)", timeout=15000)
    html = page.evaluate("window.__mock.lastSaved.text")
    check(name not in html and owed not in html, "the saved page holds no name and no number in the open")
    ctx.close()
    # the client's browser: no Attune, just the file
    import tempfile, os
    f = os.path.join(tempfile.mkdtemp(), "account.html"); open(f, "w", encoding="utf-8").write(html)
    c2 = br.new_context(); pg = c2.new_page(); pg.goto("file://" + f)   # as the client opens a downloaded file
    check("This page is locked" in pg.inner_text("body"), "the client sees a PIN box")
    pg.fill("#pin", "1111"); pg.click("button"); pg.wait_for_function("document.getElementById('err') && document.getElementById('err').textContent.length > 0", timeout=20000)
    check("not right" in pg.inner_text("#err"), "a wrong PIN is refused")
    pg.fill("#pin", "4826"); pg.click("button"); pg.wait_for_selector("#owed", timeout=20000)
    body = pg.inner_text("body")
    check(name in body and owed in pg.inner_text("#owed"), "the right PIN: %s owes %s" % (name, owed))
    check("Invoices" in body and "Payments" in body and "Job orders" in body and "JO-" in body, "invoices, payments and job orders")
    pg.set_viewport_size({"width": 360, "height": 740})
    check(pg.evaluate("document.documentElement.scrollWidth <= 361"), "fits a small phone (no sideways scroll)")
    c2.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
