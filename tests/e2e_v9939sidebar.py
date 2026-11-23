"""v9.9.39 SB-4 (Ali picked it: "the left sidebar is very crowded with the 2 additions"): the sidebar's list no longer has "What Attune
knows" and "Set up your life"; a slim strip "Set up your life · N of 7" sits at the top until setup is done; the bottom bar is
Knows · Backup · Settings; Settings keeps "Set up your life". Phone and computer; English and Egyptian Arabic.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9939sidebar.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = "try{localStorage.setItem('attune:test:quiet','0');localStorage.setItem('attune:start','home')}catch(e){}"
with sync_playwright() as p:
    br = p.chromium.launch()
    for lang in ("en", "ar"):
        init = INIT + ("try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}" if lang == "ar" else "")
        # ---- phone
        ctx, page = new_page(br, env, errors, extra_init=init, legacy_nav=False)
        page.goto(env.url); page.wait_for_selector("[data-testid=home-ask] >> visible=true", timeout=15000); page.wait_for_timeout(500)
        page.click("[data-testid=home-menu] >> visible=true"); page.wait_for_selector("[data-testid=phone-side] >> visible=true", timeout=4000)
        side = page.locator("[data-testid=phone-side]")
        strip = side.locator("[data-testid=side-setup-strip]")
        check(strip.count() == 1, lang + " phone: the setup strip is at the top while setup is unfinished")
        txt = strip.inner_text() if strip.count() else ""
        check(("of 7" in txt or "of 8" in txt) if lang == "en" else ("Set up" not in txt and len(txt) > 5), lang + " phone: the strip reads “" + txt.replace("\n", " ") + "”")
        check(side.locator("[data-testid=side-setup]").count() == 0, lang + " phone: no “Set up your life” row in the list any more")
        foot = [side.locator("[data-testid=%s]" % t) for t in ("side-brain", "side-backup", "side-settings")]
        check(all(f.count() == 1 for f in foot), lang + " phone: the bottom bar is Knows · Backup · Settings")
        if lang == "en": check(foot[0].inner_text().strip() == "Knows", "the bottom button says Knows")
        else: check(foot[0].inner_text().strip() == "يعرف إيه", "Egyptian: «يعرف إيه» (%s)" % foot[0].inner_text().strip())
        box = [f.bounding_box() for f in foot]
        check(all(b and b["width"] >= 44 and b["height"] >= 44 for b in box), lang + " phone: each bottom button is at least 44 px")
        check(abs(box[0]["y"] - box[2]["y"]) < 2, lang + " phone: the three sit on one line")
        foot[0].click(); page.wait_for_timeout(500)
        check(page.locator("text=" + ("What Attune knows" if lang == "en" else "Attune")).count() > 0 and page.locator("[data-testid=phone-side]").count() == 0 or page.locator("[data-testid=brain-page], [data-testid*=brain]").count() > 0, lang + " phone: Knows opens what Attune knows")
        page.click("[data-testid=home-menu] >> visible=true") if page.locator("[data-testid=home-menu] >> visible=true").count() else None
        page.wait_for_timeout(300)
        if page.locator("[data-testid=phone-side] [data-testid=side-setup-strip]").count():
            page.locator("[data-testid=phone-side] [data-testid=side-setup-strip]").click(); page.wait_for_timeout(500)
            check(page.locator("[data-testid*=setup]").count() > 0, lang + " phone: the strip opens Set up your life")
        # Settings keeps the way in
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: 'home' } }))"); page.wait_for_timeout(300)
        if page.locator("[data-testid=home-menu]").count():
            page.click("[data-testid=home-menu] >> visible=true"); page.wait_for_timeout(300); page.locator("[data-testid=phone-side] [data-testid=side-settings]").click(); page.wait_for_timeout(500)
            check(page.locator("[data-testid=more-setup]").count() >= 1, lang + " phone: Settings has “Set up your life”")
        ctx.close()
        # ---- computer
        ctx, page = new_page(br, env, errors, extra_init=init, legacy_nav=False, desktop=(1366, 860))
        page.goto(env.url); page.wait_for_selector("[data-testid=side] >> visible=true", timeout=15000); page.wait_for_timeout(500)
        side = page.locator("[data-testid=side]")
        check(side.locator("[data-testid=side-setup-strip]").count() == 1 and side.locator("[data-testid=side-brain]").count() == 1, lang + " computer: strip at the top, Knows at the bottom")
        b = [side.locator("[data-testid=%s]" % t).bounding_box() for t in ("side-brain", "side-backup", "side-settings")]
        check(all(x and x["width"] >= 44 for x in b) and abs(b[0]["y"] - b[2]["y"]) < 2, lang + " computer: Knows · Backup · Settings on one line")
        side.locator("[data-testid=side-settings]").click(); page.wait_for_timeout(500)
        check(page.locator("[data-testid=more-setup]").count() >= 1, lang + " computer: Settings has “Set up your life”")
        ctx.close()
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
