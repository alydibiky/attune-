"""v10.9.3 — Ali's OK-BK (23 Nov 2026), his note on BK1: "make me able to see the message or the notifications that were saved and saved to
what" + BK2 (a live line on Money). On the real pages, at a phone (390) and a computer (1366):
  1. Money has the line "Reading bank messages · 1 today · last HH:MM" (green); tapping it opens "Read from your messages";
  2. each message is listed with its FULL text and where it went ("→ Money · Food · Talabat · 312 EGP"); one still waiting has Add to Money;
     a balance-only SMS is greyed with why ("Only a balance — no money moved");
  3. ✎ Change opens that payment's sheet in Money; Add to Money saves the waiting one; Undo takes the saved one out of Money;
  4. Android paused the reader → the line turns amber with "Fix it now", which reconnects the reader;
  5. Set up your life → the bank row's "See what was read" opens the same list; attune-open {mode: readlog} (the BK3 notification) too;
  6. nothing sideways, and the sheet's background is solid (never see-through over the page).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1093readlog.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime.now().replace(second=0, microsecond=0)
now = int(NOW.timestamp() * 1000)
today = NOW.strftime("%Y-%m-%d")
TAL = "CIB: Purchase of EGP 312.00 at TALABAT on card **4417 — %s" % NOW.strftime("%d/%m")
LEDGER = {"currency": "EGP", "accounts": [{"id": "a1", "name": "Cash", "currency": "EGP"}], "ui": {"v613": 1}, "recurring": [],
          "txns": [{"id": "t1", "type": "expense", "amount": 312, "cat": "food", "note": "Talabat", "date": today, "account": "a1", "source": "notification",
                    "created": now - 20 * 60000, "evidence": {"text": TAL, "from": "CIB", "app": "Messages", "ts": now - 20 * 60000}}]}
QUEUE = [{"id": "q-bal", "pkg": "com.google.android.apps.messaging", "app": "Messages", "title": "NBE", "text": "Your available balance is EGP 12,450.75 as of %s" % NOW.strftime("%d/%m"), "ts": now - 40 * 60000},
         {"id": "q-uber", "pkg": "com.google.android.apps.messaging", "app": "Messages", "title": "CIB",
          "text": "Your debit card ending 4417 was charged EGP 96.00 at UBER on %s." % NOW.strftime("%d/%m"), "ts": now - 5 * 60000}]
def mock(live):
    return ("(() => { const q = %s; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.payAvailable = () => true; N.payAccess = () => true; N.openPayAccess = () => {};"
            " N.payQueue = () => JSON.stringify(q.filter((x) => !(window.__forgot || []).includes(x.id))); N.payForget = (ids) => { window.__forgot = [...(window.__forgot || []), ...JSON.parse(ids)]; };"
            " N.smsDiag = () => JSON.stringify({ live: %s, smsSwitch: true, seen: Date.now() - %d, conn: Date.now() - 86400000, sms: [] });"
            " N.payRescan = () => { window.__rescans = (window.__rescans || 0) + 1; return 3; }; N.listenerHeal = () => { window.__heals = (window.__heals || 0) + 1; return true; }; } w(); })();"
            % (json.dumps(QUEUE), "true" if live else "false", 60000 if live else 9 * 3600000))
# (automatic saving off here, so one payment stays waiting for "Add to Money"; it is on by default and tested elsewhere)
INIT = ("try{if(window===window.top&&!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('ledger.v3',%s);}"
        "localStorage.setItem('attune:paylog:auto','0');localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));}catch(e){};" % json.dumps(json.dumps(LEDGER)))
def go(page, mode, sel):
    page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_selector(sel, timeout=10000); page.wait_for_timeout(400)
V = " >> visible=true"
with sync_playwright() as p:
    br = p.chromium.launch()
    for w in (390, 1366):
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + mock(True))
        page.set_viewport_size({"width": w, "height": 860}); page.goto(env.url); page.wait_for_timeout(2500)
        go(page, "money", "[data-testid=money-live]" + V)
        line = page.locator("[data-testid=money-live]" + V)
        check(line.get_attribute("data-tone") == "ok" and "1 today" in line.inner_text(), "%d: Money's line — green, \"%s\"" % (w, line.inner_text().strip()))
        page.locator("[data-testid=money-live-open]" + V).first.click(); page.wait_for_selector("[data-testid=readlog]", timeout=5000); page.wait_for_timeout(300)
        rows = page.evaluate("() => [...document.querySelectorAll('[data-testid=readlog-row]')].map((r) => [r.dataset.kind, r.innerText])")
        kinds = sorted(k for k, _ in rows)
        check(kinds == ["left", "saved", "waiting"], "%d: three messages, each once — %s" % (w, kinds))
        saved = next((t for k, t in rows if k == "saved"), "")
        check(TAL in saved and "→" in saved and "Talabat" in saved and "312" in saved, "%d: the saved one — its full message and where it went: %s" % (w, saved.replace("\n", " | ")[:160]))
        left = next((t for k, t in rows if k == "left"), "")
        check("balance" in left.lower() and "no money moved" in left, "%d: the balance SMS is greyed with why" % w)
        check(page.evaluate("() => { const r = document.querySelector('[data-testid=readlog] [role=dialog]'); const c = getComputedStyle(r).backgroundColor; const a = c.match(/rgba?\\(([^)]+)\\)/)[1].split(',').map(Number); return a.length < 4 || a[3] >= 0.97; }"),
              "%d: the sheet has a solid background" % w)
        check(page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"), "%d: nothing sideways" % w)
        # ✎ Change → the payment's own sheet in Money
        page.click("[data-testid=readlog-change]"); page.wait_for_timeout(700)
        check(page.locator("[data-testid=readlog]").count() == 0 and page.locator("[data-testid=money-tx-sheet]").count() == 1, "%d: ✎ Change opens that payment in Money" % w)
        page.keyboard.press("Escape"); page.wait_for_timeout(200)
        if page.locator("[data-testid=money-tx-sheet]").count(): page.click("[data-testid=money-tx-sheet] [data-testid=sheet-close]")
        # the BK3 notification's tap: attune-open readlog
        go(page, "readlog", "[data-testid=readlog]")
        page.click("[data-testid=readlog-add]"); page.wait_for_timeout(400)
        L = json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
        check(any(abs(t["amount"] - 96) < 0.01 and t.get("source") == "notification" for t in L["txns"]), "%d: Add to Money saved the waiting Uber 96" % w)
        check(page.locator("[data-testid=readlog-row][data-kind=waiting]").count() == 0 and page.locator("[data-testid=readlog-row][data-kind=saved]").count() == 2,
              "%d: …and it now shows as saved, with where it went" % w)
        page.locator("[data-testid=readlog-row][data-kind=saved]", has_text="TALABAT").locator("[data-testid=readlog-undo]").click(); page.wait_for_timeout(400)
        L = json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))
        check(not any(t["id"] == "t1" for t in L["txns"]), "%d: Undo took Talabat 312 out of Money" % w)
        page.keyboard.press("Escape"); page.wait_for_timeout(300)
        check(page.locator("[data-testid=readlog]").count() == 0, "%d: Esc closes it" % w)
        # Set up your life → the bank row → See what was read
        go(page, "setup", "[data-testid=setup-page]")
        if page.locator("[data-testid=bank-working-read]").count():
            page.click("[data-testid=bank-working-read]"); page.wait_for_timeout(400)
            check(page.locator("[data-testid=readlog]").count() == 1, "%d: Set up's bank row → See what was read opens the list" % w)
            page.keyboard.press("Escape")
        else:
            check(False, "%d: Set up's bank row shows See what was read" % w)
        ctx.close()
        # Android paused the reader → amber + Fix it now
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + mock(False))
        page.set_viewport_size({"width": w, "height": 860}); page.goto(env.url); page.wait_for_timeout(2500)
        go(page, "money", "[data-testid=money-live]" + V)
        line = page.locator("[data-testid=money-live]" + V)
        check(line.get_attribute("data-tone") == "warn" and line.get_attribute("data-state") == "asleep" and "paused" in line.inner_text(), "%d: paused → amber: \"%s\"" % (w, line.inner_text().strip().replace("\n", " ")))
        page.locator("[data-testid=money-live-fix]" + V).click(); page.wait_for_timeout(300)
        check(page.evaluate("() => (window.__rescans || 0) + (window.__heals || 0)") >= 1, "%d: Fix it now reconnects / reads again" % w)
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
