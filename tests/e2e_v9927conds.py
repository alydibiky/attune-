"""v9.9.27 rules with a condition, checked on the phone: "when my salary arrives on workdays, put 20% in savings" and "when Karim messages
me after 10 pm, tell me" are switched ON with the phone part (no "Waiting for the phone part"), and reach the phone WITH their conditions
(weekdays / after 22:00) and the country's weekend. Without the phone part they still wait (never fired without their check).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9927conds.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
DIR = {"items": [{"id": "p1", "kind": "person", "name": "Karim", "aka": ["كريم"]}], "skip": []}
BOX = "textarea[placeholder='Message Attune']"
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:people:v1',%s)}catch(e){}\n"
        "window.__auto = []; window.__watch = []; (() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);"
        " N.phoneRulesSave = () => {}; N.autoSave = (j) => { window.__auto.push(JSON.parse(j)); }; N.watchSave = (j) => { window.__watch.push(JSON.parse(j)); }; }; go(); })();") % json.dumps(json.dumps(DIR))
def chat(page): page.evaluate("() => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_selector(BOX, timeout=8000); page.wait_for_timeout(300)
def say(page, t): page.locator(BOX).fill(t); page.locator("button[title='Send']").first.click(); page.wait_for_timeout(1200)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    chat(page); say(page, "when my salary arrives on workdays, put 20% in savings")
    page.wait_for_timeout(500)
    while page.locator("[data-testid=rule-ask]").count():   # (it may ask which fund first — the first choice)
        page.locator("[data-testid=rule-ask-choice]").first.click(); page.wait_for_timeout(300)
    page.wait_for_selector("[data-testid=rule-card]", timeout=8000)
    check(page.locator("[data-testid=rule-needs-phone]").count() == 0, "the salary rule with 'on workdays' is on (checked on the phone now)")
    page.click("[data-testid=rule-save]"); page.wait_for_timeout(400)
    a = page.evaluate("window.__auto[window.__auto.length - 1]")
    r = (a or {}).get("rules", [{}])[-1]
    check(any(x.get("type") == "weekdays" for x in r.get("ifs", [])) and r.get("weekend") and r.get("pct") == 20 and r.get("pot") != "new", "it reaches the phone with its condition and the weekend: %s" % json.dumps(r)[:220])
    chat(page); say(page, "when Karim messages me after 10 pm, tell me"); page.wait_for_selector("[data-testid=rule-card]", timeout=8000)
    check(page.locator("[data-testid=rule-needs-phone]").count() == 0, "the message rule with 'after 10 pm' is on")
    page.click("[data-testid=rule-save]"); page.wait_for_timeout(400)
    w = page.evaluate("window.__watch[window.__watch.length - 1]")
    wr = (w or {}).get("rules", [{}])[0]
    check(any(x.get("type") == "after" and x.get("at", {}).get("h") == 22 for x in wr.get("ifs", [])), "…and reaches the phone with 'after 22:00': %s" % json.dumps(wr)[:200])
    rows = page.evaluate("JSON.parse(localStorage.getItem('attune:rules:v1') || '[]').map(r => r.live)")
    check(rows == [True, True], "both rules are on: %s" % rows)
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
