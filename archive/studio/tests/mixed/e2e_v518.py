"""v5.18 — Business apps people use outside Attune (and bring back), fields
added to a design before it's created, junk loops stopped, websites on topic,
Studio never silent.

  python3 tests/e2e_v518.py
"""
import os, json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE, to_tables

env = Env(); errors = []

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def queue(page, items):
    page.evaluate("(q) => { const M = window.__mock; M.fakeQueue = q; M.bodies = []; }", items)

def open_more(page, name, testid):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector(f"[data-testid={testid}]", timeout=5000)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install(page)

    # (v9.1: this section used Business — archived with it in archive/business/tests/mixed/e2e_v518.py)
    # (v9.1: this section used Business — archived with it in archive/business/tests/mixed/e2e_v518.py)
    # (v9.1: this section used Business — archived with it in archive/business/tests/mixed/e2e_v518.py)
    # ---- 4. Studio never fails silently (unit-level check of the message) ----
    src = open(os.path.join(HERE, "..", "web-src", "studio-ui.jsx"), encoding="utf-8").read()
    check("never silent" in src and "Engine → Engine log" in src, "a picture that fails always says why")

    errs = real_errors(errors)
    check(not errs, "no JavaScript errors in the page (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
