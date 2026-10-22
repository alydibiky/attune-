"""v6.37 Missions (agent A): Home's line → the page; a goal is read, started, forecast from the ledger; the step; Why.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740missions.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today(); d = lambda n: (T - datetime.timedelta(days=n)).isoformat()
tx = [{"id": "e%d" % i, "type": "expense", "amount": 450, "cat": "food", "account": "a", "date": d(i)} for i in range(60)]
tx += [{"id": "s1", "type": "income", "amount": 30000, "account": "a", "date": d(5)}, {"id": "s2", "type": "income", "amount": 30000, "account": "a", "date": d(35)}]
L = {"currency": "EGP", "accounts": [{"id": "a", "name": "CIB", "currency": "EGP", "start": 10000}], "txns": tx, "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": [],
     "customCats": [], "goals": [], "projects": [], "notes": [], "zakatPayments": [], "zakatHistory": []}
INIT = "try{localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:start','home')}catch(e){}" % json.dumps(json.dumps(L))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.click("[data-testid=home-see-report]"); page.click("[data-testid=home-missions]"); page.wait_for_selector("[data-testid=missions-page]")   # v6.50: Missions are in My report
    check(page.locator("[data-testid=mission]").count() == 0, "Home's Missions line opens the page; no missions yet")
    page.fill("[data-testid=missions-input]", "save 52k in 3 months")
    check("Save 52,000" in page.locator("[data-testid=missions-read]").inner_text(), "the goal is read as you type: %s" % page.locator("[data-testid=missions-read]").inner_text())
    page.click("[data-testid=missions-start]"); page.wait_for_selector("[data-testid=mission]")
    ch = page.locator("[data-testid=mission-chance]").inner_text()
    check(ch.endswith("%") and 0 <= int(ch[:-1]) < 100, "a real chance from the ledger's last 60 days: %s" % ch)
    st = page.locator("[data-testid=mission-step]").inner_text()
    check("less a month on food" in st, "today's step raises the chance: %s" % st)
    page.click("[data-testid=mission-why]")
    check("Balance" in page.locator("[data-testid=mission-evidence]").inner_text(), "Why shows the evidence")
    saved = page.evaluate("JSON.parse(localStorage.getItem('attune:missions:v1')).items[0]")
    check(saved["base"]["balance"] > 0 and len(saved["log"]) == 1, "the mission keeps where you started and today's point on the chance line")
    page.evaluate("window.__attuneBack()"); page.wait_for_selector("[data-testid=phone-home]")
    if page.locator("[data-testid=home-missions]").count() == 0: page.click("[data-testid=home-see-report]")
    check("save 52k" in page.locator("[data-testid=home-missions]").inner_text().lower(), "My report now shows the mission and its chance")
    if page.locator("[data-testid=my-report-back]").count(): page.click("[data-testid=my-report-back]"); page.wait_for_selector("[data-testid=home-ask]")
    # typed in the Home box → Missions, already filled in
    page.fill("[data-testid=home-ask]", "عايز أخس 4 كيلو خلال شهرين"); page.keyboard.press("Enter")
    page.wait_for_selector("[data-testid=missions-page]", timeout=8000)
    check(page.input_value("[data-testid=missions-input]") == "عايز أخس 4 كيلو خلال شهرين" and "Lose 4 kg" in page.locator("[data-testid=missions-read]").inner_text(), "a goal typed on Home opens Missions, ready to start")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
