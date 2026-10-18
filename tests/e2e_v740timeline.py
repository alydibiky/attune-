"""v6.38 (upgrade M3) — Follow-ups → Timeline: reminders, dates, payments, debts and chat promises on one list by day,
each with what slips if you skip it; a tap opens the page it belongs to.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740timeline.py
"""
import json, datetime, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today(); iso = lambda n: (T + datetime.timedelta(days=n)).isoformat()
ms = lambda n: int(time.mktime((T + datetime.timedelta(days=n)).timetuple()) * 1000) + 43200000
RADAR = {"items": [{"id": "d1", "kind": "trial", "title": "Shahid VIP", "date": iso(2), "amount": 99, "currency": "EGP", "status": "active", "source": "typed", "created": ms(-1)}], "seen": []}
REM = [{"id": "r1", "at": ms(1), "title": "Call the bank", "repeat": "none", "created": ms(-1)}]
XR = [{"id": "x1", "name": "Ahmed", "me": "Ali", "at": ms(0), "ledger": [], "unanswered": [], "stats": {}, "items": [{"type": "promise", "from": "Ahmed", "t": ms(-5), "amount": 2000, "due": iso(-1), "what": "الباقي بكرة"}]}]
SET = lambda k, v: "localStorage.setItem(%s, %s);" % (json.dumps(k), json.dumps(json.dumps(v)))
INIT = "try{" + SET("attune:radar:v1", RADAR) + SET("attune:reminders:v1", REM) + SET("attune:xray:v1", XR) + "}catch(e){}"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'reminders'}}))")
    page.wait_for_selector("[data-testid=hub-part-timeline]", timeout=8000)
    page.click("[data-testid=hub-part-timeline]")
    page.wait_for_selector("[data-testid=timeline-page]", timeout=6000)
    items = page.locator("[data-testid=timeline-item]").all_inner_texts()
    check(len(items) == 3, "three things on one list: %s" % [i.replace("\n", " · ")[:60] for i in items])
    check("Ahmed" in items[0] and "promised" in items[0], "the late promise comes first, with what slips")
    check("Call the bank" in items[1] and "Shahid VIP" in items[2] and "paid plan" in items[2] and "99" in items[2], "then tomorrow's reminder, then the trial: 'turns into a paid plan: EGP 99'")
    check("1 late" in page.locator("[data-testid=timeline-sum]").inner_text(), "the summary counts what is late")
    page.locator("[data-testid=timeline-item]").nth(2).click()
    page.wait_for_selector("[data-testid=radar-page]", timeout=6000)
    check(True, "a tap opens the page it belongs to (Dates)")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
