"""v6.28 — Ali: "I want Back to return me to the previous page, no matter what it is — not to Home". Pages opened from the All
menu, Home and the bottom bar are each remembered: Back walks them back one by one, then Home; on a computer the sidebar's ←.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v732back.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def all_menu(page, name):
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('%s')" % name).first.click(); page.wait_for_timeout(400)
def back(page):
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(350)
def on(page, tid): return page.locator("[data-testid=%s]" % tid).count() == 1
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    all_menu(page, "Scout"); check(on(page, "scout-page"), "Home → Scout")
    all_menu(page, "Travel"); check(on(page, "travel-page"), "Scout → Travel")
    all_menu(page, "Family health"); check(on(page, "care-page"), "Travel → Family health")
    back(page); check(on(page, "travel-page"), "Back → Travel (the page before), not Home")
    back(page); check(on(page, "scout-page"), "Back → Scout")
    back(page); check(on(page, "phone-home"), "Back → Home")
    # the bottom bar and Home's own buttons are remembered too
    page.locator("[data-testid=home-area-money]").click(); page.wait_for_timeout(400)
    page.locator("nav button:has-text('Chat')").click(); page.wait_for_timeout(300)
    back(page); check(page.locator("[data-testid=phone-home]").count() == 0 and page.locator("nav button:has-text('Money')").get_attribute("aria-current") in ("page", "true") or page.locator("[data-testid=money-calm], [data-testid=money-desk], iframe").count() >= 1, "Chat (bottom bar) → Back → Money")
    back(page); check(on(page, "phone-home"), "Back → Home")
    ctx.close()
    # computer: the sidebar's ←
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 1366, "height": 860})
    page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000)
    for q, tid in [("Scout", "scout"), ("Travel", "travel")]:
        page.locator("[data-testid=side] input").first.fill(q); page.wait_for_timeout(200); page.locator("[data-testid=side-go-%s]" % tid).first.click(); page.wait_for_timeout(400)
    check(on(page, "travel-page"), "computer: Home → Scout → Travel")
    page.click("[data-testid=side-back]"); page.wait_for_timeout(350)
    check(on(page, "scout-page"), "computer: ← → Scout")
    page.click("[data-testid=side-back]"); page.wait_for_timeout(350)
    check(on(page, "desk-home"), "computer: ← → Home")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
