"""v6.42 (Ali: "put [the metro] in the tab next to maps"): Cairo Metro is a Daily tab right after Maps, and a chip on the map.
From / To → line, direction, stops, change, minutes, ticket — offline.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v742metrotab.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = "try{localStorage.setItem('attune:start','home')}catch(e){}"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'scout'}}))")
    page.wait_for_timeout(500)
    tabs = page.evaluate("[...document.querySelectorAll('[data-testid=hub-tabs] [role=tab]')].map(b => b.dataset.testid.slice(8))")
    check("metro" in tabs and tabs.index("metro") == tabs.index("map") + 1, "the Daily tab row has Metro right after Maps: %s" % tabs)
    page.click("[data-testid=hub-tab-metro]")
    page.wait_for_selector("[data-testid=metro-page]", timeout=5000)
    page.fill("[data-testid=metro-from]", "Maadi")
    page.fill("[data-testid=metro-to]", "Cairo University")
    page.wait_for_selector("[data-testid=metro-route]", timeout=3000)
    legs = page.locator("[data-testid=metro-leg]")
    t = page.inner_text("[data-testid=metro-route]")
    check(legs.count() == 2 and "Line 1" in t and "Line 2" in t and "Sadat" in t, "Maadi → Cairo University: Line 1, change at Sadat, Line 2 (%s)" % t.replace("\n", " | ")[:200])
    check(page.inner_text("[data-testid=metro-fare]").strip() in ("10", "15"), "the ticket is shown")
    page.click("[data-testid=metro-swap]")
    check(page.input_value("[data-testid=metro-from]") == "Cairo University", "swap")
    page.fill("[data-testid=metro-from]", "ramses")
    check("Al-Shohadaa" in page.inner_text("[data-testid=metro-page]"), "an old name (Ramses) → Al-Shohadaa")
    page.fill("[data-testid=metro-to]", "")
    page.click("[data-testid=metro-from]")
    page.click("[data-testid=metro-line-3]")
    page.locator("[data-testid=metro-station]").first.click()
    page.wait_for_timeout(200)
    check(page.input_value("[data-testid=metro-from]") == "Adly Mansour", "a tapped station fills From (%s)" % page.input_value("[data-testid=metro-from]"))
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
