"""v6.27 — Money on a computer in design A "Calm" (Ali picked it, 13 Oct 2026): a real wide layout (title, tabs, three
columns) computed by code from the Money ledger; the other tabs open Money (Yusr) on the matching screen.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727moneydesk.py     (SHOTS=dir for screenshots)
"""
import json, os, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
T = datetime.date.today(); d = lambda n: (T - datetime.timedelta(days=n)).isoformat()
L = {"currency": "EGP", "accounts": [{"id": "c", "name": "Cash", "emoji": "💵", "currency": "EGP", "start": 1000}, {"id": "b", "name": "CIB", "emoji": "🏦", "currency": "EGP", "start": 40000}],
     "txns": [{"id": "t1", "type": "income", "amount": 15000, "cat": "salary", "account": "b", "date": d(0) if T.day == 1 else T.replace(day=1).isoformat(), "note": "Salary"},
              {"id": "t2", "type": "expense", "amount": 600, "cat": "transport", "account": "c", "date": d(1), "note": "Fuel 92"},
              {"id": "t3", "type": "expense", "amount": 350, "cat": "groceries", "account": "b", "date": d(0), "note": "Carrefour"}],
     "budgets": {"overall": 12000, "cats": {}},
     "recurring": [{"id": "r1", "type": "expense", "amount": 640, "cat": "bills", "account": "b", "freq": "monthly", "nextDate": (T + datetime.timedelta(days=3)).isoformat(), "note": "Electricity", "active": True}],
     "debts": [{"id": "x1", "type": "owed_to_me", "person": "Ahmed", "amount": 12000, "note": "installments", "settled": False, "payments": [{"amount": 1000}, {"amount": 1000}, {"amount": 1000}]}],
     "customCats": [], "goals": [], "projects": [], "notes": [], "zakatPayments": [], "zakatHistory": []}
INIT = "try{localStorage.setItem('ledger.v3', %s)}catch(e){}" % json.dumps(json.dumps(L))
with sync_playwright() as p:
    br = p.chromium.launch()
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, desktop=(1440, 900), extra_init=INIT + (";try{localStorage.setItem('attune:theme:v1', JSON.stringify({accent:'teal',bg:'light'}))}catch(e){}" if theme == "light" else ""))
        page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000); page.wait_for_timeout(400)
        page.locator("[data-testid=side-go-money]").first.click()
        page.wait_for_selector("[data-testid=money-desk]", timeout=8000); page.wait_for_timeout(600)
        bal = page.locator("[data-testid=money-balance]").inner_text()
        check("55,050" in bal, "[%s] the balance, by code from the ledger: %s" % (theme, bal))
        check("Carrefour" in page.locator("[data-testid=money-latest]").inner_text(), "[%s] the latest entries" % theme)
        owed = page.locator("[data-testid=money-owed]").first.inner_text()
        check("ahmed" in owed.lower() and "9,000" in owed, "[%s] Ahmed owes 9,000 more after 3 payments: %s" % (theme, owed.replace("\n", " · ")))
        check("Electricity" in page.locator("[data-testid=money-due]").inner_text(), "[%s] the bill due this week" % theme)
        w = page.evaluate("() => { const o = document.querySelector('[data-testid=money-overview]').getBoundingClientRect(); return o.width; }")
        check(w > 900, "[%s] a real wide layout — three columns across %d px, not the phone column" % (theme, w))
        fam = page.evaluate("() => getComputedStyle(document.querySelector('[data-testid=money-desk]')).fontFamily")
        check("Figtree" in fam, "[%s] the Calm font: %s" % (theme, fam))
        if SHOTS: page.screenshot(path=os.path.join(SHOTS, "money-desk-%s.png" % theme))
        page.locator("[data-testid=money-tab-bills]").click(); page.wait_for_timeout(1200)
        check(page.locator("[data-testid=money-yusr]").is_visible() and page.locator("[data-testid=money-overview]").count() == 0, "[%s] the Bills tab opens Money itself" % theme)
        page.locator("[data-testid=money-tab-overview]").click(); page.wait_for_timeout(200)
        check(page.locator("[data-testid=money-overview]").count() == 1, "[%s] …and back to the Overview" % theme)
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
