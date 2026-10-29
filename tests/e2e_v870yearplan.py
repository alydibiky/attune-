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
    page.click("[data-testid=planner-view-year]"); page.wait_for_selector("[data-testid=year-goals]")
    # v8.7 (Ali picked 1B "goals first, Attune spreads them")
    check(page.locator("[data-testid=year-goal]").count() == 1 and "Travel" in page.locator("[data-testid=year-goal]").inner_text(), "the year opens on the goals (Travel, 4,000 a month)")
    page.fill("[data-testid=year-goal-input]", "save 60k for Umrah by Sep"); page.click("[data-testid=year-goal-add]"); page.wait_for_timeout(300)
    umrah = page.locator("[data-testid=year-goal]:has-text('Umrah')")
    check(umrah.count() == 1 and "60,000" in umrah.inner_text() and "a month" in umrah.inner_text(), "one sentence → a goal called Umrah, 60,000, spread a month at a time: " + umrah.inner_text().replace("\n", " · ")[:120])
    check(page.locator("[data-testid^=year-bar-]").count() == 12 and page.locator("[data-testid=year-free-avg]").count() == 1, "a bar a month for what is left free, and the average")
    page.click("[data-testid=year-bar-10]"); page.wait_for_selector("[data-testid=year-month]")
    page.fill("[data-testid='year-month-src:salary']", "45000"); page.locator("[data-testid=year-month] b").first.click(); page.wait_for_timeout(200)
    check(json.loads(page.evaluate("localStorage.getItem('attune:yearplan:v1')"))["cells"].get("src:salary|%s-11" % t.year) == 45000, "tap November, change the salary — kept")
    page.fill("[data-testid=year-goal-input]", "a sofa"); page.click("[data-testid=year-goal-add]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=year-goal]").count() == 2, "a goal without an amount is not added (it asks for the amount)")
    umrah.locator("[data-testid=year-goal-remove]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=year-goal]:has-text('Umrah')").count() == 0, "Remove takes a goal off")
    page.click("[data-testid=year-to-sheet]"); page.wait_for_selector("[data-testid=year-sheet]")
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
