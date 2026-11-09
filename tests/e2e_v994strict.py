"""v9.9.4 M1 (Ali: "make the guidelines strict, I don't want the code saving things wrong"): the Home box saves only what it is sure
of; "co 900" → "Save this? Expense 900 — co" · Yes / No — nothing saved before Yes; "spent 200 on lunch" is saved at once.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v994strict.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
L = {"currency": "EGP", "accounts": [{"id": "b", "name": "Cash", "currency": "EGP", "start": 5000}], "txns": [], "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": []}
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('ledger.v3', %s)}catch(e){}" % json.dumps(json.dumps(L))
tx = lambda page: page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
def home(page, t):
    page.fill("[data-testid=home-ask]", t); page.click("[data-testid=home-send]"); page.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1500)
    home(page, "spent 200 on lunch")
    check(len(tx(page)) == 1 and tx(page)[0]["amount"] == 200, "sure (“spent 200 on lunch”) → saved at once")
    home(page, "co 900")
    check(page.locator("[data-testid=confirm-card]").count() == 1 and "Save this? Expense 900" in page.inner_text("[data-testid=confirm-card]"), "not sure (“co 900”) → Save this? Expense 900 — co")
    check(len(tx(page)) == 1, "…nothing saved before Yes")
    page.click("[data-testid=confirm-no]"); page.wait_for_timeout(200)
    check(len(tx(page)) == 1 and "nothing saved" in page.inner_text("body"), "No → nothing saved, and it says so")
    home(page, "co 900"); page.click("[data-testid=confirm-yes]"); page.wait_for_timeout(300)
    check(len(tx(page)) == 2 and tx(page)[-1]["amount"] == 900, "Yes → saved (900)")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
