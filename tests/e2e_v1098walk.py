"""v10.9.8 the new-user walk-through (24 Nov 2026), at a phone (390) and a computer (1366):
  1. the first-run screens are never see-through — on the computer the money screen sat transparent over Home (its colours
     were only defined inside .calm, and the first-run screens weren't) — their background is a real colour at both sizes
  2. a typical Egyptian phone (not Ali's): the first minute names the InstaPay transfer «محمد سامي» (no «بنجاح»), the cash "ATM",
     reads the Vodafone Cash top-up, and a 9.99 USD Netflix charge is saved in a dollar account — never 9.99 in the pound account
  3. Home's box: Franco "fakarny ba3d bokra el sa3a 5 adfa3 el egar" sets the reminder (it asked "What did you mean?")
  4. Chat answers from your own records: "when does my passport expire?", "what do I have tomorrow?", «أحمد عليه كام؟» (Ahmed
     saved in English letters), "how much on food?" (says Food, names Groceries)
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1098walk.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000); H = 3600000
SMS = [{"id": "w1", "title": "InstaPay", "text": "تم تحويل 1,500 جنيه إلى محمد سامي بنجاح. رقم المرجع 88213. رصيدك الحالي 12,340.50 جنيه", "ts": now - 3 * H},
       {"id": "w2", "title": "VF-Cash", "text": "تم شحن رصيد 100 جنيه لرقم 01001234567. رصيد محفظتك 230.75 جنيه", "ts": now - 2 * H},
       {"id": "w3", "title": "NBE", "text": "تم سحب مبلغ 2000 جنيه من ماكينة الصراف الآلي فرع المعادي. الرصيد المتاح 9,880 جنيه", "ts": now - 4 * H},
       {"id": "w4", "title": "CIB", "text": "Your credit card ending 7710 was charged for USD 9.99 at NETFLIX.COM", "ts": now - 5 * H}]
def init():
    return ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
            "if(!sessionStorage.getItem('t-fresh')){sessionStorage.setItem('t-fresh','1');localStorage.removeItem('attune:onboarded');}}catch(e){}\n"
            + r"""(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
  N.smsInboxState = () => JSON.stringify({ granted: true }); N.smsInboxMoney = (days) => JSON.stringify(%s); N.smsInboxAsk = () => {}; }; go(); })();""" % json.dumps(SMS))
def opaque(page, sel):
    return page.evaluate("s => { const e = document.querySelector(s); if (!e) return 'missing'; const c = getComputedStyle(e).backgroundColor; return c; }", sel)
def say(page, text):
    box = page.locator("textarea >> visible=true").first
    box.fill(text); page.wait_for_timeout(150); page.locator("button[aria-label=Send] >> visible=true").first.click(); page.wait_for_timeout(1800)
    return page.evaluate("document.body.innerText")
with sync_playwright() as p:
    br = p.chromium.launch()
    for w in (390, 1366):
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(), desktop=(w, 860) if w > 500 else None)
        if w <= 500: page.set_viewport_size({"width": w, "height": 860})
        page.goto(env.url); page.wait_for_selector("[data-testid=first-minute]", timeout=10000)
        bg = opaque(page, "[data-testid=first-minute]")
        check(bg not in ("rgba(0, 0, 0, 0)", "transparent", "missing"), "%d: the first-run screen has a real background (%s)" % (w, bg))
        page.click("[data-testid=first-next]"); page.wait_for_selector("[data-testid=fm][data-step=ask]", timeout=8000)
        bg = opaque(page, "[data-testid=fm]")
        check(bg not in ("rgba(0, 0, 0, 0)", "transparent", "missing"), "%d: the money screen is not see-through (%s)" % (w, bg))
        page.click("[data-testid=fm-go]"); page.wait_for_selector("[data-testid=fm][data-step=month]", timeout=10000)
        txt = page.inner_text("[data-testid=fm]")
        check("محمد سامي" in txt and "بنجاح" not in txt, "%d: the InstaPay transfer is «محمد سامي» (no «بنجاح»)" % w)
        check("ATM" in txt and "ماكينة" not in txt, "%d: the cash machine is 'ATM'" % w)
        check("100 EGP" in txt, "%d: the Vodafone Cash top-up (100) is read: %s" % (w, txt.replace("\n", " · ")[:200]))
        page.click("[data-testid=fm-ok]"); page.wait_for_selector("[data-testid=fm-done]", timeout=8000)
        led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3'))")
        usd = [a for a in led["accounts"] if a.get("currency") == "USD"]
        nf = [t for t in led["txns"] if t.get("note", "").startswith("NETFLIX")]
        check(len(usd) == 1 and len(nf) == 1 and nf[0]["account"] == usd[0]["id"] and nf[0]["amount"] == 9.99, "%d: Netflix 9.99 USD in a dollar account (never 9.99 EGP): %s" % (w, json.dumps(nf)[:160]))
        check(nf and nf[0]["cat"] != "transport", "%d: Netflix is not 'transport' (tfl inside neTFLix)" % w)
        page.click("[data-testid=fm-home]"); page.wait_for_timeout(1200)
        mc = page.locator("[data-testid=home-month]")
        check(mc.count() == 1 and "3,600 EGP" in mc.inner_text() and "9.99 USD" in mc.inner_text(), "%d: OK-W2 — Home shows This month: 3,600 EGP + 9.99 USD (never added together): %s" % (w, mc.inner_text().replace("\n", " · ") if mc.count() else "missing"))
        # Ali's sample records for the questions: Ahmed owes 500 (English letters), a passport, a reminder tomorrow
        page.evaluate("""() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
          localStorage.setItem('attune:life:v1', JSON.stringify({ items: [{ id: 'c1', person: 'Ahmed', currency: 'EGP', start: '', every: null, paid: [], title: '', kind: 'debt', dir: 'in', amount: 500, count: 1, total: 500, created: Date.now() - 86400000 }] }));
          localStorage.setItem('attune:radar:v1', JSON.stringify({ items: [{ id: 'p1', kind: 'doc', doc: 'passport', title: 'Passport', date: '2027-03-03', status: '' }], seen: [] }));
          const L = JSON.parse(localStorage.getItem('ledger.v3')); const day = new Date().toISOString().slice(0, 10);
          L.txns.push({ id: 'g1', type: 'expense', amount: 85, cat: 'groceries', account: L.accounts[0].id, date: day, note: 'عيش وجبنة' }); localStorage.setItem('ledger.v3', JSON.stringify(L));
          localStorage.setItem('attune:reminders:v1', JSON.stringify([{ id: 'r1', at: d.getTime(), title: 'call the bank', body: '', repeat: 'none', created: Date.now(), source: 'home' }])); }""")
        page.reload(); page.wait_for_timeout(2500)
        t = say(page, "fakarny ba3d bokra el sa3a 5 adfa3 el egar")
        rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1') || '[]')")
        check(any("إيجار" in r.get("title", "") for r in rem) and "What did you mean?" not in t, "%d: Franco 'fakarny ba3d bokra … el egar' → the reminder «ادفع الإيجار»: %s" % (w, json.dumps([r.get("title") for r in rem], ensure_ascii=False)))
        # OK-W4: "buy milk, eggs and bread" → 3 checkboxes in Groceries, by itself
        page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_timeout(600)
        t = say(page, "buy milk, eggs and bread")
        ls = page.evaluate("JSON.parse(localStorage.getItem('attune:lists:v1') || '{\"lists\":[]}').lists")
        g = [l for l in ls if l.get("auto") == "groceries"]
        check(len(g) == 1 and [x["text"] for x in g[0]["items"]] == ["Milk", "Eggs", "Bread"] and "Added to Groceries" in t, "%d: OK-W4 — Groceries: Milk, Eggs, Bread as 3 checkboxes" % w)
        for q, want in [("when does my passport expire?", "Passport: 2027-03-03"), ("what do I have tomorrow?", "call the bank"),
                        ("أحمد عليه كام؟", "500"), ("how much did I spend on food this month?", "Related: Groceries 85")]:
            page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_timeout(600)
            t = say(page, q)
            check(want in t, "%d: «%s» → %s" % (w, q, want))
        ctx.close()
    # OK-W1: a computer with no phone messages — "Connect your phone" (opens Sync) or Skip; never the two phone rows switched off
    plain = "try{localStorage.setItem('attune:start','home');if(!sessionStorage.getItem('t-fresh')){sessionStorage.setItem('t-fresh','1');localStorage.removeItem('attune:onboarded');}}catch(e){}"
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=plain, desktop=(1366, 860))
    page.goto(env.url); page.wait_for_selector("[data-testid=first-minute]", timeout=10000); page.click("[data-testid=first-next]")
    page.wait_for_selector("[data-testid=fm-connect-phone]", timeout=8000)
    check(page.locator("[data-testid=fm-src-sms]").count() == 0 and page.locator("[data-testid=fm-skip-computer]").count() == 1, "1366: OK-W1 — Connect your phone + Skip, no switched-off phone rows")
    page.click("[data-testid=fm-connect-phone]"); page.wait_for_timeout(1200)
    check(page.locator("[data-testid=sync-host-start]").count() >= 1 or "Connect to the other device" in page.evaluate("document.body.innerText"), "1366: Connect your phone opens Backup on Sync")
    ctx.close()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=plain, desktop=(1366, 860))
    page.goto(env.url); page.wait_for_selector("[data-testid=first-minute]", timeout=10000); page.click("[data-testid=first-next]")
    page.click("[data-testid=fm-skip-computer]"); page.wait_for_timeout(600)
    check(page.locator("[data-testid=fm]").count() == 0, "1366: Skip leaves the money step")
    ctx.close()
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
