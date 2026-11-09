"""v9.9.9 (Ali: "a WhatsApp group related to work was talking about money and it was added to my income — what the hell?"): Money
offers to remove what was added from chat messages before the fix (never deleted silently); Remove takes them out through Money.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v999chatmoney.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today().isoformat()
L = {"currency": "EGP", "accounts": [{"id": "c", "name": "CIB", "currency": "EGP", "start": 5000}],
     "txns": [{"id": "wa1", "type": "income", "amount": 450, "cat": "salary", "account": "c", "date": T, "note": "يوم · WhatsApp", "source": "notification",
               "evidence": {"text": "غفره بليل ٤٥٠ جنيه+١٠٠جنيه اعاشه", "from": "ما يخص المرتبات", "app": "WhatsApp", "ts": 1}},
              {"id": "bk1", "type": "expense", "amount": 300, "cat": "groceries", "account": "c", "date": T, "note": "Carrefour · CIB", "source": "notification", "evidence": {"text": "x", "app": "CIB"}},
              {"id": "ty1", "type": "income", "amount": 3000, "cat": "salary", "account": "c", "date": T, "note": "Salary"}],
     "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": [], "notes": [], "zakatPayments": [], "zakatHistory": []}
INIT = "try{localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:country','eg')}catch(e){}" % json.dumps(json.dumps(L))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))")
    page.wait_for_selector("[data-testid=paylog-chatfix]", timeout=15000)
    card = page.locator("[data-testid=paylog-chatfix]")
    check(card.locator("[data-testid=paylog-chatfix-row]").count() == 1 and "450" in card.inner_text() and "المرتبات" in card.inner_text(), "Money shows the one entry added from the WhatsApp group (not the bank one, not the typed salary)")
    page.click("[data-testid=paylog-chatfix-remove]"); page.wait_for_timeout(2500)
    ids = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns.map(t => t.id)")
    check("wa1" not in ids and "bk1" in ids and "ty1" in ids, "Remove → only the WhatsApp entry is gone (through Money's own delete): %s" % ids)
    check(page.locator("[data-testid=paylog-chatfix]").count() == 0, "…and the card goes away")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
