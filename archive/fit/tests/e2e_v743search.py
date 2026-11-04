"""v6.43 (Ali: "free type AND search, not only one"): while a whole meal is typed, the food being typed now is searched too;
picking it keeps the rest of the sentence and the amount written before it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v743search.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav, [data-testid=phone-home], textarea", timeout=15000)
    page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: m } }))", "fit")
    page.wait_for_selector("[data-testid=fit-qs-welcome], [data-testid=fit-today]", timeout=8000)
    if page.locator("[data-testid=fit-qs-welcome]").count():
        page.click("[data-testid=fit-qs-start]"); page.click("[data-testid=fit-qs-goal-lose]"); page.click("[data-testid=fit-qs-next]")
        page.fill("[data-testid=fit-qs-age]", "21"); page.fill("[data-testid=fit-qs-cm]", "180"); page.fill("[data-testid=fit-qs-kg]", "85")
        page.click("[data-testid=fit-qs-next]"); page.select_option("[data-testid=fit-qs-country]", "eg"); page.click("[data-testid=fit-qs-next]")
        page.wait_for_selector("[data-testid=fit-qs-plan]", timeout=4000); page.click("[data-testid=fit-qs-next]")
    page.wait_for_selector("[data-testid=fit-today]", timeout=5000)
    page.click("[data-testid=fit-add]")
    page.fill("[data-testid=fit-log-text]", "150 g chicken alfredo pasta and 7 chicken str")
    page.wait_for_selector("[data-testid=fit-min-results]", timeout=4000)
    check(page.locator("[data-testid=fit-search-label]").count() == 1 and page.locator("[data-testid=fit-read]").count() == 1, "typing a whole meal: the foods for what is typed now show, and Find the foods is there too")
    page.click("[data-testid=fit-food-chicken-strips]")
    page.wait_for_selector("[data-testid=fit-draft]", timeout=4000)
    body = page.inner_text("[data-testid=fit-draft]")
    check("Chicken Alfredo" in body and "Chicken strips" in body, "picking one keeps the rest of the meal: " + body[:120].replace("\n", " · "))
    grams = page.locator("[data-testid=fit-draft-grams]").evaluate_all("els => els.map(e => e.value)")
    check(grams == ["150", "266"], "the amounts written are kept (150 g, 7 strips = 266 g): %s" % grams)
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close(); finish()
