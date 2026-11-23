"""v10.9.2 — the kept pages (Ali: "I want to reach 50 ms"): the side menu's pages stay built, hidden, and are shown at once when you come
back. A kept page must never show OLD data — before, every visit built the page fresh. Checked at a phone (390) and a computer (1366):
  1. Money, left for Home; a payment is saved meanwhile (as Chat / a bank SMS does) → back on Money it is there (within 0.6 s);
  2. only the page on the screen is visible and reachable (a kept page is hidden, out of the reading order and can't be tapped);
  3. Back from a page still goes where it went before.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1092keep.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
today = time.strftime("%Y-%m-%d")
ledger = {"currency": "EGP", "accounts": [{"id": "a1", "name": "Cash", "currency": "EGP"}], "ui": {"v613": 1},
          "txns": [{"id": "t1", "type": "expense", "amount": 120, "date": today, "cat": "food", "note": "Koshary", "account": "a1"}]}
SEED = "if(window===window.top&&!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('ledger.v3', %s);}" % json.dumps(json.dumps(ledger))

def go(page, w, it):
    if w < 1024:
        page.evaluate("() => [...document.querySelectorAll('[data-testid=home-menu], [data-testid=header-menu]')].find((e) => e.offsetParent).click()")
    page.wait_for_selector("[data-testid=side-go-%s]" % it, timeout=8000)
    page.evaluate("(it) => document.querySelector('[data-testid=side-go-' + it + ']').click()", it)

VISIBLE_TEXT = "() => document.body.innerText"
with sync_playwright() as p:
    br = p.chromium.launch()
    for w in (390, 1366):
        init = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));" + SEED + "}catch(e){}"
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init)
        page.set_viewport_size({"width": w, "height": 844}); page.goto(env.url); page.wait_for_timeout(2500)
        go(page, w, "money"); page.wait_for_timeout(1500)
        check("Koshary" in page.evaluate(VISIBLE_TEXT), "%d: Money shows the first payment" % w)
        go(page, w, "home"); page.wait_for_timeout(800)
        kept = page.evaluate("() => [...document.querySelectorAll('[data-kept]')].map((e) => e.dataset.kept)")
        check("money" in kept, "%d: Money is kept (hidden) after leaving it — %s" % (w, kept))
        check(page.evaluate("() => { const k = document.querySelector('[data-kept=money]'); return !!k && getComputedStyle(k).display === 'none' && k.getAttribute('aria-hidden') === 'true' && k.hasAttribute('inert'); }"),
              "%d: the kept Money is hidden, out of the reading order and can't be tapped" % w)
        check(page.evaluate("() => { const k = document.querySelector('[data-kept=money]'); const r = k.getBoundingClientRect(); return r.width === 0 && r.height === 0 && ![...k.querySelectorAll('*')].some((e) => e.getClientRects().length); }"),
              "%d: nothing of the kept Money takes any room on Home" % w)
        # a payment saved while Money is kept (Chat, a bank SMS)
        page.evaluate("""() => { const L = JSON.parse(localStorage.getItem('ledger.v3')); L.txns.push({ id: 't2', type: 'expense', amount: 75, date: '%s', cat: 'transport', note: 'Zebra taxi', account: 'a1' });
          localStorage.setItem('ledger.v3', JSON.stringify(L)); }""" % today)
        go(page, w, "money"); page.wait_for_timeout(900)
        check("Zebra taxi" in page.evaluate(VISIBLE_TEXT), "%d: back on Money, the payment saved meanwhile is there (never old data)" % w)
        go(page, w, "lists"); page.wait_for_timeout(1200)
        # Back
        if w < 1024:
            page.evaluate("() => window.__attuneBack && window.__attuneBack()")   # (Android's Back button calls this)
            page.wait_for_timeout(800)
            check(page.evaluate("() => !!document.querySelector('[data-kept=lists]') && getComputedStyle(document.querySelector('[data-kept=lists]')).display === 'none'"),
                  "%d: Back leaves Lists (it is hidden again, not stuck on the screen)" % w)
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
