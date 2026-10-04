"""v6.12 — Chat Auto: Web · Auto searches only when the question needs fresh facts (Off → Auto → On on the Web button).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v700auto.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def send(page, t):
    page.locator("textarea[placeholder='Message Attune']").fill(t); page.locator("button[title='Send']").click()
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s','1');localStorage.removeItem('attune:web:auto')}}catch(e){}")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    check("Auto" in page.locator("[data-testid=web-toggle]").inner_text(), "Web starts on Auto (the app decides)")
    page.evaluate("() => { const M = window.__mock; M.lastSearch = null; M.fakeQueue = ['A counterbalance valve holds the load.']; }")
    send(page, "Explain how a counterbalance valve works")
    page.wait_for_selector("button[title='Regenerate']", timeout=30000)
    check(page.evaluate("window.__mock.lastSearch") is None, "a knowledge question: no web search")
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['The Liebherr LTM 1100 lifts 100 t [1].', 'x', 'x']; }")
    send(page, "Liebherr LTM 1100 specs and price in 2026")
    page.wait_for_function("document.querySelectorAll('button[title=Regenerate]').length >= 2", timeout=40000)
    q = page.evaluate("window.__mock.lastSearch && window.__mock.lastSearch.q")
    check(bool(q) and "Liebherr" in q, "a specs/price question searches by itself: %s" % q)
    page.click("[data-testid=web-toggle]"); page.wait_for_timeout(150)
    page.evaluate("() => { const M = window.__mock; M.lastSearch = null; M.fakeQueue = ['ok']; }")
    send(page, "Liebherr LTM 1100 price 2026")
    page.wait_for_function("document.querySelectorAll('button[title=Regenerate]').length >= 3", timeout=40000)
    check(page.evaluate("window.__mock.lastSearch") is None, "one tap: Off — nothing is searched, even for a price")
    page.click("[data-testid=web-toggle]"); page.wait_for_timeout(150)
    check("Auto" not in page.locator("[data-testid=web-toggle]").inner_text() and "teal" in (page.locator("[data-testid=web-toggle]").get_attribute("class") or ""), "next tap: Web always on")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
