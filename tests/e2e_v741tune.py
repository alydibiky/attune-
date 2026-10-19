"""v6.41 (X2) the engine tuner: Engine → Tune for this phone times the model with 3, 4 and 5 threads and keeps the fastest —
or a cooler one that is within 5% of it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741tune.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = ("(function w(){ var N = window.AttuneNative; if (!N || !window.__mock) return setTimeout(w, 0); var M = window.__mock; M.tuned = { gen: 0, batch: 0 }; M.tuneCalls = [];"
        "var SPEED = { 3: 13.1, 4: 13.5, 5: 11.0 };"
        "N.engineTuned = function () { return JSON.stringify({ model: 'm', gen: M.tuned.gen, batch: M.tuned.batch, cores: 8, bigCores: 4, hot: false }); };"
        "N.engineTune = function (j) { var a = JSON.parse(j); M.tuned = a; M.tuneCalls.push(a); M.fakeTps = SPEED[a.gen] || 9; M.fake = 'one, two, three'; };"
        "})();")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.wait_for_selector("[data-testid=engine-tune]", timeout=5000)
    page.click("[data-testid=engine-tune]")
    page.wait_for_selector("[data-testid=engine-tuned]", timeout=30000)
    calls = page.evaluate("window.__mock.tuneCalls")
    check([c["gen"] for c in calls[:3]] == [3, 4, 5], "timed with 3, 4 and 5 threads: %s" % calls)
    check(calls[-1]["gen"] == 3, "keeps 3 threads: 4 is only 3%% faster, and 3 is cooler (%s)" % calls[-1])
    check("3 threads" in page.locator("[data-testid=engine-tuned]").inner_text() and "13.1" in page.locator("[data-testid=engine-tuned]").inner_text(), "says what it kept: " + page.locator("[data-testid=engine-tuned]").inner_text())
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
