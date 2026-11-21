"""v10.8 — Ali's phone, 21 Nov 2026 ("Left sidebar" screenshot): the phone's side menu showed see-through over Home — its rows floated
over Home's cards with no background. The slide-in kept a transform on the menu's wrapper, and a fixed panel inside a transformed box
measures itself against that box (0 px tall). Checked at a phone, a phone in Arabic (right to left) and a foldable's cover screen:
the menu is as tall as the screen, has its own background, and what is under a finger inside it is the menu, not Home.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1080side.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    for name, w, lang in (("phone", 390, "en"), ("phone · Arabic", 390, "ar"), ("fold cover", 344, "en")):
        init = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));localStorage.setItem('attune:ui:lang','%s')}catch(e){}" % lang
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init)
        page.set_viewport_size({"width": w, "height": 820}); page.goto(env.url); page.wait_for_timeout(1600)
        page.locator("[data-testid=home-menu]").first.click()
        page.wait_for_timeout(700)
        side = page.locator("[data-testid=side]")
        check(side.count() == 1, name + ": the side menu opens")
        if not side.count(): ctx.close(); continue
        r = side.first.bounding_box()
        check(r and r["height"] >= 800, name + ": the menu is as tall as the screen (%s px)" % (r and int(r["height"])))
        bg = side.first.evaluate("e => getComputedStyle(e).backgroundColor")
        check(bg and "0)" not in bg.replace(" ", "")[-3:] and bg != "transparent", name + ": the menu has its own background (" + bg + ")")
        x = int(r["x"] + r["width"] / 2); ys = [int(r["y"] + r["height"] * f) for f in (0.35, 0.6, 0.85)]
        inside = [page.evaluate("([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('[data-testid=side]')); }", [x, y]) for y in ys]
        check(all(inside), name + ": under a finger inside the menu is the menu, never Home (%s)" % inside)
        tf = side.first.evaluate("e => getComputedStyle(e.parentElement).transform")
        check(tf == "none", name + ": nothing left transformed around the menu after it slid in (" + tf + ")")
        page.locator("[data-testid=side-close]").first.click(); page.wait_for_timeout(400)
        check(page.locator("[data-testid=side]").count() == 0, name + ": it closes")
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
