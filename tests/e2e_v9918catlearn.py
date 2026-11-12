"""v9.9.18 M5 (Ali picked B — ask once, right when he changes a category; the list stays in Settings): Seoudi 640 changed from Food to
Groceries → "Always put Seoudi in Groceries? 3 older Seoudi payments will change too." → Yes, always → the 3 older ones change, the one
set by hand and "Seoudi Market Online" don't; Money settings lists "Seoudi → Groceries" with Delete. "Just this one" learns nothing.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9918catlearn.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
d = lambda k: (datetime.date.today() - datetime.timedelta(days=k)).isoformat()
TX = [{"id": "s%d" % k, "type": "expense", "amount": 600 + 10 * k, "cat": "food", "account": "b", "date": d(k * 3), "note": "Seoudi"} for k in range(4)]
TX += [{"id": "h1", "type": "expense", "amount": 999, "cat": "health", "account": "b", "date": d(13), "note": "Seoudi", "catByHand": True},
       {"id": "o1", "type": "expense", "amount": 450, "cat": "food", "account": "b", "date": d(14), "note": "Seoudi Market Online"},
       {"id": "t1", "type": "expense", "amount": 185, "cat": "food", "account": "b", "date": d(1), "note": "talabat"}]
L = {"currency": "EGP", "accounts": [{"id": "b", "name": "CIB", "emoji": "🏦", "currency": "EGP", "start": 20000}], "txns": TX, "budgets": {"overall": 0, "cats": {}},
     "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": [], "notes": [], "zakatHistory": [], "zakatPayments": []}
INIT = "try{if(!localStorage.getItem('t:seeded')){localStorage.setItem('t:seeded','1');localStorage.setItem('ledger.v3', %s)}}catch(e){}" % json.dumps(json.dumps(L))
def ledger(page): return {t["id"]: t for t in json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))["txns"]}
def open_row(page, note, amount):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))"); page.wait_for_selector("[data-testid=money-bar]", timeout=10000); page.wait_for_timeout(1200)
    page.click("[data-testid=money-more]"); page.click("[data-testid=money-open-ledger]"); page.wait_for_selector("[data-testid=money-list]")
    rows = page.locator("[data-testid=money-list-row]")
    for i in range(rows.count()):
        tx = rows.nth(i).inner_text()
        if note in tx and "Online" not in tx and amount in tx: rows.nth(i).click(); break
    page.wait_for_selector("[data-testid=money-tx-sheet]")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    open_row(page, "Seoudi", "600")
    page.locator("[data-testid=money-tx-sheet] button", has_text="Groceries").first.click()
    page.locator("[data-testid=money-tx-sheet] button", has_text="Save").last.click(); page.wait_for_selector("[data-testid=cat-always]", timeout=6000)
    a = page.locator("[data-testid=cat-always]").inner_text()
    check("Always put Seoudi in Groceries?" in a and "3 older Seoudi payments" in a, "the question, with how many older ones change: " + a.replace("\n", " "))
    page.click("[data-testid=cat-always-yes]"); page.wait_for_timeout(2500)
    led = ledger(page)
    check(all(led["s%d" % k]["cat"] == "groceries" for k in range(4)), "all four Seoudi payments are Groceries: " + str([led["s%d" % k]["cat"] for k in range(4)]))
    check(led["h1"]["cat"] == "health" and led["o1"]["cat"] == "food" and led["t1"]["cat"] == "food", "the hand-set one, Seoudi Market Online and talabat are untouched")
    page.click("[data-testid=money-more]"); page.wait_for_timeout(300)
    st = page.locator("[data-testid=money-more-settings]")
    if st.count(): st.first.click(); page.wait_for_timeout(600)
    r = page.locator("[data-testid=cat-rule]")
    check(r.count() == 1 and "Seoudi" in r.inner_text() and "Groceries" in r.inner_text(), "Money settings: What Money learned — Seoudi → Groceries")
    open_row(page, "talabat", "185")
    page.locator("[data-testid=money-tx-sheet] button", has_text="Fun").first.click()
    page.locator("[data-testid=money-tx-sheet] button", has_text="Save").last.click(); page.wait_for_selector("[data-testid=cat-always]", timeout=6000)
    page.click("[data-testid=cat-always-no]"); page.wait_for_timeout(1500)
    rules = page.evaluate("JSON.parse(localStorage.getItem('attune:catrules:v1')||'{}').rules")
    check(ledger(page)["t1"]["cat"] == "fun" and list(rules.keys()) == ["seoudi"], "Just this one → talabat changed, nothing learned: " + json.dumps(rules))
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
