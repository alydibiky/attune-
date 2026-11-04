"""v6.32 — Fit & Food minimal (Ali picked B, "with the colour and text contrast so it's more visible"): no bottom bar — thin tabs
on top and one "Log food" button; the Diary without the fibre bar, suggestions as one line, water / move / fasting as small
buttons; Progress shows the weight first and the rest under "More"; secondary text about 7:1. Runs without the old bar.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736fitmin.py [screenshot dir]
"""
import sys
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
shots = sys.argv[1] if len(sys.argv) > 1 else None
def snap(page, name):
    if shots: page.screenshot(path=f"{shots}/{name}.png")
def lum(c):
    v = [int(x) / 255 for x in c[c.index("(") + 1:c.index(")")].split(",")[:3]]
    v = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in v]
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
with sync_playwright() as p:
    br = p.chromium.launch()
    for lang in ("en", "ar"):
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}" + ("localStorage.setItem('attune:ui:lang','ar');" if lang == "ar" else ""))
        page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
        page.click("[data-testid=home-menu]"); page.click("[data-testid=phone-side] [data-testid=side-go-health]")
        page.click("[data-testid=fit-today-setup], [data-testid=fit-today-card]")
        page.wait_for_selector("[data-testid=fit-qs-welcome]", timeout=6000)
        page.locator("[data-testid=fit-qs-start]").click()
        page.locator("[data-testid=fit-qs-goal-lose]").click(); page.locator("[data-testid=fit-qs-next]").click()
        page.locator("[data-testid=fit-qs-age]").fill("30"); page.locator("[data-testid=fit-qs-cm]").fill("175"); page.locator("[data-testid=fit-qs-kg]").fill("85")
        page.locator("[data-testid=fit-qs-next]").click(); page.locator("[data-testid=fit-qs-next]").click()
        page.wait_for_selector("[data-testid=fit-qs-plan]"); page.locator("[data-testid=fit-qs-next]").click()
        page.wait_for_selector("[data-testid=fit-today]")
        # v6.43: Ali picked design A — its own bottom bar (Diary · Recipes · Fasting · Progress · Me) and a round + above it;
        # water and the watch are two small cards on the Diary, fasting has its own tab
        nav = page.locator("[data-testid=fit-nav]")
        check(nav.locator("button").count() == 5 and nav.is_visible(), f"{lang}: Diary · Recipes · Fasting · Progress · Me at the bottom")
        check(page.locator("[data-testid=fit-add]").is_visible(), f"{lang}: one round + to log food")
        check(page.locator("[data-testid=fit-water]").count() == 1 and page.locator("[data-testid=fit-exercise]").count() == 1, f"{lang}: water and the watch side by side")
        page.click("[data-testid=fit-tab-fast]"); page.wait_for_selector("[data-testid=fit-fast-tab]", timeout=3000)
        check(page.locator("[data-testid=fit-fast-16]").count() == 1, f"{lang}: Fasting is its own tab with the plans")
        page.click("[data-testid=fit-tab-today]"); page.wait_for_selector("[data-testid=fit-today]")
        body = page.inner_text("[data-testid=fit-today]")
        check(("Fibre" if lang == "en" else "ألياف") not in body, f"{lang}: no fibre bar in the Diary")
        sug = page.locator("[data-testid^=fit-suggest-]").first
        if sug.count():
            col = sug.evaluate("e => getComputedStyle(e).color"); bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
            a, b = lum(col), lum(bg); ratio = (max(a, b) + 0.05) / (min(a, b) + 0.05)
            check(ratio >= 7, f"{lang}: grey text is easy to read ({ratio:.1f}:1)")
        snap(page, f"fit-diary-{lang}")
        page.click("[data-testid=fit-tab-progress]"); page.wait_for_selector("[data-testid=fit-progress]")
        check(page.locator("[data-testid=fit-weight-card]").count() == 1 and page.locator("[data-testid=fit-measures]").count() == 0, f"{lang}: Progress shows the weight first, the rest folded")
        snap(page, f"fit-progress-{lang}")
        page.click("[data-testid=fit-progress-more]"); page.wait_for_timeout(200)
        check(page.locator("[data-testid=fit-measures]").count() == 1, f"{lang}: …'More' opens measurements and the rest")
        page.click("[data-testid=fit-tab-today]"); page.click("[data-testid=fit-add]"); page.wait_for_selector("[data-testid=fit-log]", timeout=3000)
        check(page.locator("[data-testid=fit-add]").count() == 0, f"{lang}: 'Log food' opens the add panel (and hides itself)")
        snap(page, f"fit-add-{lang}")
        ctx.close()
    check(not real_errors(errors), "no page errors: " + "; ".join(real_errors(errors))[:300])
    br.close()
env.close(); finish()
