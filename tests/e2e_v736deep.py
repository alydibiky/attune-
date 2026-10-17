"""v6.32 — Deep answer (Ali: "build now"): "+" → Deep answer sends the NEXT question to the strongest installed model (also one
that runs slowly from storage), thinking first; the answer is marked; the switch is one question only. Runs without the old bar.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736deep.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','chat')}catch(e){}")
    page.goto(env.url); page.wait_for_timeout(1500)
    page.locator("[data-testid=header-model]:visible").first.click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(400)
    page.click("[data-testid=composer-plus]"); page.wait_for_selector("[data-testid=composer-menu]")
    check(page.locator("[data-testid=menu-deep]").count() == 1, "'+' has Deep answer")
    page.click("[data-testid=menu-deep]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=chip-deep]").count() == 1, "Deep answer, once on, shows as a chip")
    page.evaluate("() => { const M = window.__mock; M.bodies = []; M.fakeQueue = ['Because the valve holds pressure until the pilot opens it.']; }")
    page.locator("textarea").first.fill("Why does a counterbalance valve hold a load?"); page.locator("button[title='Send']").click()
    page.wait_for_selector("[data-testid=deep-tag]", timeout=30000)
    bodies = page.evaluate("(window.__mock.bodies || []).filter(b => !(b.max_tokens <= 2))")
    check(any((b.get("chat_template_kwargs") or {}).get("enable_thinking") for b in bodies), "the Deep answer thinks first")
    check(page.locator("[data-testid=chip-deep]").count() == 0, "…and it is for this one question only (the chip is gone)")
    check("Deep answer" in page.inner_text("[data-testid=deep-tag]"), "the answer is marked 'Deep answer'")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
