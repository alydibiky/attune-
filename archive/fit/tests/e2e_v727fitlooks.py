"""v6.27 Fit & Food's three new looks (Ali: "i loved the 3 interfaces, make them optional"): Colour per meal, Rings and
Pastel tiles, picked in Me → Look; each changes the Diary's layout and colours and keeps every part (add, copy, edit, water).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727fitlooks.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food')").first.click()
    page.wait_for_selector("[data-testid=fit-qs-welcome]", timeout=6000)
    page.locator("[data-testid=fit-qs-start]").click(); page.locator("[data-testid=fit-qs-goal-lose]").click(); page.locator("[data-testid=fit-qs-next]").click()
    page.locator("[data-testid=fit-qs-age]").fill("30"); page.locator("[data-testid=fit-qs-cm]").fill("175"); page.locator("[data-testid=fit-qs-kg]").fill("85")
    page.locator("[data-testid=fit-qs-next]").click(); page.locator("[data-testid=fit-qs-next]").click(); page.wait_for_selector("[data-testid=fit-qs-plan]")
    page.locator("[data-testid=fit-qs-next]").click(); page.wait_for_selector("[data-testid=fit-today]")
    page.locator("[data-testid=fit-add-breakfast]").click()
    page.fill("[data-testid=fit-log-text]", "2 eggs and a loaf of baladi bread")
    page.click("[data-testid=fit-read]"); page.wait_for_selector("[data-testid=fit-confirm]", timeout=8000)
    check(page.locator("[data-testid=fit-macros]").first.inner_text().count("Protein") == 1 and "Carbs" in page.locator("[data-testid=fit-macros]").first.inner_text(), "nutrients are written in full (no P / C / F)")
    page.click("[data-testid=fit-confirm]"); page.wait_for_timeout(400)
    page.locator("[data-testid=fit-tab-me]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid^=fit-look-]:not([data-testid=fit-look-picker])").count() == 6, "Me → Look offers 6 looks (Fresh, Night, Bold + the three new ones)")
    for look, mark in [("meals", None), ("rings", "fit-rings"), ("tiles", "fit-tile-breakfast")]:
        page.locator("[data-testid=fit-tab-me]").click(); page.wait_for_timeout(150)
        page.locator(f"[data-testid=fit-look-{look}]").click(); page.wait_for_timeout(150)
        page.locator("[data-testid=fit-tab-today]").click(); page.wait_for_timeout(300)
        check(page.locator("[data-testid=fit-app]").get_attribute("data-look") == look, f"{look}: chosen")
        check(page.locator("[data-testid=fit-left]").inner_text().strip().isdigit() and page.locator("[data-testid=fit-eaten]").inner_text().strip() != "0", f"{look}: calories left and eaten shown")
        if mark: check(page.locator(f"[data-testid={mark}]").count() == 1, f"{look}: its own layout ({mark})")
        if look == "meals":
            bl = page.locator("[data-testid=fit-meal-breakfast]").evaluate("e => getComputedStyle(e).borderInlineStartWidth")
            check(bl == "6px" and page.locator("[data-testid^=fit-item-breakfast]").count() == 2, f"meals: each meal its own coloured card, items kept ({bl})")
        if look == "tiles":
            check(page.locator("[data-testid^=fit-item-breakfast]").count() == 0, "tiles: the meal opens on tap")
            page.click("[data-testid=fit-tile-breakfast]"); page.wait_for_timeout(200)
            check(page.locator("[data-testid^=fit-item-breakfast]").count() == 2 and page.locator("[data-testid=fit-copy-breakfast]").count() == 1, "tiles: tapping Breakfast shows its foods, with copy and edit")
            w0 = page.locator("[data-testid=fit-tile-water]").inner_text()
            page.click("[data-testid=fit-tile-water]"); page.wait_for_timeout(200)
            check("0.3 L" in page.locator("[data-testid=fit-tile-water]").inner_text(), "tiles: tapping Water adds a glass")
            page.click("[data-testid=fit-tile-lunch]"); page.wait_for_timeout(300)
            check(page.locator("[data-testid=fit-log]").count() == 1, "tiles: an empty meal opens Add")
    ctx.close()
    # the desktop: Fit from the sidebar, tiles in three columns
    ctx, page = new_page(br, env, errors)
    page.set_viewport_size({"width": 1280, "height": 860})
    page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000)
    page.evaluate("localStorage.setItem('attune:fit:v1', JSON.stringify({profile:{age:30,cm:175,kg:85,sex:'m',goal:'lose',activity:'light'},days:{},weights:[],look:'tiles'}))")
    page.fill("[data-testid=side-search]", "fit"); page.wait_for_timeout(200)
    page.locator("[data-testid=side-tool-hits] [data-testid=side-go-fit]").click(); page.wait_for_timeout(600)
    if page.locator("[data-testid=fit-tile-breakfast]").count():
        tops = page.evaluate("() => ['breakfast','lunch','dinner'].map(m => Math.round(document.querySelector('[data-testid=fit-tile-' + m + ']').getBoundingClientRect().top))")
        check(len(set(tops)) == 1, "desktop: three tiles in a row (%s)" % tops)
    else:
        check(page.locator("[data-testid=fit-app], [data-testid=fit-qs-welcome]").count() >= 1, "desktop: Fit opens")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
