"""v5.29 — earning money: a 7-day Pro trial, regional prices, a request code per phone, and
nothing unlocks Pro without a real signed code; the tips library reaches the model.

  python3 tests/e2e_v529.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

    # ---- 1. the tips library reaches the model ----
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['NONE', '**Total: 1,026,000 EGP**', 'done']; M.bodies = []; }")
    send(page, "Rent 3 cranes for 4 days at 75,000 EGP a day plus 14% VAT — what is the total?")
    page.wait_for_function("() => document.querySelectorAll(\"button[title='Regenerate']\").length >= 1", timeout=30000)
    bodies = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).map(x => String(x.messages[x.messages.length - 1].content))")
    check(any("Expert tips for this answer" in b and "VAT is 14%" in b for b in bodies), "the question goes with the expert tips that fit it (the 14% VAT tip)")

    # ---- 2. the Plan screen ----
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    check(page.locator("text=Pro trial").count() >= 1 and page.locator("text=7 days left").count() >= 1, "a new install has a 7-day Pro trial, shown in More")
    page.locator("text=Pro trial").first.click()
    page.wait_for_selector("[data-testid=upgrade]", timeout=5000)
    up = page.locator("[data-testid=upgrade]")
    check(up.locator("[data-testid=trial-banner]").count() == 1 and "7 days left" in up.inner_text(), "the Plan screen says the trial has 7 days left and everything is unlocked")
    check(up.locator("[data-testid=plans] button").count() == 3 and "Best value" in up.locator("[data-testid=plan-year]").inner_text(), "three plans, the yearly one marked best value")
    txt = up.inner_text()
    check("$39.99" in txt or "EGP 1,499" in txt, "prices are shown in the phone's region")
    check(up.locator("[data-testid=testing-pro]").count() == 1, "the testing build says every Pro feature is unlocked")
    check(up.get_by_role("button", name="Choose").count() == 0, "there is no button that turns Pro on without paying any more")
    rc = up.locator("[data-testid=request-code]").inner_text()
    check(len(rc) == 12 and rc.startswith("PRO-"), "the phone's request code is shown: " + rc)
    up.locator("[data-testid=pro-code]").fill("PRO1.eyJzIjoiUFJPLUFCQ0QyMzQ1IiwicCI6InBybyIsImUiOjAsImkiOjF9.AAAA")
    up.locator("[data-testid=pro-activate]").click(); page.wait_for_timeout(500)
    check(page.locator("[data-testid=pro-active]").count() == 0 and page.evaluate("localStorage.getItem('attune:tier')") != "pro", "a fake or foreign code does not unlock Pro")

    errs = real_errors(errors)
    check(not errs, "no JavaScript errors (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
