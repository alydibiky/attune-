"""v6.40 (upgrade W5) — Prompt lab: two prompts on the same text, side by side; the better one kept in My prompts; Use opens it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740promptlab.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'library'}}))")
    page.wait_for_selector("[data-testid=promptlab-open]", timeout=6000); page.click("[data-testid=promptlab-open]")
    page.evaluate("() => { const M = window.__mock; M.bodies = []; M.fakeQueue = ['Summary A: the client wants a 50 t crane on Saturday.', 'B.']; }")
    page.fill("[data-testid=promptlab-a]", "Summarise in one line: {input}")
    page.fill("[data-testid=promptlab-b]", "TL;DR {input}")
    page.fill("[data-testid=promptlab-input]", "Hi, we need a 50 ton crane this Saturday in 6th of October for two days.")
    page.click("[data-testid=promptlab-run]")
    page.wait_for_selector("[data-testid=promptlab-res-b]", timeout=15000)
    sent = page.evaluate("window.__mock.bodies.filter((b) => b.max_tokens > 2).map((b) => b.messages[b.messages.length - 1].content)")
    check(any(s.startswith("Summarise in one line: Hi, we need") for s in sent) and any(s.startswith("TL;DR Hi") for s in sent), "both prompts run with the text in place of {input}")
    check("Summary A" in page.locator("[data-testid=promptlab-res-a]").inner_text() and "words" in page.locator("[data-testid=promptlab-res-a]").inner_text(), "side by side, with time and length")
    page.click("[data-testid=promptlab-keep-a]")
    page.wait_for_selector("[data-testid=promptlab-mine-item]", timeout=3000)
    check("Summarise in one line" in page.locator("[data-testid=promptlab-mine-item]").first.inner_text(), "Keep A puts it in My prompts")
    page.click("[data-testid=promptlab-mine-item]"); page.wait_for_timeout(400)
    check(page.locator("textarea").first.input_value().startswith("Summarise in one line"), "a kept prompt opens in Prompts to use")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
