"""v9.9.18 AU2 (Ali picked A): "the maid 600" logged 4 Saturdays in a row → a card on Home; "Yes, every Saturday" → a weekly payment
in People & plans (asked on its day); the card goes away and never comes back. Random spending brings no card.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9918suggest.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
t = datetime.date.today(); sat = t - datetime.timedelta(days=(t.weekday() - 5) % 7)
TX = [{"id": "m%d" % k, "type": "expense", "amount": 600, "cat": "other", "account": "cash", "date": (sat - datetime.timedelta(days=7 * k)).isoformat(), "note": "the maid"} for k in range(4)]
TX += [{"id": "r%d" % k, "type": "expense", "amount": 50 + 37 * k, "cat": "food", "account": "cash", "date": (t - datetime.timedelta(days=3 * k + 1)).isoformat(), "note": "lunch"} for k in range(5)]
LEDGER = {"txns": TX, "accounts": [{"id": "cash", "name": "Cash", "currency": "EGP", "start": 5000}]}
INIT = "try{localStorage.setItem('attune:start','home');if(!localStorage.getItem('t:seeded')){localStorage.setItem('t:seeded','1');localStorage.setItem('ledger.v3',%s)}}catch(e){}" % json.dumps(json.dumps(LEDGER))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1800)
    c = page.locator("[data-testid=home-suggest]")
    check(c.count() == 1 and "the maid" in c.inner_text() and "Saturday" in c.inner_text() and "600" in c.inner_text(), "Home shows the habit: " + (c.inner_text().replace("\n", " ")[:160] if c.count() else "none"))
    page.locator("[data-testid=suggest-yes]").click(); page.wait_for_timeout(500)
    life = page.evaluate("JSON.parse(localStorage.getItem('attune:life:v1') || '{\"items\":[]}').items")
    check(len(life) == 1 and life[0]["kind"] == "regular" and life[0]["days"] == [6] and life[0]["amount"] == 600, "Yes → a weekly payment on Saturday, 600: " + json.dumps(life)[:200])
    check(page.locator("[data-testid=home-suggest]").count() == 0, "…and the card goes away")
    page.reload(); page.wait_for_timeout(1500)
    check(page.locator("[data-testid=home-suggest]").count() == 0, "…and doesn't come back")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
