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
    # v6.18 (Ali's screenshot): just a car's name — no "price" or "specs" — is a lookup too
    page.evaluate("() => { const M = window.__mock; M.lastSearch = null; M.fakeQueue = ['The Lynk & Co 900 is a large plug-in hybrid SUV [1].', 'x', 'x']; }")
    send(page, "Lynk and co 900")
    page.wait_for_function("document.querySelectorAll('button[title=Regenerate]').length >= 3", timeout=40000)
    q = page.evaluate("window.__mock.lastSearch && window.__mock.lastSearch.q")
    check(bool(q) and "900" in q, "a bare model name (Lynk and co 900) searches the web too: %s" % q)
    # v6.20 (Ali: "Reading 10 pages… 5 min 19 s — when will it end"): on a phone that writes 7.5 tokens a second the web answer
    # is sized to about a minute and a half — a short prompt, a short answer, "More detail" for the rest
    page.evaluate("() => { localStorage.setItem('attune:speed:v1', JSON.stringify({ tps: 7.5, promptTps: 40 })); const M = window.__mock; M.bodies = []; M.fakeQueue = ['The Lynk & Co 900 is a large plug-in hybrid SUV [1].', 'x', 'x']; }")
    send(page, "Lynk and co 900")
    page.wait_for_function("document.querySelectorAll('button[title=Regenerate]').length >= 4", timeout=40000)
    last = page.evaluate("() => { const b = window.__mock.bodies.filter((x) => x && x.messages && JSON.stringify(x.messages).includes('writes slowly')); return b.length ? { max: b[b.length - 1].max_tokens, chars: JSON.stringify(b[b.length - 1].messages).length } : null; }")
    check(last is not None and last["max"] <= 525 and last["chars"] < 9000, "a slow phone (7.5 tokens/s): a short answer (max %s tokens) from a short prompt (%s characters)" % (last and last["max"], last and last["chars"]))
    page.evaluate("localStorage.removeItem('attune:speed:v1')")
    page.click("[data-testid=web-toggle]"); page.wait_for_timeout(150)
    check("Auto" not in page.locator("[data-testid=web-toggle]").inner_text(), "one tap: Web always on")
    page.click("[data-testid=web-toggle]"); page.wait_for_timeout(150)
    check("Auto" in page.locator("[data-testid=web-toggle]").inner_text(), "next tap: back to Auto")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
