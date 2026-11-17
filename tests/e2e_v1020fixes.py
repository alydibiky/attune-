"""v10.2 — Ali's 17 Nov computer list, on the real pages: the Home card's "N tools" = what the Tools page lists (it said 36 and
showed 3); the tip follows the theme and sits in the page's corner on a computer (it was a brown card across the whole window);
while a model loads the side menu says "Loading…" without redrawing the whole app every second.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1020fixes.py
"""
import re
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
QUIET = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));}catch(e){};"
with sync_playwright() as p:
    br = p.chromium.launch()
    # 1. Tools: the count on Home = the tools listed
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=QUIET, desktop=(1500, 900))
    page.goto(env.url); page.wait_for_selector("[data-testid=home-all-tools]", timeout=15000)
    n = int(re.search(r"(\d+)", page.inner_text("[data-testid=home-all-tools]")).group(1))
    page.click("[data-testid=home-all-tools]"); page.wait_for_selector("[data-testid=tools-every]", timeout=8000)
    listed = page.evaluate("[...document.querySelectorAll('[data-testid=tools-group] [data-testid^=tools-open-]')].map(e => e.dataset.testid)")
    check(n == len(listed) and n > 10, "Home says %d tools and the Tools page lists %d (it showed 3)" % (n, len(listed)))
    check(len(set(listed)) == len(listed), "each tool once")
    page.fill("[data-testid=tools-find]", "medicines"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=tools-open-care]").count() >= 1, "searching finds Family health")
    ctx.close()
    # 2. the tip: theme colours, the page's corner on a computer, above the bar on a phone
    for size, wide in (((1500, 900), True), (None, False)):
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=size, extra_init="try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:test:quiet','0');localStorage.removeItem('attune:coach:v1');}catch(e){};")
        page.goto(env.url); page.wait_for_selector("[data-testid=coach-tip]", timeout=15000)
        r = page.evaluate("""() => { const t = document.querySelector('[data-testid=coach-tip]'), b = t.getBoundingClientRect(), cs = getComputedStyle(t);
          const side = document.querySelector('[data-testid=side-setup-strip]'); const sb = side ? side.closest('aside, nav') : null;
          return { left: b.left, right: b.right, w: b.width, vw: innerWidth, bg: cs.backgroundColor, sideRight: sb ? sb.getBoundingClientRect().right : 0,
                   surf: getComputedStyle(document.documentElement).getPropertyValue('--c-surf').trim() }; }""")
        check(r["bg"] not in ("rgb(42, 37, 38)",), "%s: the tip uses the theme, not the old brown card (%s)" % ("computer" if wide else "phone", r["bg"]))
        if wide: check(r["right"] > r["vw"] - 60 and r["w"] <= 380 and r["left"] > r["sideRight"], "computer: a small card in the page's corner, not over the side menu: %s" % r)
        else: check(r["left"] >= 0 and r["right"] <= r["vw"], "phone: inside the screen")
        ctx.close()
    # 3. a model loading: the side menu says Loading… (no counter that redraws the app every second)
    ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(1500, 900), extra_init=QUIET + """
      (() => { const t0 = Date.now(); const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
        N.engine = () => JSON.stringify({ state: 'starting', modelId: 'zenith', phase: 'Reading the model file', loadingFor: Math.round((Date.now() - t0) / 1000) }); }; go(); })();""")
    page.goto(env.url); page.wait_for_timeout(2500)
    a = page.inner_text("body"); page.wait_for_timeout(2200); b = page.inner_text("body")
    check("Loading…" in a and not re.search(r"Loading \d+s", a + b), "the side menu says “Loading…” (no “Loading 66s” ticking)")
    check(a == b, "nothing on the page changes while it loads — the app is not redrawn every second")
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    ctx.close(); br.close()
env.close(); finish()
