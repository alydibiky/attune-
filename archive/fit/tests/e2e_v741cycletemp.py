"""v6.41 F4 Cycle from the watch: the night temperature (Health Connect, mocked) shows the rise after ovulation; the next period
is ovulation + her own luteal length, not the average.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741cycletemp.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
today = datetime.date.today()
D = lambda n: (today + datetime.timedelta(days=n)).isoformat()
starts = [-75, -46, -17]                       # cycles of 29 days; this one started 17 days ago
days = {}
for s in starts:
    for i in range(5): days[D(s + i)] = {"flow": "medium", **({"start": True} if i == 0 else {}), **({"end": True} if i == 4 else {})}
CYCLE = {"days": days, "settings": {"cycleLen": 28, "periodLen": 5}, "log": []}
nights = []
for k, s in enumerate(starts):
    ov = s + (15 if k < 2 else 13)              # past cycles: ovulation day 16 → 14 days before the next start; this one: day 14 = 4 days ago
    end = (starts[k + 1] if k + 1 < len(starts) else 0)
    for d in range(s, end + 1 if k == 2 else end):
        nights.append({"day": D(d), "t": 0.32 if d > ov else -0.08, "kind": "skin"})
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:cycle:v1'," + json.dumps(json.dumps(CYCLE)) + ")}catch(e){}"
        "(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__asked = 0;"
        "N.healthTempConnect = function () { window.__asked++; setTimeout(function () { window.dispatchEvent(new CustomEvent('attune-health-permission', { detail: { granted: 1 } })); }, 30); };"
        "N.healthTemps = function (id) { setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ available: 'ready', granted: window.__asked ? 1 : 0, nights: window.__asked ? " + json.dumps(nights) + " : [] })); }, 30); }; })();")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'cycle'}}))")
    page.wait_for_selector("[data-testid=cycle-temp]", timeout=5000)
    check(page.locator("[data-testid=cycle-temp-connect]").count() == 1, "no watch data yet → 'Use my watch's temperature'")
    page.click("[data-testid=cycle-temp-connect]")
    page.wait_for_selector("text=temperature rose", timeout=5000)
    line = page.locator("[data-testid=cycle-temp-line]").inner_text()
    exp = (today + datetime.timedelta(days=-4 + 14))
    check("0.4" in line and "own 14 days" in line, "the rise and her own 14 days after ovulation: " + line)
    check(str(exp.day) in line, "period expected ovulation + 14 = %s: %s" % (exp.isoformat(), line))
    check(page.evaluate("JSON.parse(localStorage.getItem('attune:cycle:temps:v1')).length") == len(nights), "the nights are kept on the phone")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
