"""v6.29 release checks — Google Play: on a Play build (window.ATTUNE_STORE present) Pro and Business are bought only through
Google Play (no activation-code or old-key boxes); the Privacy page opens from More and from Health Connect's "why" link
(Android sends {kind: "privacy"}); the Play store not answering keeps Pro (it is not "owns nothing").
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v733release.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
STORE = "window.ATTUNE_STORE = { name: 'Google Play', purchase: async () => ({ ok: false, reason: 'cancelled' }), owned: async () => [], products: async () => [], consume: async () => ({ ok: true }) };"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=STORE + "try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 860})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator("text=Pro trial").first.click(); page.wait_for_selector("[data-testid=upgrade]", timeout=5000)
    up = page.locator("[data-testid=upgrade]")
    check(up.locator("[data-testid=have-code]").count() == 0 and up.locator("text=I have an older key").count() == 0, "a Play build: no activation-code or old-key entry (Play's payments policy)")
    check(up.locator("text=Restore purchase").count() == 1, "…Restore purchase stays")
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator("[data-testid=more-privacy]").first.click(); page.wait_for_selector("[data-testid=privacy-page]", timeout=5000)
    t = page.locator("[data-testid=privacy-page]").inner_text()
    check("Health Connect" in t and "no Attune server" in t and "one-time codes" in t, "More → Privacy: the privacy policy")
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)
    page.evaluate("window.dispatchEvent(new MessageEvent('attune-share', {data: {kind: 'privacy'}}))"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=privacy-page]").count() == 1, "Health Connect's 'why this app reads your data' opens the Privacy page")
    page.evaluate("localStorage.setItem('attune:ui:lang','ar')"); page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("window.dispatchEvent(new MessageEvent('attune-share', {data: {kind: 'privacy'}}))"); page.wait_for_timeout(400)
    check("Health Connect" in page.locator("[data-testid=privacy-page]").inner_text() and "باختصار" in page.locator("[data-testid=privacy-page]").inner_text(), "…in Arabic too")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
