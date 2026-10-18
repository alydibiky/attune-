"""v6.37 (upgrades M4 + M5) — Chat X-Ray: "Who keeps their word" over the chats X-rayed before; the Radar's Cancel kit.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740promise.py
"""
import json, datetime, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today(); ms = lambda n: int(time.mktime((T - datetime.timedelta(days=n)).timetuple()) * 1000) + 43200000
iso = lambda n: (T - datetime.timedelta(days=n)).isoformat()
SAVED = [{"id": "x1", "name": "Ahmed", "me": "Ali", "at": ms(0), "ledger": [], "unanswered": [], "stats": {}, "items": [
  {"type": "promise", "from": "Ahmed", "t": ms(30), "amount": 5000, "due": iso(28), "what": "هحولك ال 5000 الخميس"},
  {"type": "paid", "from": "Ahmed", "t": ms(29), "amount": 5000},
  {"type": "promise", "from": "Ahmed", "t": ms(20), "amount": 2000, "due": iso(18), "what": "الباقي بكرة"}]}]
RADAR = {"items": [{"id": "d1", "kind": "renewal", "title": "Netflix", "date": (T + datetime.timedelta(days=2)).isoformat(), "amount": 240, "currency": "EGP", "status": "active", "source": "typed", "created": ms(1)}], "seen": []}
INIT = "try{localStorage.setItem('attune:xray:v1', %s);localStorage.setItem('attune:radar:v1', %s)}catch(e){}" % (json.dumps(json.dumps(SAVED)), json.dumps(json.dumps(RADAR)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'xray'}}))")
    page.wait_for_selector("[data-testid=xray-scores]", timeout=8000)
    t = page.locator("[data-testid=xray-score]").first.inner_text()
    check("Ahmed" in t and "50%" in t and "1 kept" in t and "1 broken" in t, "Ahmed kept one promise and broke one: %s" % t.replace("\n", " · "))
    check("الباقي بكرة" in t, "…the broken promise is quoted")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'radar'}}))")
    page.wait_for_selector("[data-testid=radar-kit]", timeout=8000); page.click("[data-testid=radar-kit]")
    k = page.locator("[data-testid=radar-kit-panel]").inner_text()
    check("Netflix" in k and "account page" in k and "240 EGP" in k, "Cancel kit: the steps and a ready message: %s" % k[:100].replace("\n", " · "))
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
