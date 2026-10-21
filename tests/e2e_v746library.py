"""v6.46 "Remember" (Ali: users give Attune a book or the news; Chat answers from it — "what happens in this chapter"): paste a
small book → it is remembered with its 3 chapters → Chat "what happens in chapter 3?" is answered from THAT chapter (the model is
given chapter 3's text, not chapter 2's) → Forget. Knowledge (the packs) stays hidden from users.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v746library.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
BOOK = "\n".join(["Chapter 1: The Port", "Omar arrives at Sokhna port at dawn and meets Hassan, the old operator.", "",
  "Chapter 2: The Storm", "A storm closes the port for three days. The crane stands still.", "",
  "Chapter 3: The Lift", "On Friday the 200 tonne beam is lifted. Omar signals and Hassan lifts it in one try."])
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home')}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.click("[data-testid=home-t-remember]"); page.wait_for_selector("[data-testid=library-page]", timeout=5000)
    page.click("[data-testid=lib-add-paste]"); page.fill("[data-testid=lib-paste-title]", "The Crane Keeper"); page.fill("[data-testid=lib-paste-text]", BOOK)
    page.click("[data-testid=lib-paste-save]"); page.wait_for_selector("[data-testid=lib-item]", timeout=5000)
    check("3 chapters" in page.inner_text("[data-testid=lib-item]"), "remembered with its 3 chapters")
    page.evaluate("() => { window.__mock.bodies = []; }")
    page.click("[data-testid=lib-ask]"); page.wait_for_timeout(500)
    box = page.locator("textarea").first
    box.fill("What happens in chapter 3?"); box.press("Enter")
    page.wait_for_function("() => (window.__mock.bodies || []).some(b => JSON.stringify(b.messages || []).includes('200 tonne beam'))", timeout=60000)
    sent = page.evaluate("() => JSON.stringify((window.__mock.bodies || []).map(b => b.messages))")
    check("200 tonne beam" in sent and "The Crane Keeper" in sent and "storm closes" not in sent, "Chat answers from chapter 3 itself (not chapter 2)")
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.click("[data-testid=home-t-remember]"); page.wait_for_selector("[data-testid=lib-item]", timeout=5000)
    page.click("[data-testid=lib-remove]"); page.wait_for_timeout(300)
    page.locator("button:has-text('Forget')").last.click(); page.wait_for_timeout(500)
    check(page.locator("[data-testid=lib-item]").count() == 0, "Forget removes it")
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    check(page.locator(".rounded-t-2xl button:has-text('Knowledge')").count() == 0, "Knowledge (the packs) is not shown to users")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
