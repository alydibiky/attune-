"""v9.9.16 — Ali's OK on the combined mock-up (OK1, OK3 + K1 B1 Q1, 11 Nov 2026):
  OK3: "I will pay Ahmed 4500 next week" is a payment due that day; on the day Follow-ups asks "Did you pay …?"; "Paid" asks from
       which balance and which category (Attune's guess already picked), then it is in Money — from that balance, in that category.
  OK1: on a phone the top bar says the page's name (Follow-ups, Agents) and the page does not repeat it as a big heading.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9916paylater.py
"""
import json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
today = datetime.date.today().isoformat()
LIFE = {"v": 1, "items": [{"id": "c1", "created": 1, "person": "Ahmed", "currency": "EGP", "start": today, "every": None, "paid": [], "title": "Pay Ahmed", "kind": "bill", "dir": "out", "amount": 4500, "count": 1, "total": 4500, "planned": True}]}
LEDGER = {"txns": [], "accounts": [{"id": "cash", "name": "Cash", "currency": "EGP", "start": 2300}, {"id": "cib", "name": "CIB", "currency": "EGP", "start": 18400}]}
INIT = "try{localStorage.setItem('attune:start','home');if(!localStorage.getItem('t:seeded')){localStorage.setItem('t:seeded','1');localStorage.setItem('attune:life:v1',%s);localStorage.setItem('ledger.v3',%s)}}catch(e){}" % (json.dumps(json.dumps(LIFE)), json.dumps(json.dumps(LEDGER)))
def open_mode(page, m, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    open_mode(page, "timeline", "[data-testid=fu-thread]")
    # OK1
    check(page.locator("header p").first.inner_text().strip() == "Follow-ups", "OK1: the top bar says “Follow-ups”: " + page.locator("header p").first.inner_text())
    check(page.locator("[data-testid=timeline-page] h2.att-h1").count() == 1 and not page.locator("[data-testid=timeline-page] h2.att-h1").first.is_visible(), "…and the page does not repeat it as a big heading")
    # OK3
    t = page.locator("[data-testid=fu-thread]").inner_text()
    check("Did you pay Ahmed?" in t and "4,500" in t, "OK3: on the day Follow-ups asks “Did you pay Ahmed?” with the amount: " + t.replace("\n", " ")[:120])
    check(page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns.length") == 0, "…nothing is in Money before the answer")
    page.locator("[data-testid=fu-yes]").first.click(); page.wait_for_selector("[data-testid=paid-step]", timeout=4000)
    accs = page.locator("[data-testid=paid-acc]")
    check(accs.count() == 2 and "Cash" in accs.nth(0).inner_text() and "18,400" in accs.nth(1).inner_text(), "“Paid” asks from which balance — each with what is in it")
    cats = page.locator("[data-testid=paid-cat]")
    check(cats.count() >= 4 and cats.first.get_attribute("aria-pressed") == "true", "…and which category, Attune's guess already picked (K1)")
    check(page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns.length") == 0, "…still nothing in Money")
    accs.nth(1).click(); page.locator("[data-testid=paid-cat][data-cat=transport]").click(); page.locator("[data-testid=paid-go]").click(); page.wait_for_timeout(400)
    tx = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
    check(len(tx) == 1 and tx[0]["amount"] == 4500 and tx[0]["type"] == "expense" and tx[0].get("account") == "cib" and tx[0].get("cat") == "transport", "Add to Money → 4,500 out of CIB, in the category picked: " + json.dumps(tx)[:200])
    check("Recorded in Money" in page.locator("[data-testid=fu-thread]").inner_text(), "…and the thread says so, with Undo")
    page.locator("[data-testid=fu-undo]").last.click(); page.wait_for_timeout(300)
    check(page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns.length") == 0, "Undo takes it back out of Money")
    # another amount
    page.reload(); page.wait_for_timeout(1000); open_mode(page, "timeline", "[data-testid=fu-thread]")
    page.locator("[data-testid=fu-yes]").first.click(); page.wait_for_selector("[data-testid=paid-step]")
    page.locator("[data-testid=paid-other]").click(); page.fill("[data-testid=paid-amount]", "4000"); page.locator("[data-testid=paid-go]").click(); page.wait_for_timeout(400)
    tx = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
    check(len(tx) == 1 and tx[0]["amount"] == 4000, "“Another amount” → what was really paid (4,000) goes to Money")
    # one account → no balance question (B1)
    page.evaluate("l => { localStorage.setItem('attune:life:v1', JSON.stringify(l)); localStorage.setItem('ledger.v3', JSON.stringify({txns: [], accounts: [{id: 'cash', name: 'Cash', currency: 'EGP', start: 9000}]})); localStorage.removeItem('attune:fu:done'); }", LIFE)
    page.reload(); page.wait_for_timeout(1000); open_mode(page, "timeline", "[data-testid=fu-thread]")
    page.locator("[data-testid=fu-yes]").first.click(); page.wait_for_selector("[data-testid=paid-step]")
    check(page.locator("[data-testid=paid-acc]").count() == 0 and page.locator("[data-testid=paid-cat]").count() >= 4, "B1: with one account only the category is asked")
    # OK1 on Agents
    open_mode(page, "agents", "[data-testid=agents-page], body")
    check(page.locator("header p").first.inner_text().strip() == "Agents", "OK1: Agents' top bar says “Agents”, not “Attune”: " + page.locator("header p").first.inner_text())
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
