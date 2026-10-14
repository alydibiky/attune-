"""v6.28 device levels (ROADMAP §2): a 4 GB phone is level 1 — the All list leaves Studio out, effects are lighter, Settings says
what the phone can do, and "Show every tool anyway" brings Studio back. The usual test phone (12 GB) keeps everything.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v731device.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
LIGHT = r"""try{localStorage.setItem('attune:start','home')}catch(e){}
(() => { const patch = (n) => { if (!n || n.__light) return n; const info = n.info; n.info = () => { const j = JSON.parse(info()); return JSON.stringify({ ...j, ramGB: 4, totalRamBytes: 4e9, cores: 8, bigCores: 2 }); }; n.__light = true; return n; };
  if (window.AttuneNative) patch(window.AttuneNative);
  else { let v; Object.defineProperty(window, "AttuneNative", { configurable: true, get: () => v, set: (x) => { v = patch(x); } }); } })();"""
def tools(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    return page.evaluate("[...document.querySelectorAll('[data-testid=more-group] button')].map(b => b.innerText.split('\\n')[0])")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=LIGHT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    t = tools(page)
    check("Studio" not in t and "Code" in t and len(t) > 30, "4 GB phone: Studio is not listed, the rest is (%d tools)" % len(t))
    d = page.locator("[data-testid=device-level]").inner_text()
    check("Level 1" in d and "Light" in d and "no Studio" in d, "Settings says what this phone can do: " + d.replace("\n", " "))
    check(page.evaluate("document.documentElement.classList.contains('att-lite')"), "lighter effects on a light phone")
    page.click("[data-testid=device-showall]"); page.wait_for_timeout(200)
    check(page.evaluate("[...document.querySelectorAll('[data-testid=more-group] button')].some(b => b.innerText.startsWith('Studio'))"), "“Show every tool anyway” brings Studio back")
    page.reload(); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    check("Studio" in tools(page), "…and it stays after a restart")
    ctx.close()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    t = tools(page)
    check("Studio" in t and page.locator("[data-testid=device-showall]").count() == 0, "12 GB phone: everything listed, nothing to show")
    check("Level 4" in page.locator("[data-testid=device-level]").inner_text() and not page.evaluate("document.documentElement.classList.contains('att-lite')"), "12 GB phone: level 4, full effects")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
