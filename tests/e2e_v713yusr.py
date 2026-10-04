"""v6.13 — Yusr: write it and it logs it; Bills tab (recurring moved there, daily with a day range); no invoices, no demo data.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v713yusr.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def yusr(page):
    for f in page.frames:
        try:
            if f.evaluate("!!document.getElementById('write-box')"): return f
        except Exception: pass
    return None
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button:has-text('Money')").first.click()
    y = None
    for _ in range(60):
        y = yusr(page)
        if y: break
        page.wait_for_timeout(250)
    check(y is not None, "Yusr opens in Money")
    for _ in range(20):
        if y.evaluate("document.getElementById('onboard').classList.contains('open')"): break
        page.wait_for_timeout(200)
    y.evaluate("() => { try { onbFinish('home') } catch (e) {} }"); page.wait_for_timeout(300)
    check(not y.evaluate("document.getElementById('onboard').classList.contains('open')"), "past the welcome screens")
    if not y.evaluate("db.accounts.length"):
        y.evaluate("() => { db.accounts.push({id:'c1',name:'Cash',emoji:'💵',currency:db.currency||'EGP',start:0}); save(); refresh(); }")
    # no model loaded: the code reading logs it
    n0 = y.evaluate("db.txns.length")
    y.fill("#write-text", "lunch 150, taxi 60 and got my salary 30000")
    y.click("#write-go")
    y.wait_for_selector("[data-testid=write-done]", timeout=15000)
    tx = y.evaluate("db.txns.slice(-3).map(t => [t.type, t.amount, t.cat])")
    check(y.evaluate("db.txns.length") - n0 == 3, "three items logged from one sentence")
    check(tx == [["expense", 150, "food"], ["expense", 60, "transport"], ["income", 30000, "salary"]], "amounts, kinds and categories: %s" % tx)
    y.click("[data-testid=write-undo]"); page.wait_for_timeout(200)
    check(y.evaluate("db.txns.length") == n0, "Undo removes them")
    # Arabic, with yesterday
    y.fill("#write-text", "فطار ٨٠ وبنزين ٥٠٠ امبارح")
    y.click("#write-go"); y.wait_for_selector("[data-testid=write-done]", timeout=15000)
    tx = y.evaluate("db.txns.slice(-2).map(t => [t.amount, t.cat, t.date])")
    check([t[0] for t in tx] == [80, 500] and tx[1][1] == "transport", "Arabic: %s" % tx)
    # a question is answered (by code, from the ledger), not logged
    n1 = y.evaluate("db.txns.length")
    y.fill("#write-text", "how much did I spend on transport this week?")
    y.click("#write-go")
    y.wait_for_selector("[data-testid=talk-answer]", timeout=15000)
    ans = y.locator("[data-testid=talk-answer]").last.inner_text()
    check("500" in ans and "Food" not in ans and y.evaluate("db.txns.length") == n1, "answered, nothing logged: %s" % ans)
    # the home cards (B) and 5 tabs
    check(y.locator("[data-testid=card-spent]").is_visible() and y.locator("[data-testid=card-zakat]").is_visible(), "home cards show")
    shown = y.evaluate("[...document.querySelectorAll('nav button[data-scr]')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.dataset.scr)")
    check(shown == ["home", "trends", "bills", "zakat", "settings"], "5 tabs: %s" % shown)
    check(y.locator("#write-box").is_visible(), "the write-or-ask bar is on Home")
    # no invoices tab, no demo data, Bills tab instead
    check(y.evaluate("!document.querySelector('nav button[data-scr=invoices]')"), "no Invoices tab")
    check(y.evaluate("!document.getElementById('demo-btn')"), "no demo data button")
    check(y.evaluate("!!document.querySelector('nav button[data-scr=bills]')"), "a Bills tab")
    y.evaluate("go('bills')"); page.wait_for_timeout(200)
    check(y.locator("#scr-bills").is_visible(), "Bills opens")
    check(not y.locator("#write-box").is_visible(), "the bar hides off Home")
    y.evaluate("go('settings')"); page.wait_for_timeout(200)
    check(y.locator("#more-tiles").inner_text().lower().find("accounts") >= 0, "More opens Accounts, Goals, Notes")
    # a daily bill on days 1–10 only
    y.evaluate("openRecurring()"); page.wait_for_timeout(200)
    y.fill("#rec-amount", "40")
    y.select_option("#rec-freq", "daily")
    check(y.locator("#rec-range-field").is_visible(), "Daily shows the day-range choice")
    y.check("#rec-range-on"); y.select_option("#rec-from", "1"); y.select_option("#rec-to", "10")
    y.fill("#rec-next", "2026-01-28")
    y.evaluate("saveRecurring()"); page.wait_for_timeout(300)
    r = y.evaluate("db.recurring[db.recurring.length-1]")
    check(r["freq"] == "daily" and r["fromDay"] == 1 and r["toDay"] == 10, "saved as daily, days 1–10: %s" % json.dumps({k: r[k] for k in ("freq", "fromDay", "toDay")}))
    days = y.evaluate("db.txns.filter(t => t.recurring && t.amount === 40).map(t => +t.date.slice(8,10))")
    check(len(days) > 0 and all(1 <= d <= 10 for d in days), "posted only on days 1–10: %s" % sorted(set(days)))
    check(y.evaluate("document.getElementById('recurring-list').innerText").find("1–10") >= 0, "the list says the days")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
