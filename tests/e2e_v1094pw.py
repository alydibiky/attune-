"""v10.9.4 — Ali's OK-PW2 (23 Nov 2026): the Passwords page, at a phone (390) and a computer (1366):
  1. side menu → Passwords; Paste a page (his Notion toggles) → the check list → Save → every account, kept as written (one with no user name);
  2. Toggles (default): folded; ▸ opens one; its password is •••• until Show (the fingerprint), then the real value;
  3. All together: everything open; the choice is remembered; search finds by name or e-mail;
  4. Undo takes the batch back;
  5. Home chat: "what's my discord password?" → the account card (password hidden until Show);
  6. the passwords are never in the backup file / sync (backup.js collectData skips attune:pw:*), and never in the account list's own store.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1094pw.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
PAGE = "▸ Microsoft\n    email: aly.d@outlook.com\n    pass: Sk!ttlz#2024\n▸ discord account\n    user: skittlz\n    باسورد: dsc_9981x\n▸ Mariam's password\n    Mm1993!!\n▸ Xbox\n    email: aly.d@outlook.com\n    pass: xb0x!!77\n▸ Steam\n    skittlzcarbon\n    St3am-pw"
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));}catch(e){};"
V = " >> visible=true"
def go(page, w, it):
    if w < 1024: page.locator("[data-testid=home-menu], [data-testid=header-menu]").locator("visible=true").first.click()
    page.wait_for_selector("[data-testid=side-go-%s]" % it, timeout=8000); page.click("[data-testid=side-go-%s]" % it); page.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    for w in (390, 1366):
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
        page.set_viewport_size({"width": w, "height": 860}); page.goto(env.url); page.wait_for_timeout(2500)
        go(page, w, "passwords")
        check(page.locator("[data-testid=pw-page]" + V).count() == 1 and page.locator("[data-testid=pw-empty]" + V).count() == 1, "%d: Passwords is in the side menu, empty at first" % w)
        page.click("[data-testid=pw-paste]"); page.fill("[data-testid=pw-paste-text]", PAGE); page.click("[data-testid=pw-paste-read]"); page.wait_for_timeout(300)
        check(page.locator("[data-testid=pw-review-tick]").count() == 5, "%d: the check list finds 5 accounts" % w)
        check("Sk!ttlz#2024" not in page.inner_text("[data-testid=pw-review]"), "%d: the check list never shows a password" % w)
        page.click("[data-testid=pw-review-save]"); page.wait_for_timeout(400)
        titles = page.evaluate("() => [...document.querySelectorAll('[data-testid=pw-page] [data-testid=pw-title]')].filter((e) => e.offsetParent).map((e) => e.innerText)")
        check(sorted(titles) == sorted(["Microsoft", "discord account", "Mariam's password", "Xbox", "Steam"]), "%d: 5 accounts saved, titles as written: %s" % (w, titles))
        check(page.locator("[data-testid=pw-account][data-open='1']" + V).count() == 0, "%d: Toggles (the default): every account folded" % w)
        page.locator("[data-testid=pw-account]" + V, has_text="discord account").locator("[data-testid=pw-toggle]").click(); page.wait_for_timeout(250)
        acc = page.locator("[data-testid=pw-account][data-open='1']" + V)
        check(acc.count() == 1 and "skittlz" in acc.inner_text() and "dsc_9981x" not in acc.inner_text(), "%d: ▸ opens discord account — the user shown, the password hidden" % w)
        acc.locator("[data-testid=doc-field-show]").first.click(); page.wait_for_timeout(250)
        check("dsc_9981x" in acc.inner_text(), "%d: Show (the fingerprint) → the password" % w)
        page.click("[data-testid=pw-view-all]"); page.wait_for_timeout(250)
        check(page.locator("[data-testid=pw-account][data-open='1']" + V).count() == 5, "%d: All together: everything open" % w)
        check(page.evaluate("localStorage.getItem('attune:pw:view')") == "all", "%d: the view is remembered" % w)
        mar = page.locator("[data-testid=pw-account]" + V, has_text="Mariam's password")
        check("Mm1993!!" not in mar.inner_text() and mar.locator("[data-testid=doc-field]").count() == 1, "%d: Mariam's password — one line, no user name, kept as written and locked" % w)
        page.fill("[data-testid=pw-search]", "outlook"); page.wait_for_timeout(250)
        found = page.evaluate("() => [...document.querySelectorAll('[data-testid=pw-page] [data-testid=pw-title]')].filter((e) => e.offsetParent).map((e) => e.innerText)")
        check(sorted(found) == ["Microsoft", "Xbox"], "%d: search by e-mail → Microsoft, Xbox (%s)" % (w, found))
        page.fill("[data-testid=pw-search]", "")
        # the passwords: never in the account list's store, never in the backup file / sync
        store = page.evaluate("localStorage.getItem('attune:pw:v1')")
        check("Sk!ttlz#2024" not in store and "dsc_9981x" not in store, "%d: the account list's store holds no password" % w)
        bk = page.evaluate("() => { const ks = []; for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i)); return ks.filter((k) => k.startsWith('attune:pw:')); }")
        check(set(bk) >= {"attune:pw:v1", "attune:pw:secret:v1"}, "%d: the two password stores exist (%s) — backup.js skips attune:pw:* (unit test)" % (w, bk))
        # Home chat
        go(page, w, "home")
        box = page.locator("[data-testid=home-ask]" + V).first
        box.fill("what's my discord password?"); page.locator("[data-testid=home-send]" + V).first.click(); page.wait_for_timeout(700)   # (on a phone Enter adds a line; the send button sends)
        ans = page.locator("[data-testid=pw-answer]" + V)
        check(ans.count() == 1 and "discord account" in ans.inner_text() and "skittlz" in ans.inner_text() and "dsc_9981x" not in ans.inner_text(), "%d: Home chat → the discord account card, its password hidden" % w)
        if ans.count():
            ans.locator("[data-testid=doc-field-show]").first.click(); page.wait_for_timeout(250)
            check("dsc_9981x" in ans.inner_text(), "%d: Show in the answer → the password" % w)
        # Undo
        go(page, w, "passwords")
        page.click("[data-testid=pw-paste]"); page.fill("[data-testid=pw-paste-text]", "▸ Telda\n    pin code: 4455"); page.click("[data-testid=pw-paste-read]"); page.click("[data-testid=pw-review-save]"); page.wait_for_timeout(300)
        check(page.locator("[data-testid=pw-count]" + V).inner_text().strip() == "6", "%d: a second paste adds 1 (6)" % w)
        page.click("[data-testid=pw-undo]"); page.wait_for_timeout(300)
        check(page.locator("[data-testid=pw-count]" + V).inner_text().strip() == "5", "%d: Undo takes it back (5)" % w)
        check(page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"), "%d: nothing sideways" % w)
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
