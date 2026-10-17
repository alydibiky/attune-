"""v6.32 — the Attune keyboard: in the app, Settings shows "Attune keyboard" with Turn on (opens the system keyboard settings);
once it is on, "Switch to it" opens the keyboard picker. Not shown in a browser (no keyboard there).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736keyboard.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
MOCK = """(() => { const t = setInterval(() => { const N = window.AttuneNative; if (!N) return; clearInterval(t);
  window.__kb = { on: false, calls: [] };
  N.keyboardState = () => JSON.stringify({ enabled: window.__kb.on });
  N.keyboardSetup = (w) => { window.__kb.calls.push(w); return "ok"; };
}, 5); })();"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=MOCK)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button:has-text('All')").first.click(); page.wait_for_timeout(400)
    row = page.locator("[data-testid=keyboard-row]").first
    check(row.count() == 1 and "Attune keyboard" in row.inner_text(), "Settings shows the Attune keyboard")
    page.locator("[data-testid=keyboard-setup]").first.click()
    check(page.evaluate("window.__kb.calls") == ["settings"], "Turn on opens the system keyboard settings")
    page.evaluate("window.__kb.on = true; window.dispatchEvent(new Event('focus'))"); page.wait_for_timeout(200)
    check("Switch to it" in page.locator("[data-testid=keyboard-setup]").first.inner_text(), "once on: Switch to it")
    page.locator("[data-testid=keyboard-setup]").first.click()
    check(page.evaluate("window.__kb.calls")[-1] == "pick", "Switch to it opens the keyboard picker")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
