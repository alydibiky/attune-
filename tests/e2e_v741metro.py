"""v6.41 D5 Cairo Metro offline: Chat answers "metro from Maadi to Dokki" by code at once (no model, no internet), in English and
Egyptian Arabic, with the change, the direction, the time and the ticket.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741metro.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))")
    box = page.locator("textarea").first; box.wait_for(timeout=5000)
    box.fill("metro from Maadi to Dokki"); page.locator("button[title=Send]").last.click()
    page.wait_for_selector("text=change to Line 2", timeout=5000)
    t = page.locator("text=change to Line 2").first.inner_text()
    check("toward New El-Marg" in t and "toward El-Monib" in t and "ticket 10 EGP" in t, "the route with the direction, the change and the ticket: " + t)
    box.fill("مترو من رمسيس للعتبة"); page.locator("button[title=Send]").last.click()
    page.wait_for_selector("text=اتجاه", timeout=5000)
    a = page.locator("text=اتجاه").last.inner_text()
    check("الخط الثاني" in a and "العتبة" in a and "محطة واحدة" in a, "Ramses → Attaba in Egyptian Arabic: line 2, one stop: " + a)
    check(page.evaluate("(window.__mock.bodies || []).filter(b => b.max_tokens > 2).length") == 0, "no model was asked")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
