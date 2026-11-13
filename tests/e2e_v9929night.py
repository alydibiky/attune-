"""v9.9.29 AI jobs at night while charging (Ali: "Do it"): the phone ran "every Sunday 9 pm plan my week" at 21:10 with Attune closed;
on the next open the answer is on Home (once, its numbers checked), the job's next time moves to next Sunday so the page doesn't run it
again, and the phone gets tonight's plan (the ready messages + "Made for you: …"). Automations → Jobs says it runs with Attune closed.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9929night.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 16, 7, 30, 0)   # Monday morning
past = int(datetime.datetime(2026, 11, 15, 21, 0).timestamp() * 1000)
TITLE = "every Sunday 9 pm plan my week"
JOBS = {"jobs": [{"id": "j1", "text": TITLE, "schedule": {"kind": "weekly", "days": [0], "dom": None, "at": {"h": 21, "m": 0}}, "next": past, "created": 1}], "results": []}
ANS = [{"key": "j1@%d" % past, "job": "j1", "title": TITLE, "at": past, "ranAt": past + 600000, "text": "This week: you spent 4200 so far. 14,000 left until salary.", "data": "Money this month: spent 4200, received 0 EGP"}]
INIT = ("try { localStorage.setItem('attune:start','home'); localStorage.setItem('attune:aijobs:v1', %s); } catch (e) {}\n"
        "window.__night = { sets: [], took: 0 }; (() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);"
        " N.aiNightSet = (j) => { window.__night.sets.push(JSON.parse(j)); }; N.aiNightTake = () => { window.__night.took++; return window.__night.took === 1 ? %s : '[]'; }; }; go(); })();") % (json.dumps(json.dumps(JOBS)), json.dumps(json.dumps(ANS)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.wait_for_selector("[data-testid=jobs-home]", timeout=10000)
    t = page.locator("[data-testid=jobs-home]").inner_text()
    check(TITLE in t and "4200" in t, "the night answer is on Home: " + t[:160])
    check("14,000" in page.locator("[data-testid=jobs-home-flag]").inner_text(), "its numbers are checked — 14,000 isn't in the data → flagged")
    s = page.evaluate("JSON.parse(localStorage.getItem('attune:aijobs:v1'))")
    nxt = s["jobs"][0]["next"]
    check(nxt > int(NOW.timestamp() * 1000) and datetime.datetime.fromtimestamp(nxt / 1000).weekday() == 6, "the job's next time is next Sunday (the page won't run it again): %s" % datetime.datetime.fromtimestamp(nxt / 1000))
    check(len(s["results"]) == 1 and s["results"][0].get("night"), "kept once, marked as made at night")
    sets = page.evaluate("window.__night.sets")
    last = sets[-1] if sets else {}
    runs = last.get("runs", [])
    check(len(runs) >= 1 and runs[0]["job"] == "j1" and runs[0]["at"] == nxt, "the phone got tonight's plan from the new time: %s" % [r.get("key") for r in runs])
    check(runs and runs[0]["head"] == "Made for you: " + TITLE and runs[0]["messages"][1]["content"] == TITLE and "Facts:" in runs[0]["messages"][0]["content"], "…with the ready messages and the notification title")
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); page.wait_for_timeout(300)
    check(len(page.evaluate("JSON.parse(localStorage.getItem('attune:aijobs:v1')).results")) == 1, "coming back to Attune again doesn't double it")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'automations'}}))"); page.wait_for_selector("[data-testid=jobs]", timeout=8000)
    check(page.locator("[data-testid=jobs-night]").count() == 1 and "charging" in page.locator("[data-testid=jobs-night]").inner_text(), "Jobs says it runs with Attune closed while charging")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
