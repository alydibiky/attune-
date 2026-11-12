"""v9.9.25 B8 AU4 scheduled AI jobs (Ali picked A: Automations → Jobs + the result on Home in the morning). A job is added in words
("every Sunday 9 pm plan my week" → next Sun 21:00; no time said → it asks when); a job whose time passed runs when the model is ready —
its answer waits on Home ("Made for you"), and a number that isn't in the person's data (14,000) is flagged; OK hides it; the job's next
run moves on a week.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9925jobs.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 15, 22, 0, 0)   # Sunday, after 21:00
past = int(datetime.datetime(2026, 11, 15, 21, 0).timestamp() * 1000)
JOBS = {"jobs": [{"id": "j1", "text": "every Sunday 9 pm plan my week", "schedule": {"kind": "weekly", "days": [0], "dom": None, "at": {"h": 21, "m": 0}}, "next": past, "created": 1}], "results": []}
L = {"currency": "EGP", "accounts": [{"id": "a", "name": "Cash", "currency": "EGP"}], "txns": [{"id": "t1", "type": "expense", "amount": 4200, "date": "2026-11-10", "note": "groceries", "account": "a"}], "recurring": []}
INIT = ("try { localStorage.setItem('attune:start','home'); localStorage.setItem('attune:aijobs:v1', %s); localStorage.setItem('ledger.v3', %s); } catch (e) {}\n"
        "(() => { const go = () => { if (!window.__mock) return setTimeout(go, 5); window.__mock.fakeQueue = ['This week: you spent 4200 so far. 3 big things. 14,000 left until salary.'];"
        " window.__mock.engine = { ...window.__mock.engine, state: 'ready', modelId: 'test-model' }; window.dispatchEvent(new CustomEvent('attune-engine', { detail: { ...window.__mock.engine } })); }; go(); })();") % (json.dumps(json.dumps(JOBS)), json.dumps(json.dumps(L)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.wait_for_selector("[data-testid=jobs-home]", timeout=20000)
    t = page.locator("[data-testid=jobs-home]").inner_text()
    check("plan my week" in t and "4200" in t, "the job ran — its answer waits on Home: " + t.replace("\n", " | ")[:160])
    check("14,000" in page.locator("[data-testid=jobs-home-flag]").inner_text(), "14,000 isn't in the data → flagged")
    j = page.evaluate("JSON.parse(localStorage.getItem('attune:aijobs:v1')).jobs[0]")
    check(j["next"] > past + 6 * 86400000, "the next run moved on a week")
    page.click("[data-testid=jobs-home-ok]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=jobs-home]").count() == 0, "OK hides it")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'automations'}}))"); page.wait_for_selector("[data-testid=jobs]", timeout=8000)
    page.fill("[data-testid=jobs-text]", "summarise my messages please"); page.click("[data-testid=jobs-add]"); page.wait_for_timeout(100)
    check(page.locator("[data-testid=jobs-err]").count() == 1, "no time said → it asks when")
    page.fill("[data-testid=jobs-text]", "on the 25th tell me what's left until salary"); page.click("[data-testid=jobs-add]"); page.wait_for_timeout(200)
    rows = page.locator("[data-testid=jobs-row]").all_inner_texts()
    check(len(rows) == 2 and "25" in rows[1], "added: on the 25th — next shown: %s" % [r.replace("\n", " ") for r in rows])
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
