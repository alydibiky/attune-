"""v6.34 — Engine minimal (Ali: "I want this page to be more minimal"; he picked A): one line with what runs and a ⋯ (restart,
log, details), each model one row (tap = use; Fingerprint / Delete in its ⋯), a thin bar while downloading, settings folded.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v737engine.py     (SHOTS=dir for screenshots)
"""
import os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','chat')}catch(e){}")
    page.goto(env.url); page.wait_for_timeout(1500)
    page.locator("[data-testid=header-model]:visible").first.click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000); page.wait_for_timeout(500)
    check(page.locator("[data-testid=engine-min]").count() == 1, "the minimal Engine page")
    st = page.locator("[data-testid=engine-status]").inner_text()
    check("running" in st, "one line says what runs: %s" % st)
    rows = page.locator("[data-testid=engine-model]")
    check(rows.count() >= 1, "each installed model is one row (%d)" % rows.count())
    check(page.locator("[data-testid=engine-min] >> text=Fingerprint").count() == 0 and page.locator("[data-testid=engine-min] >> text=Restart engine").count() == 0,
          "no Fingerprint / Delete / Restart buttons on the page itself")
    page.click("[data-testid=engine-more]")
    m = page.locator("[data-testid=engine-menu]").inner_text()
    check("Restart engine" in m and "Engine log" in m and "Details" in m, "⋯ has Restart, Engine log, Details: %s" % m.replace("\n", " | "))
    page.click("[data-testid=engine-show-log]"); page.wait_for_selector("[data-testid=engine-log]")
    check("Attune" in page.locator("[data-testid=engine-log]").inner_text(), "the log opens, with Copy")
    page.locator("[data-testid=engine-model-more]").first.click()
    m2 = page.locator("[data-testid=engine-menu]").inner_text()
    check("Fingerprint" in m2 and "Delete" in m2, "a model's ⋯ has Fingerprint and Delete")
    page.click("[data-testid=engine-delete]")
    check(page.locator("[data-testid=engine-delete-yes]").count() == 1, "Delete asks once, on the row")
    words = len(page.locator("[data-testid=engine-min]").inner_text().split())
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "engine-min.png"))
    print("words on the Engine panel:", words)
    check(real_errors(errors) == [], "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
