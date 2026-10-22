"""v6.27 On a computer: Settings is a settings window (no tool list); a window over Fit & Food (Plans) hides Fit's bar and colours."""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="localStorage.setItem('attune:fit:v1', JSON.stringify({profile:{age:30,cm:175,kg:85,sex:'m',goal:'lose',activity:'light'},days:{},weights:[],look:'meals'}))")
    page.set_viewport_size({"width": 1440, "height": 900})
    page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000)
    page.click("[data-testid=side-settings]"); page.wait_for_selector("[data-testid=desk-settings]")
    t = page.locator("[data-testid=desk-settings]").inner_text()
    check("appearance" in t.lower() and "Engine & privacy" in t and "Backup" in t and page.locator("[data-testid=desk-settings] [data-testid=more-group]").count() == 0, "computer: Settings is a settings window (appearance, engine, profile, plan, backup) — no tool list")
    pass
    page.click("[data-testid=desk-settings-close]")
    page.fill("[data-testid=side-search]", "fit"); page.wait_for_timeout(200); page.locator("[data-testid=side-tool-hits] [data-testid=side-go-fit]").click(); page.wait_for_timeout(600)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-panel',{detail:'plan'}))"); page.wait_for_selector("[data-testid=upgrade]")   # v6.50: Plan opens from the Home box; page.wait_for_timeout(300)
    nav = page.locator("[data-testid=fit-nav]")
    check(nav.count() == 0 or not nav.is_visible(), "Plans over Fit & Food: Fit's bottom bar is hidden")
    bg = page.evaluate("getComputedStyle(document.querySelector('[data-testid=upgrade]')).backgroundColor")
    check(bg not in ("rgb(246, 247, 251)", "rgb(242, 246, 243)"), "…and Plans keeps its own colours, not Fit's light look (%s)" % bg)
    pass
    ctx.close(); br.close()
env.close(); finish()
