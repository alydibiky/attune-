"""v8.7 (Ali: "a year plan with months, like in Excel"): Money → Month plan → The year — a sheet, a cell typed over, Excel.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v870yearplan.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
t = datetime.date.today()
def mo(k): d = (t.replace(day=1) - datetime.timedelta(days=28 * k)); return d.strftime("%Y-%m")
TX = [{"id": "i%d" % k, "type": "income", "amount": 30000, "date": mo(k) + "-01", "cat": "salary", "note": "Salary", "account": "a"} for k in (1, 2, 3)]
TX += [{"id": "e%d" % k, "type": "expense", "amount": 3000, "date": mo(k) + "-05", "cat": "groceries", "note": "", "account": "a"} for k in (1, 2, 3)]
L = {"currency": "EGP", "accounts": [{"id": "a", "name": "Bank", "currency": "EGP"}], "txns": TX, "recurring": []}
INIT = """localStorage.setItem('ledger.v3', %s); localStorage.setItem('attune:pots:v1', JSON.stringify({ pots: [{ id: 'trip', name: 'Travel', kind: 'travel', target: 0, per: 4000, saved: 0, log: [] }] }));
if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('attune:resume:v1', JSON.stringify({ mode: 'planner', at: Date.now(), hist: [] })); }""" % json.dumps(json.dumps(L))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("[data-testid=planner-view-year]", timeout=15000)
    page.click("[data-testid=planner-view-year]"); page.wait_for_selector("[data-testid=year-sheet]")
    check(page.locator("[data-testid=year-sheet] thead th").count() == 14, "12 months + the item + the year's total as columns")
    labels = page.locator("[data-testid=year-row] td:first-child").all_inner_texts()
    check("Salary" in labels and any("Travel" in x for x in labels) and any("Groceries" in x for x in labels), "rows: income by source, savings goals, everyday spending (%s)" % labels)
    free0 = page.locator("[data-testid=year-total-free] td").last.inner_text()
    k = 11   # December
    page.click("[data-testid='year-cell-src:salary-%d']" % k); page.fill("[data-testid=year-cell-input]", "50000"); page.keyboard.press("Enter"); page.wait_for_timeout(200)
    check(page.locator("[data-testid='year-cell-src:salary-%d']" % k).inner_text() == "50,000", "tap a cell, type 50,000 — like Excel")
    check(page.locator("[data-testid=year-total-free] td").last.inner_text() != free0, "…and the year's Free follows (%s → %s)" % (free0, page.locator("[data-testid=year-total-free] td").last.inner_text()))
    check(json.loads(page.evaluate("localStorage.getItem('attune:yearplan:v1')"))["cells"].get("src:salary|%s-12" % t.year) == 50000, "the typed number is kept on the phone")
    check(page.locator("[data-testid=year-excel]").count() == 1, "an Excel button")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
