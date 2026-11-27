"""v10.9.9 B5 (Ali OK'd 27 Nov: "test every page, guided"), at a phone (390) and a computer (1366):
  1. Settings has "Test every page"; it opens the test at page 1 (Home) with one thing to try and what it should do
  2. ✓ Works → page 2; ✗ Wrong with a note → saved; Skip → next; the summary counts them
  3. "Open …" opens the page: on the phone the test becomes a "Back to the test" pill (tap → the test again, same page);
     on the computer it stays at the side
  4. progress is kept across a reload; Share the list makes the report (the computer downloads one .html file)
  5. in Arabic the step reads in Arabic (no English left in the step)
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1099b5.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:onboarded','1');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));}catch(e){}")
def open_settings(page, wide):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'settings'}}))"); page.wait_for_timeout(700)
with sync_playwright() as p:
    br = p.chromium.launch()
    for w in (390, 1366):
        wide = w > 500
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT, desktop=(w, 860) if wide else None)
        if not wide: page.set_viewport_size({"width": w, "height": 860})
        page.goto(env.url); page.wait_for_timeout(1500)
        open_settings(page, wide)
        row = page.locator("[data-testid=settings-test-pages]")
        check(row.count() > 0 and row.first.is_visible(), "%d: Settings has 'Test every page'" % w)
        row.first.click(); page.wait_for_timeout(500)
        panel = page.locator("[data-testid=test-pages]")
        check(panel.count() == 1 and panel.is_visible(), "%d: the test opens" % w)
        step = page.locator("[data-testid=test-step]")
        check(step.get_attribute("data-id") == "home" and "remind me tomorrow at 9" in step.inner_text() and "Should:" in step.inner_text(), "%d: page 1 = Home, one thing to try and what it should do" % w)
        page.click("[data-testid=test-ok]"); page.wait_for_timeout(200)
        check(step.get_attribute("data-id") == "chat", "%d: ✓ Works → page 2 (Chat)" % w)
        page.click("[data-testid=test-bad]"); page.fill("[data-testid=test-note]", "it said 0"); page.click("[data-testid=test-bad-save]"); page.wait_for_timeout(200)
        check(step.get_attribute("data-id") == "money", "%d: ✗ Wrong with a note → saved, next page" % w)
        page.click("[data-testid=test-skip]"); page.wait_for_timeout(200)
        summ = page.locator("[data-testid=test-summary]").inner_text()
        check("1 work" in summ and "1 wrong" in summ and "1 skipped" in summ and "it said 0" in summ, "%d: the summary counts them, with the note (%s)" % (w, summ.split("\n")[0]))
        bg = page.evaluate("() => getComputedStyle(document.querySelector('[data-testid=test-pages]')).backgroundColor")
        check("rgba" not in bg or bg.endswith(", 1)"), "%d: the panel is solid (%s)" % (w, bg))
        # Open the page (Mind)
        page.click("[data-testid=test-open]"); page.wait_for_timeout(1000)
        if not wide:
            pill = page.locator("[data-testid=test-pill]")
            check(pill.count() == 1 and pill.is_visible() and page.locator("[data-testid=test-pages]").count() == 0 and "4 of" in pill.inner_text(), "%d: the phone shows the page, with a 'Back to the test' pill" % w)
            pill.click(); page.wait_for_timeout(300)
            check(page.locator("[data-testid=test-step]").get_attribute("data-id") == "memory", "%d: the pill brings the test back on the same page" % w)
        else:
            check(page.locator("[data-testid=test-pages]").is_visible(), "%d: the computer keeps the test at the side of the page" % w)
        page.reload(); page.wait_for_timeout(1500)
        open_settings(page, wide); page.locator("[data-testid=settings-test-pages]").first.click(); page.wait_for_timeout(400)
        check(page.locator("[data-testid=test-step]").get_attribute("data-id") == "memory", "%d: progress is kept after a reload" % w)
        if wide:
            # (a computer without the phone's share sheet downloads ONE .html file; with it — like this stand-in — the share sheet)
            page.evaluate("() => { if (window.AttuneNative) { window.__keepShare = window.AttuneNative.share; window.AttuneNative.share = undefined; } }")
            with page.expect_download(timeout=8000) as dl:
                page.click("[data-testid=test-share]")
            path = dl.value.path(); html = open(path, encoding="utf-8").read()
            page.evaluate("() => { if (window.AttuneNative && window.__keepShare) window.AttuneNative.share = window.__keepShare; }")
            check("✗ Chat" in html and "it said 0" in html and "version 10.9.9" in html, "%d: Share the list → one .html report (wrong first, the note, the version)" % w)
        else:
            page.click("[data-testid=test-share]"); page.wait_for_timeout(500)
            shared = page.evaluate("(window.__mock && window.__mock.shared) || ''")
            check("✗ Chat" in shared and "it said 0" in shared, "%d: Share the list → the phone's share sheet with the report (wrong first, the note)" % w)
        page.click("[data-testid=test-close]"); page.wait_for_timeout(200)
        check(page.locator("[data-testid=test-pages]").count() == 0, "%d: Close closes it" % w)
        # Arabic
        page.evaluate("() => { localStorage.setItem('attune:ui:lang', 'ar'); }"); page.reload(); page.wait_for_timeout(1800)
        open_settings(page, wide); page.locator("[data-testid=settings-test-pages]").first.click(); page.wait_for_timeout(400)
        st = page.locator("[data-testid=test-step]").inner_text()
        check("في عقلي" in st and "Should" not in st and "search for" not in st and "المفروض" in st, "%d: in Arabic the step is Arabic" % w)
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors")
env.close(); finish()
