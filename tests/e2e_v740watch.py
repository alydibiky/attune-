"""v6.40 Message alerts (Ali: "if X sends me a message tell me — Gmail or any email notification"): typed on Home → a rule,
handed to the phone (watchSave, checked by MessageWatch.kt); listed in Follow-ups → Reminders with on/off; Arabic too;
without Notification access the card says how to turn it on.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740watch.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = """try{localStorage.setItem('attune:start','home')}catch(e){}
(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__watch = [];
  N.watchSave = function (j) { window.__watch.push(JSON.parse(j)); }; N.watchRules = function () { return '[]'; };
  N.watchHits = function () { return JSON.stringify([{ rule: 'x', who: 'Ahmed', app: 'WhatsApp', text: 'ana gay', ts: Date.now() }]); };
  N.payAccess = function () { return false; }; N.openPayAccess = function () { window.__opened = 1; }; })();"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.fill("[data-testid=home-ask]", "tell me when Ahmed messages me on WhatsApp"); page.click("[data-testid=home-send]")
    page.wait_for_timeout(800)
    body = page.locator("[data-testid=phone-home]").inner_text()
    check("I'll tell you the moment it comes" in body and "Ahmed" in body and "Notification access" in body, "Home: the alert is set, and it says to turn on Notification access")
    sent = page.evaluate("window.__watch")
    check(len(sent) >= 1 and sent[-1]["rules"][0]["who"] == ["Ahmed"] and sent[-1]["rules"][0]["app"] == "whatsapp", "the rule is handed to the phone: %s" % (sent[-1]["rules"][0] if sent else None))
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'reminders'}}))")
    page.wait_for_selector("[data-testid=watch-panel]", timeout=6000)
    check(page.locator("[data-testid=watch-rule]").count() == 1 and "WhatsApp" in page.locator("[data-testid=watch-rule]").inner_text(), "Follow-ups lists it")
    check(page.locator("[data-testid=watch-access]").count() == 1, "the card says how to turn on Notification access")
    page.click("[data-testid=watch-access]"); check(page.evaluate("window.__opened") == 1, "…and opens it")
    page.fill("[data-testid=watch-input]", "لو جالي إيميل من البنك الأهلي قولي"); page.click("[data-testid=watch-add]"); page.wait_for_timeout(300)
    rows = page.locator("[data-testid=watch-rule]").all_inner_texts()
    check(len(rows) == 2 and "البنك الأهلي" in rows[0] and "email" in rows[0], "an Arabic one: %s" % rows)
    page.locator("[data-testid=watch-on]").nth(1).uncheck(); page.wait_for_timeout(200)
    last = page.evaluate("window.__watch[window.__watch.length - 1].rules")
    check(last[1]["on"] is False and last[0]["on"] is True, "turning one off reaches the phone")
    check("Ahmed" in page.locator("[data-testid=watch-hits]").inner_text(), "the last alerts are shown")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
