"""v6.31 — Ali: "make the app minimal so it's not cluttered … do the best you see that makes using the app smooth" (design A:
one main action per page, no intro paragraphs, thin text tabs, a small model dot, a "+" menu in Chat). Runs without the old bar.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v735minimal.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    check(page.locator("[data-testid=home-hint]").count() == 0, "Home: no 'Just say it' hint line")
    check("no account, no sign-in" not in page.inner_text("body"), "Home: no footer text")
    page.fill("[data-testid=home-ask]", "/all"); page.click("[data-testid=home-send]"); page.wait_for_selector("[data-testid=tools-page]")
    check(True, "“/all” in the Home box opens the Tools page (v6.50: no All button — everything from the box)")
    page.evaluate("window.__attuneBack()"); page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'convert'}}))"); page.wait_for_timeout(800)   # v6.36: the Converter is a Students tab
    check(page.locator("[data-intro]:visible").count() == 0, "no intro paragraph under the page title")
    rows = page.locator("[data-testid=convert-tools] [data-testid^=convert-tool-]").count()
    check(rows == 4, "Converter: one 'Choose a file' and the 4 most used (%d)" % rows)
    page.click("[data-testid=convert-all]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=convert-tools] [data-testid^=convert-tool-]").count() >= 10, "…'All conversions' shows the rest")
    check(page.locator("[data-testid=header-model]").count() == 1, "the model is a small dot in the header")
    page.locator("[data-testid=header-menu]:visible").first.click(); page.click("[data-testid=phone-side] [data-testid=side-new]"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=chat-empty-min]").count() == 1, "Chat: a calm empty screen")
    page.click("[data-testid=composer-plus]"); page.wait_for_selector("[data-testid=composer-menu]")
    check(page.locator("[data-testid=composer-menu] label").count() == 2, "'+' holds Photo and File")
    page.click("[data-testid=menu-think]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=chip-think]").count() == 1, "Think, once on, shows as a chip")
    page.click("[data-testid=chip-think]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=chip-think]").count() == 0, "…and the chip turns it off")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
