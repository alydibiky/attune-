"""v10.9.1 + v10.9.2 — Ali, 23 Nov 2026: "the app still is very very laggy and pressing on the sidebar and choosing other things is still
shit", then: "I want to reach 50 ms minimum".
Measured with 8,000 payments in Money and the CPU slowed 4× (a phone), the time from a tap to the next drawn frame:
  v10.9    the side menu ~125 ms; Money 322 ms; Home 437 ms; a 58 ms freeze every few seconds on an idle Home (the Set up driver parsed all
           of Money every 1.5 s)
  v10.9.1  stores parsed once per change, the driver quiet: Money ~200, Home ~260, idle freezes 0
  v10.9.2  the page is frozen while the menu opens (menu ~30 ms); the main pages are KEPT built — hidden and frozen when you leave, shown
           at once when you come back, brought up to date a moment later; the side menu's pages are built quietly after Attune opens
           (pausing whenever a finger is on the screen) → every side-menu page ~20–40 ms, the first time too.
This test keeps it there, at a phone (390) and a computer (1366) size:
  1. 15 s idle on Home: no long task (> 50 ms) — before the background build starts;
  2. the menu opens in < 50 ms (median, phone);
  3. every side-menu page shows in < 50 ms when you come back to it (median of 3);
  4. with the background build done, the FIRST tap on a side-menu page: median < 50 ms, none over 100 ms (the first showing of a page is
     also its first layout, which can't be done ahead while it is hidden — said honestly);
  5. opening Money does not write the ledger back when nothing changed; a kept page is not re-built (Money's frame is loaded once).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1091speed.py
"""
import json, time, statistics
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
txns = [{"id": "t%d" % i, "type": "expense", "amount": 50 + i, "date": "2026-%02d-%02d" % (1 + (i % 11), 1 + (i % 27)), "cat": ["food", "transport", "bills", "fun"][i % 4],
         "note": "Shop %d" % (i % 40), "source": "notification" if i % 3 == 0 else "manual"} for i in range(8000)]
ledger = {"currency": "EGP", "accounts": [{"id": "a1", "name": "Cash"}], "txns": txns, "ui": {"v613": 1}}   # (v613: the one-time Money upgrade already done)
# (only in the top page: an init script also runs inside Money's own frame, and re-seeding there on every open looked like a write)
SEED = "if(window===window.top&&!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('ledger.v3', %s);}" % json.dumps(json.dumps(ledger))
COUNT = (";try{const s0=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){try{if(k==='ledger.v3'&&window.top.__count)window.top.__writes=(window.top.__writes||0)+1;}catch(e){}return s0.apply(this,arguments);};}catch(e){}"
         ";try{if(window!==window.top&&window.top.__count&&window.frameElement&&window.frameElement.getAttribute('data-testid')==='money-yusr')window.top.__frames=(window.top.__frames||0)+1;}catch(e){}")
SIDE = ["money", "lists", "timeline", "agents", "shelf", "care", "travel", "tools", "home"]
OPEN_MENU = """() => new Promise((r) => { const b = [...document.querySelectorAll('[data-testid=home-menu], [data-testid=header-menu]')].find((e) => e.offsetParent);
  const t = performance.now(); b.click(); requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - t))); })"""
TAP = """(it) => new Promise((r) => { const t = performance.now(); document.querySelector('[data-testid=side-go-' + it + ']').click();
  requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - t))); })"""

def start(br, w, prewarm):
    init = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));" + SEED +
            ("localStorage.setItem('attune:test:prewarm','1');" if prewarm else "") +
            "localStorage.setItem('attune:theme:v1',JSON.stringify({a43:1,v87:1,v95:1,accent:'rose',bg:'zinc',look:'glass'}))}catch(e){}" + COUNT)
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init)
    page.set_viewport_size({"width": w, "height": 844}); page.goto(env.url); page.wait_for_timeout(2500)
    cdp = ctx.new_cdp_session(page); cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4 if w < 1024 else 2})   # (a phone: 4× slower; a computer: 2×, still slower than a real one); page.wait_for_timeout(500)
    return ctx, page

def tap(page, w, it):
    menu = None
    if w < 1024:
        menu = page.evaluate(OPEN_MENU)
    page.wait_for_selector("[data-testid=side-go-%s]" % it, timeout=8000); page.wait_for_timeout(250)
    ms = page.evaluate(TAP, it); page.wait_for_timeout(500)
    return menu, ms

with sync_playwright() as p:
    br = p.chromium.launch()
    for w in (390, 1366):
        # 1–3, 5: no background build (the browser tests' default) — pages kept once visited
        ctx, page = start(br, w, False)
        page.wait_for_timeout(3500)   # (Money's engine is prepared once, 3.5 s after Attune opens — one task, not a repeating one)
        page.evaluate("() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); }")
        page.wait_for_timeout(15000)
        lt = page.evaluate("() => window.__lt")
        check(not lt, "%d: 15 s idle on Home with 8,000 payments — no freeze at all (long tasks: %s)" % (w, lt[:5]))
        page.evaluate("() => { window.__writes = 0; window.__frames = 0; window.__count = 1; }")
        menus, times = [], {it: [] for it in SIDE}
        for rnd in range(4):
            for it in SIDE:
                m, ms = tap(page, w, it)
                if rnd:
                    times[it].append(ms)
                    if m is not None: menus.append(m)
        if menus:
            check(statistics.median(menus) < 50, "%d: the side menu opens in %d ms (median; CPU 4×; was ~125)" % (w, statistics.median(menus)))
        slow = {it: round(statistics.median(a)) for it, a in times.items() if statistics.median(a) >= 50}
        check(not slow, "%d: every side-menu page shows in < 50 ms when you come back (median; CPU 4× phone / 2× computer) — %s" % (w, {it: round(statistics.median(a)) for it, a in times.items()}))
        wr, fr = page.evaluate("() => [window.__writes, window.__frames]")
        check(wr == 0, "%d: opening Money 4 times wrote the ledger back %d times (nothing changed → 0)" % (w, wr))
        check(fr <= 2, "%d: Money's ledger frame was loaded %d time(s) over 4 visits (kept; built again at most once, after the first round's one-time saves)" % (w, fr))
        ctx.close()
        # 4: the background build — the first tap on every side-menu page
        ctx, page = start(br, w, True)
        page.wait_for_function("() => document.querySelectorAll('[data-kept]').length >= 8", timeout=60000)
        page.wait_for_timeout(1500)
        first = {}
        for it in SIDE:
            m, ms = tap(page, w, it); first[it] = round(ms)
        # (the first time a page is shown the browser lays it out for the first time — that can't be done ahead while it is hidden)
        med = statistics.median(first.values())
        check(med < 50 and max(first.values()) < 100, "%d: built in the background → the FIRST tap on a page: median %d ms (< 50), slowest %d ms (< 100) — %s" % (w, med, max(first.values()), first))
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
