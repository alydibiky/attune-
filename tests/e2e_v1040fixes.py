"""v10.4 — Ali's 18 Nov phone list, on the real pages, at a phone size AND a computer size:
 (2) Set up your life → "Your data kept safe" → Chat's "Turn on backup" opened the old prompt-compressor page — now the Backup panel;
 (3) "I can't press allow or tick, it does not do anything": the bank row always has a button; with bank SMS read and waiting it says
     so and "Add them to Money" ticks the step; Android paused the reader → "Fix it now"; the tick box itself is a button.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1040fixes.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime.now().replace(hour=14, minute=0, second=0, microsecond=0)
now = int(NOW.timestamp() * 1000)
CIB = {"id": "com.google.android.apps.messaging:1:1", "pkg": "com.google.android.apps.messaging", "app": "Messages", "title": "CIB",
       "text": "Your debit card ending 1234 was charged EGP 350.00 at CARREFOUR MAADI on %s. Available balance EGP 12,450.75" % NOW.strftime("%d/%m"), "ts": now - 3600000}
LEDGER = {"accounts": [{"id": "a1", "name": "Cash", "currency": "EGP"}], "txns": [], "recurring": []}
def mock(queue, live=True):
    return ("(() => { const q = %s; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.payAvailable = () => true; N.payAccess = () => true; N.openPayAccess = () => {};"
            " N.payQueue = () => JSON.stringify(q); N.payForget = () => {}; N.smsDiag = () => JSON.stringify({ live: %s, smsSwitch: true, seen: Date.now() - 60000, conn: Date.now() - 86400000, sms: [] });"
            " N.payRescan = () => { window.__rescans = (window.__rescans || 0) + 1; return 3; }; N.listenerHeal = () => true; } w(); })();" % (json.dumps(queue), "true" if live else "false"))
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:testing-pro','on');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
        "localStorage.setItem('ledger.v3',%s);}catch(e){};" % json.dumps(json.dumps(LEDGER)))
def open_setup(page):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'setup'}}))"); page.wait_for_selector("[data-testid=setup-page]", timeout=8000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    for name, size in (("phone", None), ("computer", (1366, 860))):
        # ---- (3) waiting bank SMS → Add them to Money → the step is done
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=size, extra_init=INIT + mock([CIB]))
        if not size: page.set_viewport_size({"width": 360, "height": 800})
        page.goto(env.url); page.wait_for_timeout(1500)
        open_setup(page)
        box = page.locator("[data-testid=bank-check]")
        check(box.count() == 1 and box.get_attribute("data-state") == "waiting", name + ": the bank row says the payment is waiting: " + (box.inner_text().replace("\n", " | ") if box.count() else "no box"))
        check("350" in box.inner_text() and "CIB" in box.inner_text(), name + ": …and shows it (−350 · CIB)")
        page.click("[data-testid=bank-add]"); page.wait_for_timeout(1200)
        check(page.locator("[data-testid=setup-step][data-id=bank]").get_attribute("data-done") == "1", name + ": “Add them to Money” → Bank messages ✓")
        led = json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
        check(any(t.get("source") == "notification" and t.get("amount") == 350 for t in led["txns"]), name + ": the 350 is in Money, from the bank SMS")
        # the tick box is a button: the salary box starts that step in Chat
        open_setup(page)
        page.click("[data-testid=setup-step][data-id=salary] [data-testid=setup-box]"); page.wait_for_timeout(1200)
        check("salary" in page.inner_text("body").lower(), name + ": a tap on the empty box of “Your salary day” asks the salary question")
        # ---- (2) Your data kept safe → Turn on backup → the Backup panel, never the old prompt page
        open_setup(page)
        page.click("[data-testid=setup-step][data-id=backup] [data-testid=setup-do]"); page.wait_for_timeout(1200)
        page.locator("button", has_text="Turn on backup").last.click(); page.wait_for_timeout(900)
        check(page.locator("[data-testid=backup-panel]").count() == 1, name + ": “Turn on backup” opens the Backup panel")
        check("AI Compress" not in page.inner_text("body") and "Paste a long, wordy prompt" not in page.inner_text("body"), name + ": …not the old prompt-compressor page")
        page.keyboard.press("Escape"); page.wait_for_timeout(200)
        # navTo("profile") / ("plan") the same way
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'panel:backup'}}))"); page.wait_for_timeout(600)
        check(page.locator("[data-testid=backup-panel]").count() == 1, name + ": “panel:backup” from any button opens the panel too")
        ctx.close()
        # ---- (3) Android paused the reader → Fix it now (reads the shade again)
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=size, extra_init=INIT + mock([], live=False))
        if not size: page.set_viewport_size({"width": 360, "height": 800})
        page.goto(env.url); page.wait_for_timeout(1500)
        open_setup(page)
        box = page.locator("[data-testid=bank-check]")
        check(box.get_attribute("data-state") == "asleep" and page.locator("[data-testid=bank-fix]").count() == 1, name + ": paused reader → “Fix it now”: " + box.inner_text().replace("\n", " | "))
        page.click("[data-testid=bank-fix]"); page.wait_for_timeout(500)
        check(page.evaluate("window.__rescans || 0") >= 1 and page.locator("[data-testid=bank-msg]").count() == 1, name + ": Fix reads the shade again and says so")
        wide = page.evaluate("""() => [...document.querySelectorAll('[data-testid=setup-page] *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 2 || r.left < -2); }).length""")
        check(wide == 0, name + ": nothing past the edge on the Set up page (%d)" % wide)
        ctx.close()
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
