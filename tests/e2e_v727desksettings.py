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
    # (v9.1: 'Plans over Fit & Food' is archived with Fit — archive/fit/tests/mixed/e2e_v727desksettings.py)
    pass
    ctx.close(); br.close()
env.close(); finish()
