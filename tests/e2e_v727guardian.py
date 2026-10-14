"""v6.27 — the Money Guardian ("Attune pays for itself"): it finds money in the person's own data (a late debt in People &
plans, a double charge, a price rise, a subscription) by code; the counter only counts what the person did.
Pro sees every finding; Free sees the first and the rest as a total that opens the plan.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727guardian.py     (SHOTS=dir for screenshots)
"""
import json, os, datetime, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
T = datetime.date.today()
d = lambda n: (T - datetime.timedelta(days=n)).isoformat()
mo = lambda k: (T.replace(day=1) - datetime.timedelta(days=28 * k)).replace(day=5).isoformat()
LIFE = {"v": 1, "items": [{"id": "a", "kind": "debt", "person": "Ahmed", "dir": "in", "amount": 1000, "count": 1, "total": 1000, "every": None,
  "start": d(12), "currency": "EGP", "paid": [], "title": ""}]}
now_ms = int(time.time() * 1000)
TX = [{"id": "x1", "type": "expense", "amount": 350, "cat": "groceries", "account": "c", "date": T.isoformat(), "note": "CARREFOUR · CIB", "ts": now_ms - 120000},
      {"id": "x2", "type": "expense", "amount": 350, "cat": "groceries", "account": "c", "date": T.isoformat(), "note": "CARREFOUR · CIB", "ts": now_ms - 60000}]
for k in (3, 2, 1):
    TX.append({"id": "s%d" % k, "type": "expense", "amount": 120, "cat": "bills", "account": "c", "date": mo(k), "note": "Shahid · CIB"})
LEDGER = {"currency": "EGP", "accounts": [{"id": "c", "name": "Cash", "currency": "EGP", "start": 0}], "budgets": {"overall": 0, "cats": {}}, "txns": TX, "recurring": [], "debts": []}

def init(pro):
    s = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:life:v1',%s);localStorage.setItem('ledger.v3',%s)" % (json.dumps(json.dumps(LIFE)), json.dumps(json.dumps(LEDGER)))
    if not pro: s += ";localStorage.setItem('attune:first-run','1');localStorage.setItem('attune:testing-pro','off')"
    return s + ";window.open=(u)=>{window.__opened=u}}catch(e){}"

with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- Pro (the 7-day trial of a new install) ----
    ctx, page = new_page(br, env, errors, extra_init=init(True))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    card = page.locator("[data-testid=guardian-card]")
    check(card.count() == 1 and "ways to save" in card.inner_text(), "Home shows the Guardian card: %s" % card.inner_text().replace("\n", " · "))
    card.click(); page.wait_for_selector("[data-testid=guardian-page]", timeout=5000)
    items = page.locator("[data-testid=guardian-item]")
    texts = items.all_inner_texts()
    check(items.count() == 3, "three findings: %s" % [t.split("\n")[0] for t in texts])
    check("Ahmed is 12 days late" in texts[0], "the late debt comes first")
    check(any("Charged twice at Carrefour" in t for t in texts), "the double charge at Carrefour")
    check(any("Shahid" in t and "1,440" in t for t in texts), "Shahid: 1,440 EGP a year")
    msg = page.locator("[data-testid=guardian-message]").inner_text()
    check("Ahmed" in msg and "1,000 EGP" in msg, "a polite reminder is written: %s" % msg[:80])
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "guardian-pro.png"))
    # remind Ahmed → WhatsApp with the text
    items.first.locator("[data-testid=guardian-yes]").click(); page.wait_for_timeout(300)
    shared = page.evaluate("window.__mock.shared || ''")
    check("Ahmed" in shared and "1,000" in shared, "Send reminder opens the phone's Share menu (WhatsApp, SMS, iMessage…) with the message")
    # the double charge refunded → counted
    page.locator("[data-testid=guardian-item]:has-text('Charged twice') [data-testid=guardian-yes]").click(); page.wait_for_timeout(300)
    check("350" in page.locator("[data-testid=guardian-month]").inner_text(), "the refund is counted as saved this month: %s" % page.locator("[data-testid=guardian-month]").inner_text().replace("\n", " "))
    # Ahmed pays: ticked in People & plans after the reminder → counted
    page.evaluate("window.confirm = () => false")
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('People & plans')").first.click(); page.wait_for_selector("[data-testid=life-page]", timeout=5000)
    page.locator("[data-testid=life-tick]").first.click(); page.wait_for_timeout(300)
    g = page.evaluate("JSON.parse(localStorage.getItem('attune:guardian:v1'))")
    check(sum(s["amount"] for s in g["saved"]) == 1350, "Ahmed paid after the reminder: 1,000 more counted (%s)" % [s["amount"] for s in g["saved"]])
    ctx.close()

    # ---- Free: the first finding, the rest locked ----
    ctx, page = new_page(br, env, errors, extra_init=init(False))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("[data-testid=guardian-card]").click(); page.wait_for_selector("[data-testid=guardian-page]", timeout=5000)
    check(page.locator("[data-testid=guardian-item]").count() == 1, "Free sees one finding in full")
    lock = page.locator("[data-testid=guardian-locked]")
    check(lock.count() == 1 and "2 more ways to save" in lock.inner_text(), "…and the rest as a total: %s" % lock.inner_text().split("\n")[0])
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "guardian-free.png"))
    lock.click(); page.wait_for_selector("[data-testid=upgrade]", timeout=5000)
    check(True, "…which opens the plan")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
