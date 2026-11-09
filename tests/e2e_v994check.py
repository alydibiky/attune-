"""v9.9.4 M3 (Ali picked "a second read before you see it"): on any power level, "check it" / a hard question with numbers (a contract,
tax, interest…) gets the reviewer pass — the same small model re-reads the draft (no second model loaded).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v994check.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
def ask(page, t, q=None):
    page.evaluate("(q) => { window.__mock.bodies = []; if (q) window.__mock.fakeQueue = q; }", q)
    page.locator("textarea[placeholder='Message Attune']").fill(t); page.locator("button[title='Send']").click()
    page.wait_for_function("() => window.__mock.bodies.some(x => x.max_tokens > 2)", timeout=20000); page.wait_for_timeout(2500)
    return json.dumps(page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)"))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_timeout(1000)
    install(page)
    b = ask(page, "explain what a late-penalty clause in a rental contract usually means for the tenant — check it",
            ["A late-penalty clause means the tenant pays an extra amount for each day the rent is late. It is usually a fixed percentage of the monthly rent, and courts may reduce it if it is excessive. Read the clause for the rate, the grace period and any cap.",
             "PROBLEMS:\n- none\nFINAL ANSWER:\nA late-penalty clause means the tenant pays an extra amount for each day the rent is late, usually a fixed percentage of the rent, often after a grace period and sometimes with a cap."])
    try: page.wait_for_function("() => JSON.stringify(window.__mock.bodies).includes('senior expert reviewer')", timeout=60000)
    except Exception: pass
    b = json.dumps(page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)"))
    check("senior expert reviewer" in b, "“check it” on a contract question → the reviewer pass runs (same model); word problems with numbers already go to the code checker")
    page.click("header button[aria-label='New chat']"); page.wait_for_timeout(200); page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(400)
    b = ask(page, "write a short poem about the sea")
    check("senior expert reviewer" not in b, "a simple request → no extra pass (fast)")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
