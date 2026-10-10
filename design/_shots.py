import sys, os
sys.path.insert(0, "tests")
import harness; harness.PAGE_PORT=8877; harness.ENGINE_PORT=18877
from harness import Env, new_page
from playwright.sync_api import sync_playwright
env = Env(); errs = []
D = "design/"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errs)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000); page.wait_for_timeout(1500)
    page.screenshot(path=D+"current-home.png")
    print([b.inner_text() for b in page.locator("nav button").all()])
    page.locator("nav button").last.click(); page.wait_for_timeout(500)
    page.screenshot(path=D+"current-more.png")
    print(page.locator(".rounded-t-2xl button").all_inner_texts()[:40])
    for name in ["Fit", "Studio"]:
        page.goto(env.url); page.wait_for_selector("nav"); page.wait_for_timeout(800)
        page.locator("nav button").last.click(); page.wait_for_timeout(300)
        try:
            page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click(); page.wait_for_timeout(1500)
            page.screenshot(path=D+f"current-{name.lower()}.png")
        except Exception as e: print(name, e)
    for i in range(1, 4):
        page.goto(env.url); page.wait_for_selector("nav"); page.wait_for_timeout(800)
        try:
            page.locator("nav button").nth(i).click(); page.wait_for_timeout(1000)
            page.screenshot(path=D+f"current-tab{i}.png")
        except Exception as e: print(i, e)
    br.close()
env.close()
