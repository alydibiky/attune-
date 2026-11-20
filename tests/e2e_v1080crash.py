"""v10.8 problem reports (Ali picked CR3; OK-CR: "I don't want users to see the problem — they just send it"):
 · after Attune closed by itself, Home shows one card "Attune closed by itself last time" — Send a report · Not now — and never the error;
 · Send hands the report to the phone's share sheet (crashSend); Not now just hides the card (crashDismiss);
 · Settings has "Send a problem report" while something is kept; a page error is kept quietly (crashNote), no message about it.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1080crash.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
MOCK = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}))}catch(e){};"
        "window.__cr={pending:%s,count:2,sent:0,dismissed:0,notes:[],page:''};"
        "(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);"
        " N.crashState = () => JSON.stringify({pending: window.__cr.pending, count: window.__cr.count});"
        " N.crashSend = () => { window.__cr.sent++; window.__cr.pending = false; return true; };"
        " N.crashDismiss = () => { window.__cr.dismissed++; window.__cr.pending = false; };"
        " N.crashNote = (p, t) => { window.__cr.notes.push([p, t]); }; N.crashPage = (p) => { window.__cr.page = p; }; } w(); })();")
with sync_playwright() as p:
    br = p.chromium.launch()
    for name, w, desk in (("phone", 412, False), ("computer", 1366, True)):
        for act in ("send", "later"):
            ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(w, 860) if desk else None, extra_init=MOCK % "true")
            if not desk: page.set_viewport_size({"width": w, "height": 860})
            page.goto(env.url); page.wait_for_timeout(2000)
            card = page.locator("[data-testid=crash-card]")
            check(card.count() == 1 and "closed by itself" in card.inner_text(), name + ": after a close-by-itself, Home asks once to send a report")
            body = page.inner_text("body")
            check(not any(x in body for x in ("Exception", "TypeError", "stack", "at com.")), name + ": the problem itself is never shown")
            if act == "send":
                page.click("[data-testid=crash-send]"); page.wait_for_timeout(300)
                check(page.evaluate("window.__cr.sent") == 1 and page.locator("[data-testid=crash-card]").count() == 0, name + ": Send → the share sheet, the card goes")
            else:
                page.click("[data-testid=crash-later]"); page.wait_for_timeout(300)
                check(page.evaluate("window.__cr.dismissed") == 1 and page.evaluate("window.__cr.sent") == 0 and page.locator("[data-testid=crash-card]").count() == 0, name + ": Not now → nothing sent, the card goes")
            check(page.evaluate("window.__cr.page") == "home", name + ": the open page is noted for a crash line")
            page.evaluate("window.dispatchEvent(new CustomEvent('attune-error',{detail:{msg:'TypeError: x is undefined'}}))"); page.wait_for_timeout(200)
            check(len(page.evaluate("window.__cr.notes")) >= 1, name + ": a page error is kept quietly for the report")
            ctx.close()
    # Settings row while something is kept (no close-by-itself → no card)
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=MOCK % "false"); page.set_viewport_size({"width": 412, "height": 860})
    page.goto(env.url); page.wait_for_timeout(2000)
    check(page.locator("[data-testid=crash-card]").count() == 0, "no close-by-itself → no card on Home")
    page.click("[data-testid=home-menu]"); page.wait_for_timeout(400); page.locator("[data-testid=side-settings]").first.click(); page.wait_for_timeout(700)
    row = page.locator("[data-testid=more-report]")
    check(row.count() == 1, "Settings: “Send a problem report” while something is kept")
    if row.count(): row.click(); page.wait_for_timeout(300); check(page.evaluate("window.__cr.sent") == 1, "…and it sends through the share sheet")
    ctx.close()
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
