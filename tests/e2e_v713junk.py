"""v6.13 — Core+ wrote "0000…" on Ali's phone: the nonsense guard stops it, restarts the engine in safe mode and asks again.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v713junk.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def send(page, t):
    page.locator("textarea[placeholder='Message Attune']").fill(t); page.locator("button[title='Send']").click()
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate("() => { const M = window.__mock; M.setSpeedCalls = []; M.fakeQueue = ['0'.repeat(400), 'You are the bus driver: the riddle starts with \"You are driving a bus\".']; }")
    send(page, "You are driving a bus. At the first stop, 5 people get on. At the second stop, 2 get off and 7 get on. At the third stop, 4 get off. What is the bus driver's name?")
    page.wait_for_selector("button[title='Regenerate']", timeout=30000)
    body = page.locator("body").inner_text()
    check("You are the bus driver" in body, "the second try's answer is shown")
    check("0000000000" not in body, "the nonsense is not shown")
    calls = page.evaluate("window.__mock.setSpeedCalls")
    check(any(c.get("safe") is True for c in calls), "the engine was restarted in safe mode: %s" % calls)
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
