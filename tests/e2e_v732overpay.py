"""v6.32 — the Overpaying check (design A "One list") at the top of Money Guardian: what you pay a month, then trials, price
rises, overlaps, renewals and unused perks, each with its source (a Gmail link for an email); a pasted email is read; the
monthly check on the 1st is a reminder. Pro sees everything; Free sees the total and the first finding.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v732overpay.py     (SHOTS=dir for screenshots)
"""
import json, os, datetime, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
T = datetime.date.today()
# calendar months back (28 days × k landed 51 days back at the end of a month, and Google One then read as stopped)
# (k = 1 is the latest charge: this month's if its day has passed, else last month's)
_back = lambda k, dd: k - 1 if T.day > dd else k
mo = lambda k, dd: datetime.date(T.year + (T.month - 1 - _back(k, dd)) // 12, (T.month - 1 - _back(k, dd)) % 12 + 1, dd).isoformat()
TX = []
for k in (3, 2, 1):
    TX.append({"id": "n%d" % k, "type": "expense", "amount": 165, "cat": "bills", "account": "c", "date": mo(k, 12), "note": "Netflix.com · NBE"})
    TX.append({"id": "s%d" % k, "type": "expense", "amount": 120, "cat": "bills", "account": "c", "date": mo(k, 15), "note": "Shahid VIP · NBE"})
    TX.append({"id": "g%d" % k, "type": "expense", "amount": 500 if k > 1 else 650, "cat": "bills", "account": "c", "date": mo(k, 7), "note": "Google One · CIB"})
LEDGER = {"currency": "EGP", "accounts": [{"id": "c", "name": "Cash", "currency": "EGP", "start": 0}], "budgets": {"overall": 0, "cats": {}}, "txns": TX, "recurring": [], "debts": []}
now_ms = int(time.time() * 1000)
end = (T + datetime.timedelta(days=3)).strftime("%d %B %Y")
EMAILS = [{"id": "m1", "kind": "email", "from": "AI Co <billing@ai.example>", "title": "Your free Claude Pro trial has started", "text": "Your free trial ends on %s. After that you will be charged $20.00/month." % end,
           "at": now_ms - 4 * 86400000, "link": "https://mail.google.com/mail/#all/thread-f:111"}]
OP = {"emails": EMAILS, "snaps": {}, "done": [], "monthly": False}

def init(pro):
    s = "try{localStorage.setItem('attune:start','home');localStorage.setItem('ledger.v3',%s);localStorage.setItem('attune:overpay:v1',%s)" % (json.dumps(json.dumps(LEDGER)), json.dumps(json.dumps(OP)))
    if not pro: s += ";localStorage.setItem('attune:first-run','1');localStorage.setItem('attune:testing-pro','off')"
    return s + ";window.__links=[];window.addEventListener('attune-agent',(e)=>{window.__links.push(e.detail.link.url)},true)}catch(e){}"

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=init(True))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("[data-testid=guardian-card]").click(); page.wait_for_selector("[data-testid=overpay]", timeout=5000)
    tot = page.locator("[data-testid=overpay-total]").inner_text()
    check(tot.replace(",", "").startswith("935 EGP"), "you pay a month: %s" % tot)
    rows = page.locator("[data-testid=overpay-row]")
    kinds = [rows.nth(i).get_attribute("data-kind") for i in range(rows.count())]
    check(kinds[:2] == ["trial", "hike"], "act now: the trial, then the price rise: %s" % kinds)
    check("overlap" in kinds, "Netflix and Shahid do the same job")
    t0 = rows.first.inner_text()
    check("Claude" in t0 and "3 days" in t0 and "$20" in t0, "the trial: %s" % t0.replace("\n", " · "))
    h = rows.nth(1).inner_text()
    check("Google One went up 30%" in h and "1,800" in h, "the price rise: %s" % h.replace("\n", " · "))
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "overpay-pro.png"), full_page=True)
    rows.first.locator("button").first.click()
    page.locator("[data-testid=overpay-source]").click(); page.wait_for_timeout(200)
    check("thread-f:111" in (page.evaluate("window.__links") or [""])[-1], "the trial opens its email in Gmail")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "overpay-detail.png"), full_page=True)
    page.locator("[data-testid=overpay-yes]").click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=overpay-row][data-kind=trial]").count() == 0, "Cancelled it: the trial is gone")
    g = page.evaluate("JSON.parse(localStorage.getItem('attune:guardian:v1')||'{}')")
    check(any(s.get("amount") == 20 for s in g.get("saved", [])), "…and counted as saved")
    # a pasted email
    page.locator("[data-testid=overpay-paste]").click()
    page.locator("[data-testid=overpay-paste-text]").fill("Sports Club rewards: You have 5,209 points. Redeem your 50 EGP voucher before %s." % (T + datetime.timedelta(days=40)).strftime("%d %B %Y"))
    page.locator("[data-testid=overpay-paste-add]").click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=overpay-row][data-kind=perk]").count() == 1, "a pasted voucher email → an unused perk")
    # monthly check
    page.locator("[data-testid=overpay-monthly]").click(); page.wait_for_timeout(300)
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders')||localStorage.getItem('attune:reminders:v1')||'[]')")
    sched = page.evaluate("(window.__mock && window.__mock.scheduled) || []")
    check("Checks on the 1st" in page.locator("[data-testid=overpay-monthly]").inner_text(), "the monthly check is on")
    ctx.close()
    # ---- Free ----
    ctx, page = new_page(br, env, errors, extra_init=init(False))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("[data-testid=guardian-card]").click(); page.wait_for_selector("[data-testid=overpay]", timeout=5000)
    check(page.locator("[data-testid=overpay-row]").count() == 1 and page.locator("[data-testid=overpay-locked]").count() == 1, "Free: the total, the first finding, the rest locked")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
