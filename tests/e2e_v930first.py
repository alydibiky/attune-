"""v9.3 (Ali picked D6 A: the first minute — 3 short screens that end with one real thing done; D5 A: Simple mode).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v930first.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
FRESH = "try{if(!sessionStorage.getItem('t-fresh')){sessionStorage.setItem('t-fresh','1');localStorage.removeItem('attune:onboarded');localStorage.setItem('attune:start','home')}}catch(e){}"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=FRESH)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=first-minute]", timeout=15000)
    check(page.locator("[data-testid=first-country]").count() == 1, "screen 1: language and country")
    page.click("[data-testid=first-next]")
    check(page.locator("[data-testid^=first-pick-]").count() == 4 and page.locator("[data-testid=first-pick-list][aria-pressed=true]").count() == 1, "screen 2: “What should Attune do first?” — 4 choices")
    page.click("[data-testid=first-next]")
    check("travel checklist" in page.input_value("[data-testid=first-text]"), "screen 3: the example, ready to change or keep")
    check(page.locator("[data-testid=first-minute] [data-testid=first-next]").count() == 0 and page.evaluate("document.querySelectorAll('[data-testid=first-minute] i').length") == 3, "3 screens in all")
    page.click("[data-testid=first-do]"); page.wait_for_timeout(2500)
    lists = json.loads(page.evaluate("localStorage.getItem('attune:lists:v1') || '{\"lists\":[]}'"))
    names = [l["name"].lower() for l in lists.get("lists", [])]
    check(any("travel" in n for n in names) and page.locator("[data-testid=first-minute]").count() == 0, "Do it → the travel checklist really exists, and Home is open: %s" % names)
    check(page.evaluate("localStorage.getItem('attune:onboarded')") == "1", "…and the first minute doesn't come back")
    # simple mode
    page.evaluate("(() => { localStorage.setItem('attune:dayset:v1', JSON.stringify({ simple: true })); window.dispatchEvent(new CustomEvent('attune-dayset')); })()")
    page.wait_for_selector("[data-testid=simple-home]", timeout=5000)
    tiles = page.evaluate("[...document.querySelectorAll('[data-testid=simple-home] button[data-testid^=simple-]')].map(b => b.dataset.testid)")
    check(tiles[:1] == ["simple-menu"] and "simple-talk" in tiles and "simple-lists" in tiles and "simple-prayer" not in tiles, "Simple mode: five big buttons, Talk to Attune first; no prayer button while prayer times are off: %s" % tiles)
    page.click("[data-testid=simple-money]"); page.wait_for_timeout(800)
    check(page.locator("[data-testid=money-bar]").count() == 1, "…a big button opens its page (Money)")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_selector("[data-testid=simple-home]")
    page.click("[data-testid=simple-leave]"); page.wait_for_timeout(600)
    check(page.locator("[data-testid=simple-home]").count() == 0 and page.locator("[data-testid=your-day]").count() == 1, "“Show the full Home” leaves Simple mode in one tap")
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
