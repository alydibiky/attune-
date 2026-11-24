"""v10.9.7 — Ali's OK-FM (24 Nov 2026, https://claude.ai/artifact/SRbHba7CwMVSndiLqD7LX7): the first minute, at a phone (390) and a computer
(1366), with the phone faked: Gmail returns Ali's 4 real screenshots' text as emails (PayPal Dash Networks / Enzu, Anthropic Claude Pro,
the Enzu invoice, Google Play Google One), the SMS inbox holds 3 bank messages (Carrefour, Talabat, the ANTHROPIC charge in dollars).
  S1 two sources, both on · S2 reading · S3 the month (7,135.46), the subscriptions with their sources, the Enzu invoice asked
  ("same plan?") before anything is saved · S4 ✎ (category, the message it came from, learned per sender) · All right → Money + Dates,
  Undo · S5 what next. "Not now — let me type" in the first-run screens goes to the typing screens (Organise this).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1097firstmin.py
"""
import json, time, re
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
import subprocess
env = Env(); errors = []
now = int(time.time() * 1000)
# Ali's real screenshots as emails (tests/scan/real/ali-2026-11-23.mjs), dated in the last hours so they are "this month"
import os
_FIX = "file://" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "scan", "real", "ali-2026-11-23.mjs")   # (run_all starts tests from another folder)
REAL = json.loads(subprocess.check_output(["node", "-e", "import(%s).then(m => console.log(JSON.stringify(m.REAL)))" % json.dumps(_FIX)], text=True))
FROM = {"paypal-enzu": "PayPal <service@paypal.com>", "anthropic-claude-pro": "Anthropic, PBC <invoice+statements@mail.anthropic.com>", "enzu-invoice-due": "Enzu Billing <billing@enzu.com>", "google-play-ai-pro": "Google Play <googleplay-noreply@google.com>"}
EMAILS = [{"id": r["id"], "kind": "email", "from": FROM[r["id"]], "title": r["text"].split("\n")[0], "text": r["text"], "at": now - (i + 1) * 3600000, "link": ""} for i, r in enumerate(REAL)]
SMS = [{"id": "sm1", "title": "CIB", "text": "Your credit card ending 2969 was charged for EGP 1,240.00 at CARREFOUR MAADI", "ts": now - 2 * 3600000},
       {"id": "sm2", "title": "CIB", "text": "Your credit card ending 2969 was charged for EGP 185.00 at TALABAT", "ts": now - 3 * 3600000},
       {"id": "sm3", "title": "CIB", "text": "Your credit card ending 2969 was charged for USD 22.80 at ANTHROPIC", "ts": now - 2 * 3600000 + 60000}]
def init(onboard):
    # (the harness marks every page onboarded — a new phone takes that away once, like tests/e2e_v930first.py)
    pre = "localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));" + ("if(!sessionStorage.getItem('t-fresh')){sessionStorage.setItem('t-fresh','1');localStorage.removeItem('attune:onboarded');}" if onboard else "localStorage.setItem('attune:onboarded','1');localStorage.setItem('attune:country','eg');")   # (Ali's country — on the phone the first screen picks it)
    return "try{" + pre + "}catch(e){}\n" + r"""(() => { const S = window.__fm = { gm: [] };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.gmailRead = (id, arg) => { S.gm.push(JSON.parse(arg)); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ emails: %s })), 30); };
    N.smsInboxState = () => JSON.stringify({ granted: true }); N.smsInboxMoney = (days) => JSON.stringify(%s); N.smsInboxAsk = () => {};
  }; go(); })();""" % (json.dumps(EMAILS), json.dumps(SMS))
