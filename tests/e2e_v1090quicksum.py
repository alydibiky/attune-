"""v10.9 S1 (Ali: "make the speed much faster"): everyday sums in Chat are answered by code at once — no model request — phone and computer,
Arabic and English; a spending sentence is still saved in Money, not "calculated".
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1090quicksum.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}))}catch(e){}\n"
        "(() => { function w(){ const N = window.AttuneNative; if (!N || !window.__mock) return setTimeout(w, 5);"
        " window.__mock.engine = { ...window.__mock.engine, state: 'ready', modelId: 'test-model' };"
        " window.dispatchEvent(new CustomEvent('attune-engine', { detail: { ...window.__mock.engine } })); } w(); })();")
CASES = [("إيجار ونش 3 أيام بـ 12,500 في اليوم وعليهم 14٪ ضريبة، المجموع كام؟", "42,750"), ("عندي ٢٢٠٠٠ هقسمهم على ٩ شهور، كام كل شهر؟", "2,444.44"),
         ("A jacket is 1,800 after a 25% discount. What was the price before?", "2,400"), ("If I save 2,500 a month, how many months to reach 60,000?", "24")]
with sync_playwright() as p:
    br = p.chromium.launch()
    for size, desk in (("phone", None), ("computer", (1366, 900))):
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=desk, extra_init=INIT)
        if not desk: page.set_viewport_size({"width": 390, "height": 844})
        page.goto(env.url); page.wait_for_timeout(1500)
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_selector("textarea[placeholder='Message Attune']", timeout=15000)
        for q, want in CASES:
            page.evaluate("() => { window.__mock.bodies = []; window.__mock.fakeQueue = ['WRONG 1']; }")
            t0 = time.time()
            page.locator("textarea[placeholder='Message Attune']").fill(q); page.locator("button[title='Send']").click()
            try: page.wait_for_function("(w) => document.body.innerText.includes(w)", arg=want, timeout=5000)
            except Exception: pass
            secs = time.time() - t0
            b = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 8)")
            check(want in page.locator("body").inner_text() and not b and secs < 3, "%s: «%s» → %s in %.1f s, no model request (%d)" % (size, q[:40], want, secs, len(b)))
        # a spending sentence is still money, not a sum
        page.locator("textarea[placeholder='Message Attune']").fill("صرفت 150 على الغدا"); page.locator("button[title='Send']").click(); page.wait_for_timeout(1200)
        tx = page.evaluate("() => (JSON.parse(localStorage.getItem('ledger.v3') || '{}').txns || []).slice(-1)[0] || null")
        check(tx and tx["amount"] == 150, "%s: «صرفت 150 على الغدا» is still saved in Money (%s)" % (size, tx and tx.get("amount")))
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
