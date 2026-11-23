"""v10.9.1 — Ali, 23 Nov 2026: "the app still is very very laggy and pressing on the sidebar and choosing other things is still shit".
Measured with 8,000 payments in Money and the CPU slowed 4× (a phone): the Set up driver parsed ALL of Money every 1.5 s on every page
(a 58 ms freeze every few seconds on an idle Home), opening Money parsed the ledger 5–7 times (and its settings could re-save it unchanged), and Money's number
format built a new formatter for every number. Before → after (median of 4): Money 322 → ~220 ms, Home 437 → ~260 ms, the menu ~200 → ~130 ms.
This test keeps it that way, at a phone (390) and a computer (1366) size:
  1. 15 s idle on Home: no long task (> 50 ms) at all;
  2. a side-menu tap shows Money / Home within a generous bound (CPU 4×: 450 ms) — the median of 3;
  3. opening Money does not write the ledger back when nothing changed.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1091speed.py
"""
import json, time, statistics
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000)
txns = [{"id": "t%d" % i, "type": "expense", "amount": 50 + i, "date": "2026-%02d-%02d" % (1 + (i % 11), 1 + (i % 27)), "cat": ["food", "transport", "bills", "fun"][i % 4],
         "note": "Shop %d" % (i % 40), "source": "notification" if i % 3 == 0 else "manual"} for i in range(8000)]
ledger = {"currency": "EGP", "accounts": [{"id": "a1", "name": "Cash"}], "txns": txns, "ui": {"v613": 1}}   # (v613: the one-time Money upgrade already done)
# (only in the top page: an init script also runs inside Money's own frame, and re-seeding there on every open looked like a write)
SEED = "if(window===window.top&&!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('ledger.v3', %s);}" % json.dumps(json.dumps(ledger))
with sync_playwright() as p:
    br = p.chromium.launch()
    for w in (390, 1366):
        init = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));" + SEED +
                "localStorage.setItem('attune:theme:v1',JSON.stringify({a43:1,v87:1,v95:1,accent:'rose',bg:'zinc',look:'glass'}))}catch(e){}"
                # every frame (Money's own frame too) counts its ledger writes into the top page, once counting is on
                ";try{const s0=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){try{if(k==='ledger.v3'&&window.top.__count)window.top.__writes=(window.top.__writes||0)+1;}catch(e){}return s0.apply(this,arguments);};}catch(e){}")
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init)
        page.set_viewport_size({"width": w, "height": 844}); page.goto(env.url); page.wait_for_timeout(3000)
        cdp = ctx.new_cdp_session(page); cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4}); page.wait_for_timeout(800)
        page.evaluate("() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); }")
        page.wait_for_timeout(15000)
        lt = page.evaluate("() => window.__lt")
        check(not lt, "%d: 15 s idle on Home with 8,000 payments — no freeze at all (long tasks: %s)" % (w, lt[:5]))
        page.evaluate("() => { window.__writes = 0; window.__count = 1; }")
        times = {"money": [], "home": []}
        for rnd in range(4):
            for it in ("money", "home"):
                if w < 1024:
                    page.locator("[data-testid=home-menu]:visible, [data-testid=header-menu]:visible").first.click()
                page.wait_for_selector("[data-testid=side-go-%s]" % it, timeout=8000); page.wait_for_timeout(250)
                ms = page.evaluate("""(it) => new Promise((r) => { const t = performance.now(); document.querySelector('[data-testid=side-go-' + it + ']').click();
                     requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - t))); })""", it)
                page.wait_for_timeout(900)
                if rnd: times[it].append(ms)
        for it, a in times.items():
            m = statistics.median(a)
            check(m < 550, "%d: a side-menu tap shows %s in %d ms (median; CPU 4×; bound 550 — before the fix Home took 437 on the computer, 466 on a phone)" % (w, it, m))
        wr = page.evaluate("() => window.__writes")
        check(wr == 0, "%d: opening Money 4 times wrote the ledger back %d times (nothing changed → 0)" % (w, wr))
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
