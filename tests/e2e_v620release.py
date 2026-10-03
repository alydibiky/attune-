"""v6.11 — the release behaviour: a customer's phone has NO unlocked Pro and no testing box; tapping the version number 7 times
turns developer mode on (Pro unlocked for testing), and 7 more turns it off.

  python3 tests/e2e_v620release.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []

def open_plan(page):
    page.evaluate("window.__attuneOpenPlan && window.__attuneOpenPlan()")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, release=True)
    page.add_init_script("try{localStorage.removeItem('attune:testing-pro')}catch(e){}") if False else None
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    check(page.evaluate("localStorage.getItem('attune:dev')") in (None, "0"), "a fresh phone is not in developer mode")
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=app-version]").count() == 1, "the version number is at the bottom of More")
    for _ in range(7): page.locator("[data-testid=app-version]").click(); page.wait_for_timeout(60)
    page.wait_for_load_state("load"); page.wait_for_selector("nav", timeout=15000)
    check(page.evaluate("localStorage.getItem('attune:dev')") == "1", "7 taps on the version number turn developer mode on")
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    for _ in range(7): page.locator("[data-testid=app-version]").click(); page.wait_for_timeout(60)
    page.wait_for_load_state("load"); page.wait_for_selector("nav", timeout=15000)
    check(page.evaluate("localStorage.getItem('attune:dev')") == "0", "7 more taps turn it off again")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
