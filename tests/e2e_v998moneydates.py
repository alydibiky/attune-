"""v9.9.8 (Ali picked P1 + "a specific date and category at the same time"): the Money Report moves between months (‹ ›) and shows
any From–To with one category; every number follows (totals, pies, list). + his screenshot bugs: one "Other" only, % never cut.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v998moneydates.py
"""
import json, datetime, re
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today(); m1 = T.replace(day=1); p1 = (m1 - datetime.timedelta(days=1)).replace(day=1)   # last month's 1st
L = {"currency": "EGP", "accounts": [{"id": "c", "name": "Cash", "currency": "EGP", "start": 90000}],
     "txns": [{"id": "a", "type": "expense", "amount": 1000, "cat": "groceries", "account": "c", "date": p1.replace(day=3).isoformat(), "note": "Seoudi"},
              {"id": "b", "type": "expense", "amount": 400, "cat": "food", "account": "c", "date": p1.replace(day=20).isoformat(), "note": "Koshari"},
              {"id": "c", "type": "income", "amount": 9000, "cat": "salary", "account": "c", "date": p1.replace(day=25).isoformat(), "note": "Salary"},
              {"id": "d", "type": "expense", "amount": 700, "cat": "groceries", "account": "c", "date": m1.isoformat(), "note": "Carrefour"}],
     "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": [], "notes": [], "zakatPayments": [], "zakatHistory": []}
INIT = "try{localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:country','eg')}catch(e){}" % json.dumps(json.dumps(L))
num = lambda s: int(re.sub(r"[^\d]", "", s.split("EGP")[0]) or 0)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))")
    page.wait_for_selector("[data-testid=money-calm]", timeout=8000); page.wait_for_timeout(1200)
    page.click("[data-testid=money-open-report]"); page.wait_for_selector("[data-testid=money-period]", timeout=5000)
    out = lambda: num(page.locator("[data-testid=money-rep-out]").inner_text().split("\n")[1])
    check(out() == 700 and page.locator("[data-testid=money-period-next]").is_disabled(), "the report opens on this month (700), › is off (no future months)")
    page.click("[data-testid=money-period-prev]"); page.wait_for_timeout(300)
    check(out() == 1400 and "9,000" in page.locator("[data-testid=money-rep-in]").inner_text(), "‹ → last month: 1,400 spent, 9,000 earned")
    check(p1.strftime("%B") in page.locator("[data-testid=money-period-label]").inner_text(), "…the bar names it: " + page.locator("[data-testid=money-period-label]").inner_text())
    # From–To + a category, together
    page.click("[data-testid=money-period-label]"); page.wait_for_selector("[data-testid=money-period-sheet]")
    page.fill("[data-testid=money-period-from]", p1.isoformat()); page.fill("[data-testid=money-period-to]", T.isoformat())
    page.select_option("[data-testid=money-period-catpick]", "groceries"); page.click("[data-testid=money-period-show]"); page.wait_for_timeout(400)
    check(out() == 1700, "Groceries from last month's 1st to today = 1,000 + 700 = 1,700 (the food is left out)")
    check("Groceries" in page.locator("[data-testid=money-period-cat]").inner_text(), "the category shows as a chip (✕ removes it)")
    page.click("[data-testid=money-period-cat]"); page.wait_for_timeout(300)
    check(out() == 2100, "✕ on the category → the same dates, every category: 2,100")
    page.click("[data-testid=money-period-reset]"); page.wait_for_timeout(300)
    check(out() == 700, "Back to this month → 700")
    w = page.evaluate("document.documentElement.scrollWidth")
    check(w <= 390, "nothing wider than the phone (the % are never cut): %s" % w)
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
