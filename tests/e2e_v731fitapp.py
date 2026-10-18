"""v6.16c (Ali picked look A, «the diary app»): Fit & Food opens as its own app — Attune's top and bottom bars hidden, its own
bar Diary · Recipes · + · Progress · Me; the first open is a welcome → 3 questions → «Your plan is ready» (the daily calories);
+ opens Photo / Barcode / Say it / Search; Me holds the plan, workouts and settings; ← goes back to Attune.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v731fitapp.py [screenshot dir]
"""
import sys
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
shots = sys.argv[1] if len(sys.argv) > 1 else None
def snap(page, name):
    if shots: page.screenshot(path=f"{shots}/{name}.png")
def open_fit(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Fit & Food'), .rounded-t-2xl button:has-text('الأكل واللياقة')").first.click()
    page.wait_for_selector("[data-testid=fit-qs-welcome], [data-testid=fit-today]", timeout=6000)
with sync_playwright() as p:
    br = p.chromium.launch()
    for lang in ("en", "ar"):
        ctx, page = new_page(br, env, errors, extra_init=("localStorage.setItem('attune:ui:lang','ar');" if lang == "ar" else ""))
        page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
        open_fit(page)
        check(page.locator("[data-testid=fit-qs-welcome]").is_visible(), f"{lang}: the first open is a welcome, like any food app")
        snap(page, f"1-welcome-{lang}")
        page.locator("[data-testid=fit-qs-start]").click()
        page.locator("[data-testid=fit-qs-goal-lose]").click(); page.locator("[data-testid=fit-qs-next]").click()
        page.locator("[data-testid=fit-qs-age]").fill("30"); page.locator("[data-testid=fit-qs-cm]").fill("175"); page.locator("[data-testid=fit-qs-kg]").fill("85")
        page.locator("[data-testid=fit-qs-next]").click()
        page.locator("[data-testid=fit-qs-next]").click()
        page.wait_for_selector("[data-testid=fit-qs-plan]", timeout=4000)
        kcal = int(page.locator("[data-testid=fit-qs-kcal]").inner_text().replace(",", "") or 0)
        check(1200 <= kcal <= 3500, f"{lang}: «Your plan is ready» shows the daily calories ({kcal})")
        snap(page, f"2-plan-{lang}")
        page.locator("[data-testid=fit-qs-next]").click()
        page.wait_for_selector("[data-testid=fit-today]", timeout=4000)
        hidden = page.evaluate("() => { const navs = [...document.querySelectorAll('nav')]; return navs.filter(n => n.getBoundingClientRect().height > 0 && getComputedStyle(n).display !== 'none').map(n => n.dataset.testid || 'attune'); }")
        check(hidden == ["fit-nav"], f"{lang}: its own bottom bar only (Attune's is hidden): {hidden}")
        check(page.locator("header:visible").count() == 0, f"{lang}: Attune's top bar is hidden")
        check(page.locator("[data-testid=fit-nav] button").count() == 5, f"{lang}: Diary · Recipes · + · Progress · Me")
        check(page.locator("[data-testid=fit-today] [data-testid=fit-logbar]").count() == 0 and page.locator("[data-testid^=fit-meal-]").count() == 4, f"{lang}: the diary is calm — one card per meal, no button row")
        snap(page, f"3-diary-{lang}")
        page.locator("[data-testid=fit-add]").click()
        page.wait_for_selector("[data-testid=fit-log] [data-testid=fit-logbar]", timeout=3000)
        check(page.locator("[data-testid=fit-logbar] button").count() == 4, f"{lang}: + opens Photo, Barcode, Say it, Search")
        snap(page, f"4-add-{lang}")
        page.locator("[data-testid=fit-tab-me]").click()
        page.wait_for_selector("[data-testid=fit-me]", timeout=3000)
        check(page.locator("[data-testid=fit-me-kcal]").is_visible() and page.locator("[data-testid=fit-foodpack], [data-testid=fit-me] *").count() > 3, f"{lang}: Me holds the plan and the settings")
        snap(page, f"5-me-{lang}")
        page.locator("[data-testid=fit-me-move]").click(); page.wait_for_timeout(300)
        check(page.locator("[data-testid=fit-tab-me][aria-current=page]").count() == 1, f"{lang}: workouts open under Me")
        page.locator("[data-testid=fit-exit]").click(); page.wait_for_timeout(300)
        check(page.locator("[data-testid=fit-app]").count() == 0 and page.locator("nav:visible").count() >= 1, f"{lang}: ← returns to Attune with its bars back")
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: " + "; ".join(real_errors(errors))[:300])
env.close(); finish()
