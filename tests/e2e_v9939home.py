"""v9.9.39 UI-1 (Ali picked it: "organise the app interface in the best way possible"): Home = the box → Right now → To do → ONE thing
Attune noticed; What Attune knows, Your week, the feature cards, Set up and "Your day" live in My report (Set up is also the sidebar
strip); a new install still gets "Your day starts here" with examples; the sidebar's lonely "Learn & daily" heading is one "More"
group; a tip never hides the last card (the page grows by its height).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9939home.py
"""
import json, os, datetime, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "onemillion", "partC.py")).read()
exec(src[src.index("T = datetime.date"):src.index("DATA = sorted")])   # the 1M test's real-looking data (money, people & plans, reminders)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=SEED + "try{localStorage.setItem('attune:test:quiet','0')}catch(e){}")
    page.goto(env.url); page.wait_for_selector("[data-testid=home-ask]", timeout=15000); page.wait_for_timeout(1500)
    for t, what in (("home-box", "the box"), ("home-now", "Right now"), ("home-todo", "To do"), ("home-see-report", "one “My report” row")):
        check(page.locator("[data-testid=%s]" % t).count() >= 1, "Home has " + what)
    for t, what in (("home-hero", "the Money / Agents feature cards"), ("brain-home", "What Attune knows"), ("pro-week", "Your week with Attune"), ("setup-home", "the Set up card"), ("home-line", "Your day")):
        check(page.locator("[data-testid=%s]" % t).count() == 0, "Home no longer shows " + what)
    check(page.locator("[data-testid=home-see-all]").count() == 0 and page.locator("text=See all").count() <= 1, "one “See all” only")
    vis = page.evaluate("(() => { const h = document.querySelector('.home-one'); return h ? [...h.children].filter(c => c.offsetParent !== null).length : -1; })()")
    check(vis in (0, 1), "at most ONE thing Attune noticed is shown (%s)" % vis)
    tip = page.locator("[data-testid=coach-tip]")
    if tip.count():
        pad = page.evaluate("parseInt(getComputedStyle(document.body).paddingBottom) || 0")
        check(pad >= tip.bounding_box()["height"], "a tip makes room for itself — the last card can scroll out from under it (%dpx)" % pad)
    # My report keeps everything that left Home
    page.click("[data-testid=home-see-report]"); page.wait_for_timeout(700)
    check(page.locator("[data-testid=home-line]").count() == 1, "My report: Your day")
    check(page.locator("[data-testid=home-hero]").count() == 1, "My report: the Money / Agents cards")
    # the sidebar: one "More" group, no lonely heading
    page.reload(); page.wait_for_selector("[data-testid=home-menu]", timeout=15000); page.click("[data-testid=home-menu]"); page.wait_for_timeout(500)
    heads = page.locator("[data-testid=phone-side] [data-testid=side-group]").all_inner_texts()
    check(not any("learn" in h.lower() for h in heads) and any(h.strip().lower() == "more" for h in heads), "sidebar groups: %s" % heads)
    ctx.close()
    # a brand-new phone: still the hint with examples
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.goto(env.url); page.wait_for_selector("[data-testid=home-ask]", timeout=15000); page.wait_for_timeout(800)
    check(page.locator("[data-testid=home-empty], [data-testid=home-line-empty]").count() == 1, "a new install still shows “Your day starts here” with examples")
    # Arabic: the same order
    ctx.close()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=SEED + "try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}")
    page.goto(env.url); page.wait_for_selector("[data-testid=home-ask]", timeout=15000); page.wait_for_timeout(1200)
    check(page.locator("[data-testid=home-hero]").count() == 0 and page.locator("[data-testid=home-todo]").count() >= 1, "Arabic: the same calm Home")
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
