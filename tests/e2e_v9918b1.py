"""v9.9.18 B1 screens (Ali OK'd AU5 / AU7 / AU8 on the combined screens, 12 Nov 2026).
  AU5: the reminder form has ★ Important + "Keep reminding" levels; the phone gets nag + quiet hours + the button words.
  AU7: a Paid tap on the notification (then a balance) → one line in Money from that balance, the instalment ticked, a toast.
  AU8: "Done for you" lists it; Edit → "Do it this way next time?"; Undo takes it out of Money.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9918b1.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
today = datetime.date.today().isoformat()
LIFE = {"v": 1, "items": [{"id": "c1", "created": 1, "person": "", "currency": "EGP", "start": today, "every": "month", "paid": [], "title": "Electricity", "kind": "bill", "dir": "out", "amount": 320, "count": 0, "total": 0, "payer": "me"}]}
LEDGER = {"txns": [], "accounts": [{"id": "cash", "name": "Cash", "currency": "EGP", "start": 2000}, {"id": "cib", "name": "CIB", "currency": "EGP", "start": 9000}, {"id": "vfc", "name": "Vodafone Cash", "currency": "EGP", "start": 500}]}
PAYS = {"life-c1": {"amount": 320, "currency": "EGP", "note": "Electricity", "cat": "bills", "accounts": [{"id": "cash", "name": "Cash"}, {"id": "cib", "name": "CIB"}, {"id": "vfc", "name": "Vodafone Cash"}], "lifeId": "c1", "i": 0, "labels": {}}}
TAPS = [{"id": "t1", "rid": "life-c1", "act": "paid", "at": 1}, {"id": "t2", "rid": "life-c1", "act": "acct", "acct": "vfc", "at": 2}, {"id": "t2", "rid": "life-c1", "act": "acct", "acct": "vfc", "at": 2}]
INIT = ("try{localStorage.setItem('attune:start','home');if(!localStorage.getItem('t:seeded')){localStorage.setItem('t:seeded','1');localStorage.setItem('attune:life:v1',%s);localStorage.setItem('ledger.v3',%s);localStorage.setItem('attune:pays:v1',%s)}}catch(e){}"
  % (json.dumps(json.dumps(LIFE)), json.dumps(json.dumps(LEDGER)), json.dumps(json.dumps(PAYS))))
MOCK = """(() => { window.__sched = []; window.__taps = %s; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5);
  N.schedule = (j) => { window.__sched.push(JSON.parse(j)); return JSON.stringify({ ok: true, exact: true, notify: true }); }; N.scheduled = () => "[]";
  N.takeTaps = () => { const t = JSON.stringify(window.__taps); window.__taps = []; return t; }; } w(); })();""" % json.dumps(TAPS)
def open_mode(page, m, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + MOCK)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
    # AU7: the taps were applied once on opening
    tx = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
    check(len(tx) == 1 and tx[0]["amount"] == 320 and tx[0]["account"] == "vfc", "AU7: Paid → Vodafone Cash (tapped twice) → ONE 320 from Vodafone Cash: " + json.dumps(tx)[:160])
    life = page.evaluate("JSON.parse(localStorage.getItem('attune:life:v1'))")
    check(life["items"][0]["paid"] == [0], "…and the bill's payment is ticked in People & plans")
    # AU8
    open_mode(page, "donefor", "[data-testid=donefor-page]")
    check(page.locator("header p").first.inner_text().strip() == "Done for you", "AU8: the page is “Done for you”")
    rows = page.locator("[data-testid=donefor-row]")
    check(rows.count() == 1 and "Electricity" in rows.first.inner_text(), "…today's list shows the notification payment: " + (rows.first.inner_text().replace("\n", " ") if rows.count() else ""))
    page.locator("[data-testid=donefor-edit]").first.click(); page.locator("[data-testid=donefor-cat-rent]").click(); page.locator("[data-testid=donefor-edit-save]").click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=donefor-remember]").count() == 1, "Edit the category → “Do it this way next time?”")
    page.locator("[data-testid=donefor-remember-yes]").click(); page.wait_for_timeout(200)
    learned = page.evaluate("JSON.parse(localStorage.getItem('attune:donelog:v1')).learned")
    check(any(v.get("cat") == "rent" for v in learned.values()), "…Yes, remember → kept for that source: " + json.dumps(learned)[:120])
    check(page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns[0].cat") == "rent", "…and the Money line changed to Rent")
    page.locator("[data-testid=donefor-undo]").first.click(); page.wait_for_timeout(300)
    check(page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns.length") == 0, "Undo → out of Money")
    check(page.evaluate("JSON.parse(localStorage.getItem('attune:life:v1')).items[0].paid") == [], "…and the bill is un-ticked")
    # AU5
    open_mode(page, "reminders", "[data-testid=reminders-panel]")
    page.click("[data-testid=rem-chip-fill]"); page.wait_for_timeout(300)
    if page.locator("[data-testid=rem-title]").count() == 0: page.click("[data-testid=rem-chip-fill]"); page.wait_for_timeout(300)   # (open from an earlier visit: the first tap closed it)
    check(page.locator("[data-testid=rem-title]").count() == 1, "the fill-in form is open")
    check(page.locator("[data-testid=rem-nag] [role=radio]").count() == 5, "AU5: five levels (Once · 10 min · 15 min ★ · hour · until I tick)")
    page.fill("[data-testid=rem-title]", "Pay the CIB card"); page.locator("[data-testid=rem-important]").click()
    check(page.locator("[data-testid=rem-nag-m15]").get_attribute("aria-checked") == "true" and page.locator("[data-testid=rem-nag-note]").count() == 1, "★ Important picks every 15 min, with the quiet-hours line")
    page.locator("[data-testid=rem-add]").click(); page.wait_for_timeout(500)
    s = page.evaluate("window.__sched.filter(x => x.title === 'Pay the CIB card')")
    check(len(s) == 1 and s[0].get("nag") == "m15" and s[0].get("important") and s[0].get("quiet", {}).get("from") == "23:00" and s[0].get("labels", {}).get("done"), "…and the phone gets nag + quiet hours + the button words: " + json.dumps(s)[:200])
    check(page.locator("[data-testid=rem-star]").count() >= 1, "…the list shows it with ★")
    page.fill("[data-testid=rem-say]", "remind me tomorrow at 9 to call the bank, important"); page.locator("[data-testid=rem-say-go]").click(); page.wait_for_timeout(500)
    s2 = page.evaluate("window.__sched.filter(x => /call the bank/.test(x.title))")
    check(len(s2) == 1 and s2[0].get("nag") == "m15" and "important" not in s2[0]["title"], "a typed reminder with “important” → ★ (and the word is not in the title): " + json.dumps(s2)[:160])
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
