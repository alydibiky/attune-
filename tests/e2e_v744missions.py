"""v6.44 Missions phases 3–4 on the page: a spending limit (food this month), a debt from Money → People, and a company
mission read from Fleet (IndexedDB) — each read as you type, started, forecast from your own data.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v744missions.py
"""
import json, datetime, os, subprocess
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = subprocess.check_output(["node", "--input-type=module", "-e",
  "import { heal, loadDemo } from '%s/../web-src/fleet.js'; process.stdout.write(JSON.stringify(loadDemo(heal({}))))" % HERE], stderr=subprocess.DEVNULL).decode()
T = datetime.date.today(); d = lambda n: (T - datetime.timedelta(days=n)).isoformat()
tx = [{"id": "e%d" % i, "type": "expense", "amount": 100, "cat": "food", "account": "a", "date": d(i)} for i in range(60)]
tx += [{"id": "s%d" % i, "type": "income", "amount": 15000, "account": "a", "date": d(i * 30 + 3)} for i in range(2)]
L = {"currency": "EGP", "accounts": [{"id": "a", "name": "CIB", "currency": "EGP", "start": 5000}], "txns": tx, "budgets": {"overall": 0, "cats": {}}, "recurring": [],
     "debts": [{"id": "d1", "person": "Ahmed", "amount": 9000, "type": "i_owe", "payments": [{"amount": 1000, "date": d(10)}]}]}
INIT = "try{localStorage.setItem('ledger.v3', %s);localStorage.setItem('attune:start','home')}catch(e){}" % json.dumps(json.dumps(L))
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("""(s) => new Promise((ok) => { const r = indexedDB.open('attune-fleet', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(JSON.parse(s), 'state'); t.oncomplete = () => { r.result.close(); ok(); }; }; })""", DEMO)
    page.reload(); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.click("[data-testid=home-missions]"); page.wait_for_selector("[data-testid=missions-page]")
    def start(text, read):
        page.fill("[data-testid=missions-input]", text)
        got = page.locator("[data-testid=missions-read]").inner_text()
        check(read in got, "«%s» is read as: %s" % (text, got))
        n = page.locator("[data-testid=mission]").count(); page.click("[data-testid=missions-start]")
        page.wait_for_function("(n) => document.querySelectorAll('[data-testid=mission]').length > n", arg=n, timeout=5000)
        return page.locator("[data-testid=mission]").first
    c = start("Spend no more than 4000 on food this month", "Spend at most 4,000 on food")
    check("spent" in c.locator("[data-testid=mission-progress]").inner_text() and "a day on food" in c.locator("[data-testid=mission-step]").inner_text(), "a spending limit: spent so far / the limit, and what you may spend a day: " + c.locator("[data-testid=mission-step]").inner_text())
    c = start("Pay off what I owe Ahmed by 31 December", "Pay off the debt")
    check("1,000 / 8,000" not in c.inner_text() and "8,000" in c.locator("[data-testid=mission-progress]").inner_text() and "Pay Ahmed" in c.locator("[data-testid=mission-step]").inner_text(), "the debt to Ahmed from Money → People: 8,000 left, a payment a month")
    c = start("I want the fleet to earn 300k this month", "Company: Fleet earns 300,000")
    check("idle" in c.locator("[data-testid=mission-step]").inner_text(), "a company mission reads Fleet: the idle crane is today's step — " + c.locator("[data-testid=mission-step]").inner_text())
    check(page.locator("[data-testid=mission]").count() == 3, "three missions running")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close()
finish()
