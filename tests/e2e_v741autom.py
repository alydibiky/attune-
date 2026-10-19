"""v6.41 C3 Automations: a sentence becomes a rule (handed to the phone); the phone's fired event (a salary notification) puts
20% in the pot when Attune opens, read with Money's own reader; the Home box makes one too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v741autom.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = ("try{localStorage.setItem('attune:start','home')}catch(e){}"
        "(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); window.__saved = []; window.__q = [];"
        "N.autoSave = function (j) { window.__saved.push(JSON.parse(j)); }; N.autoTake = function () { var q = window.__q; window.__q = []; return JSON.stringify(q); };"
        "N.payAccess = function () { return true; }; })();")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'automations'}}))")
    page.wait_for_selector("[data-testid=auto-page]", timeout=5000)
    page.fill("[data-testid=auto-text]", "لما المرتب ينزل حط 20% في صندوق العربية وقولي")
    check("20% في «العربية»" in page.locator("[data-testid=auto-draft]").inner_text(), "the sentence is read: " + page.locator("[data-testid=auto-draft]").inner_text())
    page.click("[data-testid=auto-add]"); page.wait_for_timeout(200)
    last = page.evaluate("window.__saved[window.__saved.length - 1]")
    r = last["rules"][0]
    check(r["pct"] == 20 and r["pot"] == "العربية" and "salary" in r["words"] and r["on"], "the rule goes to the phone: %s" % r)
    # the phone fired it while Attune was in the background: a salary notification
    page.evaluate("(id) => { window.__q.push({ id: 'cib:1:x:' + id, rule: id, pkg: 'com.cib', app: 'CIB', title: 'CIB', text: 'Your account has been credited with EGP 18,000.00 Salary October', ts: Date.now() }); }", r["id"])
    page.evaluate("() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }")
    page.wait_for_timeout(300)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'automations'}}))")
    page.wait_for_selector("[data-testid=auto-pot]", timeout=5000)
    pot = page.locator("[data-testid=auto-pot]").first.inner_text()
    check("العربية" in pot and "3,600" in pot, "18,000 × 20% = 3,600 in the pot: " + pot.replace("\n", " "))
    check("of 18,000" in page.locator("[data-testid=auto-log]").inner_text(), "the log says what it came from")
    # the same event again is not counted twice
    page.evaluate("(id) => { window.__q.push({ id: 'cib:1:x:' + id, rule: id, text: 'Your account has been credited with EGP 18,000.00 Salary October', ts: Date.now() }); }", r["id"])
    page.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); page.wait_for_timeout(300)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'automations'}}))"); page.wait_for_timeout(300)
    check("3,600" in page.locator("[data-testid=auto-pot]").first.inner_text(), "the same notification twice → counted once")
    page.click("[data-testid=auto-toggle]"); page.wait_for_timeout(100)
    check(page.evaluate("window.__saved[window.__saved.length - 1].rules[0].on") is False, "switching it off tells the phone")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
