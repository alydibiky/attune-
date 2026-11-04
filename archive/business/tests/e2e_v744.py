"""v6.44 — Fleet & rentals on Home's Today line: the cranes working today and what needs you there (an overdue cheque…);
tapping a Fleet line opens Business → Fleet & rentals.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v744.py
"""
import json, subprocess, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
HERE = os.path.dirname(os.path.abspath(__file__))
# the demo Fleet (2 cranes on jobs, a cheque overdue) built by the app's own code, dated today
DEMO = subprocess.check_output(["node", "--input-type=module", "-e",
  "import { heal, loadDemo } from '%s/../web-src/fleet.js'; process.stdout.write(JSON.stringify(loadDemo(heal({}))))" % HERE]).decode()
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    check(page.locator("[data-testid=home-line-fleet]").count() == 0, "no Fleet yet — no Fleet line")
    page.evaluate("""(s) => new Promise((ok) => { const r = indexedDB.open('attune-fleet', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(JSON.parse(s), 'state'); t.oncomplete = () => { r.result.close(); ok(); }; }; })""", DEMO)
    page.reload(); page.wait_for_selector("[data-testid=home-line-fleet]", timeout=8000)
    txt = " | ".join(page.locator("[data-testid=home-line-fleet]").all_inner_texts())
    check("2 cranes working" in txt and "Cheque overdue" in txt and "40,000" in txt, "Today: the cranes working and the overdue cheque — " + txt.replace("\n", " ")[:160])
    page.locator("[data-testid=home-line-fleet]").first.click()
    page.wait_for_timeout(1200)
    check(page.locator("[data-testid=phone-home]").count() == 0 and "LTM 1100" in page.inner_text("body"), "tapping it opens Fleet & rentals (the cranes are there)")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
