"""v9.9.18 M1 (Ali picked A — a checklist with amounts): a salary that came in two parts (12,000 + 13,000 two days apart) is one
salary of 25,000; Home shows "Salary arrived — sort it"; the plan starts from People & plans (rent 8,000, gam'eya 2,000);
ticking rent leaves 2,000 to pay; Edit plan → add "Car fund 10%" → 2,500; Left to spend = 12,500 exactly; a part bigger than what's
left is flagged, not cut; "Mark the rest done" → the Home card goes away. Arabic too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9918salary.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
t = datetime.date.today()
TX = [{"id": "s1", "type": "income", "amount": 12000, "cat": "salary", "account": "cib", "date": (t - datetime.timedelta(days=3)).isoformat(), "note": "salary part 1"},
      {"id": "s2", "type": "income", "amount": 13000, "cat": "other", "account": "cib", "date": (t - datetime.timedelta(days=1)).isoformat(), "note": "مرتب"}]
LEDGER = {"txns": TX, "accounts": [{"id": "cib", "name": "CIB", "currency": "EGP", "start": 0}]}
LIFE = {"items": [{"id": "a", "kind": "rent", "dir": "out", "amount": 8000, "count": 0, "total": 0, "every": "month", "title": "Rent", "start": t.isoformat(), "paid": []},
                  {"id": "b", "kind": "circle", "dir": "out", "amount": 2000, "count": 10, "total": 20000, "every": "month", "title": "Gam'eya", "start": t.isoformat(), "paid": []}]}
SEED = {"ledger.v3": LEDGER, "attune:life:v1": LIFE}
INIT = "try{localStorage.setItem('attune:start','home');if(!localStorage.getItem('t:seeded')){localStorage.setItem('t:seeded','1');var S=%s;for(var k in S)localStorage.setItem(k,JSON.stringify(S[k]))}}catch(e){}" % json.dumps(SEED)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1800)
    h = page.locator("[data-testid=home-salary]")
    check(h.count() == 1 and "2 parts to pay" in h.inner_text() and "15,000" in h.inner_text(), "Home: Salary arrived — sort it · 2 parts · 15,000 left: " + (h.inner_text().replace("\n", " ") if h.count() else "none"))
    h.click(); page.wait_for_selector("[data-testid=salary-page]", timeout=6000)
    hd = page.locator("[data-testid=salary-head]").inner_text()
    check("25,000" in hd and "2 parts" in hd, "two parts two days apart = one salary of 25,000: " + hd.replace("\n", " "))
    rows = page.locator("[data-testid=salary-row]")
    check(rows.count() == 2 and "8,000" in rows.nth(0).inner_text() and "2,000" in rows.nth(1).inner_text(), "the plan starts from People & plans: rent 8,000 · gam'eya 2,000")
    rows.nth(0).locator("input").check(); page.wait_for_timeout(200)
    check("2,000" in page.locator("[data-testid=salary-topay]").inner_text(), "rent ticked → still to pay 2,000")
    page.locator("[data-testid=salary-edit]").click(); page.locator("[data-testid=salary-add]").click()
    er = page.locator("[data-testid=salary-editrow]").nth(2); er.locator("input").nth(0).fill("Car fund"); er.locator("input").nth(1).fill("10%")
    page.locator("[data-testid=salary-add]").click()
    er = page.locator("[data-testid=salary-editrow]").nth(3); er.locator("input").nth(0).fill("New phone"); er.locator("input").nth(1).fill("20000")
    page.locator("[data-testid=salary-save]").click(); page.wait_for_timeout(300)
    rows = page.locator("[data-testid=salary-row]")
    check(rows.count() == 4 and "2,500" in rows.nth(2).inner_text(), "Car fund 10% → 2,500")
    check("Doesn't fit" in rows.nth(3).inner_text(), "a 20,000 part bigger than what's left is flagged, not cut")
    check("12,500" in page.locator("[data-testid=salary-left]").inner_text(), "Left to spend = 25,000 − 8,000 − 2,000 − 2,500 = 12,500: " + page.locator("[data-testid=salary-left]").inner_text().replace("\n", " "))
    check(rows.nth(0).locator("input").is_checked(), "the rent tick is kept after editing")
    page.locator("[data-testid=salary-all]").click(); page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_timeout(800)
    check(page.locator("[data-testid=home-salary]").count() == 0, "all done → the Home card goes away")
    page.evaluate("localStorage.setItem('attune:ui:lang','ar')"); page.reload(); page.wait_for_timeout(1500)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'salary'}}))"); page.wait_for_selector("[data-testid=salary-page]", timeout=6000)
    check("المرتب نزل" in page.locator("[data-testid=salary-head]").inner_text() and "الباقي للصرف" in page.locator("[data-testid=salary-left]").inner_text(), "Arabic: «المرتب نزل» · «الباقي للصرف»")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
