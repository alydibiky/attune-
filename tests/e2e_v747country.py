"""v6.47 country packs (VISION phase 4): Settings → Your country → Egypt: EGP · VAT 14% · weekend Fri · Sat, police 122,
the next holidays; all of them on tap; Germany: EUR, 112. A new Fleet then starts in that currency and VAT.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v747country.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button:has-text('All')").first.click(); page.wait_for_timeout(400)
    row = page.locator("[data-testid=country-row]").first
    check(row.count() == 1, "Settings has Your country")
    row.locator("[data-testid=country-pick]").select_option("eg"); page.wait_for_timeout(200)
    card = row.locator("[data-testid=country-card]").inner_text()
    check("EGP" in card and "VAT 14%" in card and "Police 122" in card and "Fri" in card and "Sat" in card, "Egypt: EGP · VAT 14% · Fri · Sat · Police 122 — " + card.replace("\n", " | ")[:200])
    check(page.evaluate("localStorage.getItem('attune:country')") == "eg", "the choice is kept")
    n0 = row.locator("[data-testid=country-holidays] p").count()
    row.locator("[data-testid=country-more]").click(); page.wait_for_timeout(200)
    n1 = row.locator("[data-testid=country-holidays] p").count()
    check(n0 == 2 and n1 >= 10, "the next 2 holidays, then all of them (%d → %d)" % (n0, n1))
    row.locator("[data-testid=country-pick]").select_option("de"); page.wait_for_timeout(200)
    card = row.locator("[data-testid=country-card]").inner_text()
    check("EUR" in card and "VAT 19%" in card and "Emergency 112" in card, "Germany: EUR · VAT 19% · 112")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
