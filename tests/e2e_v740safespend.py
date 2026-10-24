"""v6.37 (upgrade M1) — "Safe to spend today" on Money: phone row above the ledger, computer card on Overview; tap = what it counted.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740safespend.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today(); iso = lambda n: (T + datetime.timedelta(days=n)).isoformat()
L = {"currency": "EGP", "accounts": [{"id": "b", "name": "CIB", "currency": "EGP", "start": 20000}],
     "txns": [{"id": "t1", "type": "expense", "amount": 300, "cat": "food", "account": "b", "date": T.isoformat(), "note": "Lunch"}],
     "budgets": {"overall": 0, "cats": {}},
     "recurring": [{"id": "r1", "type": "income", "amount": 30000, "account": "b", "freq": "monthly", "nextDate": iso(10), "note": "Salary", "active": True},
                   {"id": "r2", "type": "expense", "amount": 450, "account": "b", "freq": "monthly", "nextDate": iso(3), "note": "Internet", "active": True}],
     "debts": [], "customCats": [], "goals": [], "projects": [], "notes": [], "zakatPayments": [], "zakatHistory": []}
INIT = "try{localStorage.setItem('ledger.v3', %s)}catch(e){}" % json.dumps(json.dumps(L))
per = int((20000 - 450) / 10)   # the balance before today's lunch, minus the bill, over 10 days
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))")
    page.wait_for_selector("[data-testid=safe-spend]", timeout=8000)
    t = page.locator("[data-testid=safe-today]").inner_text()
    check(("{:,}".format(per - 300)) in t, "phone: safe to spend today = (balance − bills before payday) ÷ 10 days − today's lunch: %s" % t)
    page.click("[data-testid=safe-spend] button"); page.wait_for_selector("[data-testid=safe-details]")
    d = page.locator("[data-testid=safe-details]").inner_text()
    check("Internet" in d and "450" in d, "a tap shows what it counted: %s" % d[:120].replace("\n", " · "))
    page.fill("[data-testid=safe-cushion]", "5000"); page.locator("[data-testid=safe-cushion]").blur(); page.wait_for_timeout(300)
    t2 = page.locator("[data-testid=safe-today]").inner_text()
    check(t2 != t, "keeping 5,000 aside lowers it: %s" % t2)
    ctx.close()
    ctx, page = new_page(br, env, errors, desktop=(1440, 900), extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000)
    page.locator("[data-testid=side-go-money]").first.click(); page.wait_for_selector("[data-testid=money-desk]", timeout=8000)
    page.wait_for_selector("[data-testid=money-calm]", timeout=8000)
    check(page.locator("[data-testid=money-balance-hero] [data-testid=safe-spend]").count() == 1, "computer (v7.2): in the balance card of Money's calm view")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
