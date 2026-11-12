"""v9.9.26 T6 Focus "make the phone quiet" (Ali's Play-safe pick): the switch shows only on the phone (the phone part exists); not allowed
yet → "Allow once in Android settings" opens Android's own page; once allowed, starting a focus turns Do Not Disturb on and stopping it
turns the person's own setting back; with the switch off nothing is touched.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9926quiet.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = ("try{localStorage.setItem('attune:start','home')}catch(e){}\n"
        "window.__q = []; window.__allowed = false; (() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);"
        " N.quietAllowed = () => window.__allowed; N.askQuiet = () => { window.__q.push('ask'); window.__allowed = true; }; N.setQuiet = (on) => { window.__q.push(on ? 'on' : 'off'); return true; }; }; go(); })();")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-focus-pick'))"); page.wait_for_selector("[data-testid=focus-pick]")
    check(page.locator("[data-testid=focus-quiet]").count() == 1, "the 'Make the phone quiet' switch shows on the phone")
    page.fill("[data-testid=focus-pick] input[dir=auto]", "Tender file"); page.click("[data-testid=focus-start]"); page.wait_for_selector("[data-testid=focus-screen]")
    page.click("[data-testid=focus-stop]"); page.wait_for_timeout(200); page.click("[data-testid=focus-close]")
    check(page.evaluate("window.__q") == [], "switch off → Do Not Disturb is never touched, on start or on stop")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-focus-pick'))"); page.wait_for_selector("[data-testid=focus-pick]")
    page.check("[data-testid=focus-quiet-switch]"); page.wait_for_timeout(100)
    check(page.locator("[data-testid=focus-quiet-allow]").count() == 1, "not allowed yet → 'Allow once in Android settings'")
    page.click("[data-testid=focus-quiet-allow]"); page.wait_for_timeout(1800)
    check("ask" in page.evaluate("window.__q") and page.locator("[data-testid=focus-quiet-allow]").count() == 0, "it opens Android's page; once allowed the button goes")
    page.fill("[data-testid=focus-pick] input[dir=auto]", "Tender file"); page.click("[data-testid=focus-start]"); page.wait_for_selector("[data-testid=focus-screen]")
    check(page.evaluate("window.__q")[-1] == "on", "starting the focus turns Do Not Disturb on")
    page.click("[data-testid=focus-stop]"); page.wait_for_timeout(200)
    check(page.evaluate("window.__q")[-1] == "off", "stopping it gives the person's own setting back")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
