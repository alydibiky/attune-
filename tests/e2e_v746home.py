"""v6.46 Home option A (Ali picked it): RIGHT NOW (Fleet's overdue cheque, with It cleared / Bounced — done right there), the
four numbers, YOUR DAY, "Attune noticed" (the free crane), and Chat's tools on Home (Chat, Call, Translate, Your life, Remember).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v746home.py
"""
import json, subprocess, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = subprocess.check_output(["node", "--input-type=module", "-e",
  "import { heal, loadDemo } from '%s/../web-src/fleet.js'; process.stdout.write(JSON.stringify(loadDemo(heal({}))))" % HERE]).decode()
READ = """() => new Promise((ok) => { const r = indexedDB.open('attune-fleet', 1); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('state'); q.onsuccess = () => ok(q.result); }; })"""
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    for lang in ["en", "ar"]:
        init = "try{localStorage.setItem('attune:start','home')" + (";localStorage.setItem('attune:ui:lang','ar')" if lang == "ar" else "") + "}catch(e){}" + (";window.__trMiss=new Set()" if lang == "ar" else "")
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init)
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
        check(page.locator("[data-testid=home-chat-tools] button").count() >= 4, "Chat's tools on Home: Chat · Call · Translate · Your life · Remember")
        page.evaluate("""(s) => new Promise((ok) => { const r = indexedDB.open('attune-fleet', 1);
          r.onupgradeneeded = () => r.result.createObjectStore('kv');
          r.onsuccess = () => { const t = r.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(JSON.parse(s), 'state'); t.oncomplete = () => { r.result.close(); ok(); }; }; })""", DEMO)
        page.reload(); page.wait_for_selector("[data-testid=home-now]", timeout=8000)
        if lang == "en":
            now = page.inner_text("[data-testid=home-now]")
            check(page.get_attribute("[data-testid=home-now]", "data-kind") == "chequeOverdue" and "100245" in now and "40,000" in now, "RIGHT NOW: the overdue cheque 100245 (40,000) — " + now.replace("\n", " ")[:120])
            check(page.locator("[data-testid=home-num-cranes]").count() == 1 and "2 / 3" in page.inner_text("[data-testid=home-num-cranes]"), "the numbers: 2 / 3 cranes out")
            check(page.locator("[data-testid=home-line-fleet]").count() >= 1 and "Your day" in page.inner_text("[data-testid=home-line]"), "YOUR DAY: the Fleet lines")
            check(page.get_attribute("[data-testid=home-noticed]", "data-k") == "crane" and "free" in page.inner_text("[data-testid=home-noticed]"), "Attune noticed: the free crane")
            page.click("[data-testid=home-now-cleared]"); page.wait_for_timeout(600)
            st = page.evaluate(READ)
            check(next(q for q in st["cheques"] if q.get("no") == "100245")["status"] == "cleared", "It cleared → saved in Fleet at once")
            check(page.locator("[data-testid=home-now]").count() == 0 or "100245" not in page.inner_text("[data-testid=home-now]"), "…and RIGHT NOW moves on")
            page.click("[data-testid=home-t-translate]"); page.wait_for_timeout(500)
            check(page.locator("[data-testid=phone-home]").count() == 0, "Translate opens from Home")
        else:
            miss = [m for m in page.evaluate("[...window.__trMiss]") if not m.startswith("[DEMO]") and m != "Attune"]
            check(not miss, "Arabic: Home has no English left: %s" % miss[:8])
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
