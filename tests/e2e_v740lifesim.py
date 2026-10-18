"""v6.38 Missions phase 2 — "Test a big decision" (the Life Simulator): four months of salary and spending in Money →
cash vs installments for a 900,000 car → 2,000 futures, 1 / 3 / 5 years, stress tests, one sentence.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740lifesim.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today()
txns = []
for i in range(120):
    d = (T - datetime.timedelta(days=i)).isoformat()
    if i % 30 == 5: txns.append({"id": "s%d" % i, "type": "income", "cat": "salary", "amount": 40000, "date": d, "account": "a", "note": "salary"})
    txns.append({"id": "e%d" % i, "type": "expense", "cat": "food", "amount": 700, "date": d, "account": "a", "note": "x"})
LEDGER = {"currency": "EGP", "accounts": [{"id": "a", "name": "Bank", "currency": "EGP", "start": 1000000}], "txns": txns, "recurring": [], "debts": [], "budgets": []}
INIT = "try{localStorage.setItem('ledger.v3', %s)}catch(e){}" % json.dumps(json.dumps(LEDGER))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'missions'}}))")
    page.wait_for_selector("[data-testid=lifesim-open]", timeout=8000); page.click("[data-testid=lifesim-open]")
    page.click("[data-testid=lifesim-run]")
    page.wait_for_selector("[data-testid=lifesim-result]", timeout=10000)
    rows = page.locator("[data-testid=lifesim-row]").all_inner_texts()
    check(len(rows) == 3 and rows[0].startswith("Don't do it") and "Cash" in rows[1] and "Installments" in rows[2], "three futures compared: %s" % [r.replace("\n", " ")[:60] for r in rows])
    v = page.locator("[data-testid=lifesim-verdict]").inner_text()
    check("better" in v and "today's pounds" in v, "one sentence names the better option: %s" % v)
    st = page.locator("[data-testid=lifesim-stress]").inner_text()
    check("The pound loses 30%" in st and "Three months without income" in st, "the stress tests are shown")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
