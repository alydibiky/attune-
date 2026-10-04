"""v6.1 — launch: the model list on a phone shows only models worth using on it (no 0.8B "not for
reasoning" model, no model too big for the phone), with "Show all models" for the rest; the Library
shows no developer text and makes no request to a server that isn't set up.

  python3 tests/e2e_v61.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    # a 12 GB phone (the test phone)
    page.locator("header button:has-text('No model')").click(); page.wait_for_timeout(300)
    ids = page.evaluate("[...document.querySelectorAll('[data-testid^=tier-]')].map(e => e.dataset.testid)")
    check("tier-xs" not in ids and "tier-sm" not in ids, "12 GB phone: Spark (0.8B) and Glow (2B) are not offered (%s)" % ", ".join(i[5:] for i in ids))
    check("tier-ultra" in ids and "tier-moe-lg" in ids, "v6.12: the high-end models stay listed on a flagship phone (their card says they need more memory)")
    check("tier-md" in ids and "tier-xl" in ids, "…the good ones are (Core, Zenith)")
    page.locator("[data-testid=tiers-show-all]").click(); page.wait_for_timeout(200)
    ids2 = page.evaluate("[...document.querySelectorAll('[data-testid^=tier-]')].map(e => e.dataset.testid)")
    check("tier-xs" in ids2 and "tier-ultra" in ids2, "“Show all models” shows every model")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

    # a 4 GB phone (a phone browser that says so): Glow is the sensible choice there, so it stays
    ctx.close()
    ctx, page = new_page(br, env, errors, extra_init="Object.defineProperty(navigator, 'userAgentData', { get: () => ({ mobile: true }) }); try { localStorage.setItem('attune:ram', '4'); } catch (e) {}")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click(); page.wait_for_timeout(300)
    ids = page.evaluate("[...document.querySelectorAll('[data-testid^=tier-]')].map(e => e.dataset.testid)")
    check("tier-sm" in ids and "tier-xs" not in ids and "tier-xl" not in ids, "4 GB phone: Glow offered, Spark and Zenith (12 GB) not (%s)" % ", ".join(i[5:] for i in ids))
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

    # Library: no developer text
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(".rounded-t-2xl button:has-text('Library')").first.click(); page.wait_for_timeout(500)
    check("REMOTE_LIBRARY_URL" not in page.inner_text("body"), "the Library shows no developer text")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
