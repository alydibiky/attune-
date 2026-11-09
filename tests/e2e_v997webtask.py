"""v9.9.7 W1 "Do it on the web" (Ali OK'd: you say the task; Attune opens the site in its own browser, fills your saved details
+ the day / time / people, stops for your login and ALWAYS before paying).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v997webtask.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = """try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:agent:profile', JSON.stringify({name:'Ali', phone:'01000000000'}))}catch(e){}
(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.agentOpen = (id, arg) => { window.__agentOpen = JSON.parse(arg); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({filled: 3, payment: true})), 50); }; } w(); })();"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1500)
    page.fill("[data-testid=home-ask]", "book a padel court Friday 8pm near me"); page.click("[data-testid=home-send]")
    page.wait_for_selector("[data-testid=webtask]", timeout=5000)
    st = lambda: page.evaluate("[...document.querySelectorAll('[data-testid=webtask-step]')].map(e => e.dataset.k + ':' + e.dataset.state)")
    s = st(); txt = page.inner_text("[data-testid=webtask]")
    check(s == ["understood:done", "find:wait", "fill:wait", "pay:wait"], "the sheet shows the plan, nothing done yet but understanding: %s" % s)
    check("padel court" in txt and "20:00" in txt and "near me" in txt, "…understood: padel court · Friday · 20:00 · near me")
    check("you press Pay" in txt, "…and says up front it stops before paying")
    page.click("[data-testid=webtask-start]"); page.wait_for_timeout(500)
    ao = page.evaluate("window.__agentOpen") or {}
    check(ao.get("fillAuto") is True and ao.get("profile", {}).get("taskTime") == "20:00" and ao.get("profile", {}).get("name") == "Ali" and bool(ao.get("profile", {}).get("taskDate")),
          "Start → Attune's browser opens with fillAuto, the saved details and the task's day + 20:00 (%s)" % ao.get("profile"))
    check("google.com/search" in ao.get("url", "") and "padel" in ao.get("url", ""), "…on a web search for it (you pick the right site)")
    s = st(); txt = page.inner_text("[data-testid=webtask]")
    check(s == ["understood:done", "find:done", "fill:done", "pay:you"], "after the browser: found ✓, filled ✓, pay = your turn: %s" % s)
    check("Filled 3 fields" in txt and "press Pay yourself" in txt, "…“Filled 3 fields — check them” and “press Pay yourself”")
    page.click("[data-testid=webtask-close]")
    page.fill("[data-testid=home-ask]", "book a hotel in Dahab next weekend"); page.click("[data-testid=home-send]"); page.wait_for_timeout(600)
    check(page.locator("[data-testid=webtask]").count() == 0, "hotels stay with Agents (no web-task sheet)")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