V = " >> visible=true"
with sync_playwright() as p:
    br = p.chromium.launch()
    for w in (390, 1366):
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(w == 390))
        page.set_viewport_size({"width": w, "height": 860}); page.goto(env.url); page.wait_for_timeout(2500)
        if w == 390:   # a new phone: the first-run screen → Next → the money's first minute
            page.wait_for_selector("[data-testid=first-minute]", timeout=10000); page.click("[data-testid=first-next]"); page.wait_for_timeout(300)
        else:          # someone already using Attune: Set up your life → "Organise my month from my messages"
            page.evaluate("window.dispatchEvent(new CustomEvent('attune-firstmin'))"); page.wait_for_timeout(400)
        page.wait_for_selector("[data-testid=fm][data-step=ask]", timeout=8000)
        check(page.locator("[data-testid=fm-src-sms][aria-pressed=true]").count() == 1 and page.locator("[data-testid=fm-src-gmail][aria-pressed=true]").count() == 1, "%d: S1 — bank messages AND Gmail, both on" % w)
        page.click("[data-testid=fm-go]"); page.wait_for_selector("[data-testid=fm][data-step=month]", timeout=10000)
        check(page.evaluate("window.__fm.gm[0] && window.__fm.gm[0].days") == 365, "%d: Gmail read once by itself, the last year (no export)" % w)
        tot = page.inner_text("[data-testid=fm-total]")
        check("7,135.46" in tot, "%d: S3 — this month 7,135.46 EGP (Carrefour 1,240 + Talabat 185 + Dash Networks 3,531.67 + Claude 22.80 USD at Ali's own PayPal rate + Google One 939.99): %s" % (w, tot.replace("\n", " · ")[:160]))
        check("found in both, counted once" in tot, "%d: the ANTHROPIC card SMS and the Claude receipt are one payment" % w)
        chk = page.locator("[data-testid=fm-check][data-q=same]")
        check(chk.count() == 1 and "Enzu" in chk.inner_text() and "Dash Networks" in chk.inner_text(), "%d: Check this one — the Enzu invoice and the PayPal Dash Networks payment: same plan?" % w)
        check(page.locator("[data-testid=fm-ok]").is_disabled(), "%d: nothing is saved before the question is answered" % w)
        subs = page.inner_text("[data-testid=fm-subs]")
        check("Claude" in subs and "Google One" in subs and "Gmail" in subs and "SMS" in subs, "%d: subscriptions with where each came from: %s" % (w, subs.replace("\n", " · ")[:200]))
        chk.locator("[data-testid=fm-check-answer]").first.click(); page.wait_for_timeout(300)   # Yes, same
        subs = page.inner_text("[data-testid=fm-subs]")
        check("68,525.52" in subs and "Dash Networks" in subs, "%d: Yes, same → Enzu is a monthly plan: 5,710.46 a month = 68,525.52 a year: %s" % (w, subs.replace("\n", " · ")[:140]))
        # ✎ Talabat → Groceries, the message it came from, saved and learned
        row = page.locator("[data-testid=fm-line]", has_text="TALABAT")
        row.locator("[data-testid=fm-edit]").click(); page.wait_for_selector("[data-testid=fm-edit-name]")
        page.click("[data-testid=fm-edit-show]"); check("charged for EGP 185.00 at TALABAT" in page.inner_text("[data-testid=fm-edit-msg]"), "%d: ✎ → the whole message it came from" % w)
        page.select_option("[data-testid=fm-edit-cat]", "groceries"); page.click("[data-testid=fm-edit-save]"); page.wait_for_timeout(250)
        learn = page.evaluate("JSON.parse(localStorage.getItem('attune:fm:learn:v1') || '{}')")
        check(any(v.get("cat") == "groceries" for v in learn.values()), "%d: the fix is learned for that sender: %s" % (w, learn))
        led0 = page.evaluate("(JSON.parse(localStorage.getItem('ledger.v3') || 'null') || {txns: []}).txns.length")
        page.click("[data-testid=fm-ok]"); page.wait_for_selector("[data-testid=fm-done]", timeout=5000)
        led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3'))")
        new = led["txns"][led0:]
        notes = sorted(t["note"] for t in new)
        cl = [t for t in new if "Claude" in t["note"]]
        check(len(new) == 5 and cl and "22.80 USD" in cl[0]["note"] and abs(cl[0]["amount"] - 1238.8) < 0.01, "%d: All right → 5 payments in Money, in pounds (Claude · 22.80 USD): %s" % (w, notes))
        tal = [t for t in new if "TALABAT" in t["note"]]
        check(tal and tal[0]["cat"] == "groceries" and tal[0].get("evidence", {}).get("text", "").startswith("Your credit card"), "%d: Talabat kept its new category and its message" % w)
        radar = page.evaluate("JSON.parse(localStorage.getItem('attune:radar:v1') || '{\"items\":[]}').items")
        ren = sorted(x["title"] for x in radar if x["kind"] == "renewal")
        check(len(ren) == 3 and any("Claude" in t for t in ren) and any("Dash" in t for t in ren), "%d: 3 plans in Dates as renewals: %s" % (w, ren))
        page.click("[data-testid=fm-undo]"); page.wait_for_timeout(300)
        led2 = page.evaluate("(JSON.parse(localStorage.getItem('ledger.v3') || 'null') || {txns: []}).txns.length")
        check(led2 == led0 and page.locator("[data-testid=fm][data-step=month]").count() == 1, "%d: Undo takes it all back" % w)
        page.click("[data-testid=fm-ok]"); page.wait_for_selector("[data-testid=fm-done]", timeout=5000)
        check(page.locator("[data-testid=fm-next-passwords]").count() == 1 and page.locator("[data-testid=fm-next-life]").count() == 1, "%d: S5 — what next, after the win" % w)
        check(page.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1"), "%d: nothing sideways" % w)
        page.click("[data-testid=fm-home]"); page.wait_for_timeout(400)
        check(page.locator("[data-testid=fm]").count() == 0, "%d: Later → Home" % w)
        ctx.close()
    # "Not now — let me type" on a new phone → the typing screens (Organise this)
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(True))
    page.set_viewport_size({"width": 390, "height": 860}); page.goto(env.url); page.wait_for_selector("[data-testid=first-minute]", timeout=10000)
    page.click("[data-testid=first-next]"); page.wait_for_selector("[data-testid=fm-type]"); page.click("[data-testid=fm-type]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=first-minute][data-step='1']").count() == 1, "Not now — let me type → What should Attune do first? (the typing screens)")
    ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
