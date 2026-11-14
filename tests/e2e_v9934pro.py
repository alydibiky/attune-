"""v9.9.34 Free / Pro (Ali picked FP-4 · PM-1 · PM-2 · PM-4, OK-1 with Undo kept) in the real page, as a Free user whose trial ended:
the Home line after 5 payments typed by hand (Show me → the Plan page's two columns), the Plan table, the Money auto-save note, Week plan
and Money for two showing "Part of Pro", and as Pro (the trial) none of it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9934pro.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
today = datetime.date.today()
TX = [{"id": "t%d" % i, "type": "expense", "amount": 50 + i, "currency": "USD", "cat": "food", "note": "lunch", "date": (today - datetime.timedelta(days=i % 3)).isoformat(), "account": "c"} for i in range(6)]
LED = {"currency": "USD", "accounts": [{"id": "c", "name": "Cash", "currency": "USD", "start": 0}], "txns": TX, "budgets": {"overall": 0, "cats": {}}, "recurring": []}
def init(pro):
    s = "try{localStorage.setItem('attune:start','home');localStorage.setItem('ledger.v3',%s);localStorage.setItem('attune:onboarded','1');" % json.dumps(json.dumps(LED))
    if not pro: s += "localStorage.setItem('attune:first-run','1');localStorage.setItem('attune:testing-pro','off');localStorage.setItem('attune:trial-end-seen','1');"
    return s + "}catch(e){}"
with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- Free (the trial ended)
    ctx, page = new_page(br, env, errors, extra_init=init(False))
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(600)
    card = page.locator("[data-testid=pro-typed]")
    check(card.count() == 1, "Free, 6 payments typed this week → the PM-1 line shows on Home")
    check("6" in card.inner_text() and "by itself" in card.inner_text(), "…it says how many and that Pro saves them by itself: " + card.inner_text().replace("\n", " ")[:140])
    page.click("[data-testid=pro-typed-see]"); page.wait_for_selector("[data-testid=plan-two]", timeout=8000)
    two = page.locator("[data-testid=plan-two]").inner_text()
    check("You do it" in two and "Attune does it" in two, "Show me → the Plan page opens on the two columns (You do it · Attune does it)")
    page.locator("[data-testid=compare] summary").click(); page.wait_for_timeout(200)
    tbl = page.locator("[data-testid=compare]").inner_text()
    check("Asks you each time" in tbl and "By itself, with Undo" in tbl and "3 a day each" in tbl, "the table: bank messages — Free asks, Pro by itself WITH Undo; 3 a day each")
    page.reload(); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(500)
    check(page.locator("[data-testid=pro-typed]").count() == 0, "shown once a day — not again after reopening")
    # a Pro-only screen
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-weekplan'))"); page.wait_for_timeout(800)
    lock = page.locator("[data-testid=pro-lock]")
    check(lock.count() >= 1, "Week plan in Free → the “Part of Pro” card")
    check("Everything you made stays yours" in (lock.first.inner_text() if lock.count() else ""), "…which says nothing made is lost")
    if lock.count():
        page.locator("[data-testid=pro-lock-see]").first.click(); page.wait_for_selector("[data-testid=plan-two]", timeout=8000)
        check(True, "See Pro opens the Plan page")
    check(not real_errors(errors), "no page errors (Free): " + str(real_errors(errors))[:200])
    ctx.close()
    # ---- Pro (the trial is on)
    errors.clear()
    ctx, page = new_page(br, env, errors, extra_init=init(True))
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(600)
    check(page.locator("[data-testid=pro-typed]").count() == 0, "Pro / trial: no PM-1 line")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-weekplan'))"); page.wait_for_timeout(800)
    check(page.locator("[data-testid=pro-lock]").count() == 0, "Pro: Week plan opens normally")
    check(not real_errors(errors), "no page errors (Pro): " + str(real_errors(errors))[:200])
    ctx.close(); br.close()
finish()
