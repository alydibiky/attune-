"""v6.27 — the Life layer's page, "People & plans" (Ali's example: «Ahmed owes me 12,000, 1,000 a month for a year»):
typed → read by code → a preview → saved with 12 monthly checkboxes; a tick is offered to Money (the same sentence Money
reads from a bank message). Arabic and a savings circle too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727life.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    # Ali's Money is in EGP (v6.27: with no Money yet, the phone's own region decides — this browser is en-US → USD)
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('ledger.v3', JSON.stringify({currency:'EGP',accounts:[{id:'c',name:'Cash',currency:'EGP',start:0}],txns:[],budgets:{overall:0,cats:{}},recurring:[],debts:[]}))}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    dialogs = []
    page.on("dialog", lambda d: (dialogs.append(d.message), d.accept()))
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('People & plans')").first.click()
    page.wait_for_selector("[data-testid=life-page]", timeout=8000)
    page.fill("[data-testid=life-input]", "Ahmed owes me 12,000, 1,000 a month for a year"); page.click("[data-testid=life-read]")
    page.wait_for_selector("[data-testid=life-draft]", timeout=3000)
    dr = page.locator("[data-testid=life-draft]").inner_text()
    check("Ahmed owes you" in dr and "12 payments" in dr and "12,000" in dr, "read by code, shown to check first: " + dr.replace("\n", " · "))
    page.click("[data-testid=life-save]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=life-item]").count() == 1 and page.locator("[data-testid=life-open]").count() == 1, "saved — its schedule opens with a tap (v8.3)")
    page.click("[data-testid=life-open]"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=life-row]").count() == 12, "the schedule: 12 monthly rows (number, date, amount, status)")
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')")
    rem = rem if isinstance(rem, list) else rem.get("items", [])
    lr = [r for r in rem if str(r.get("id", "")).startswith("life-")]
    check(len(lr) == 1 and "installment 1 of 12" in lr[0]["title"], "a reminder for the next payment is set: %s" % [r.get("title") for r in lr])
    page.locator("[data-testid=life-row]").first.click(); page.wait_for_selector("[data-testid=life-paybox]")
    check(page.locator("[data-testid=life-pay-amount]").input_value() == "1000", "a tap asks how much came, filled with what was due")
    page.click("[data-testid=life-pay-go]"); page.wait_for_timeout(300)
    check(any("Received 1,000 EGP from Ahmed — installment 1 of 12" in m for m in dialogs), "a tick is offered to Money: %s" % dialogs[-1:])
    page.wait_for_selector("[data-testid=money-page]", timeout=8000)
    check(True, "…and Money opens to confirm it")
    page.evaluate("window.__attuneBack && window.__attuneBack()"); page.wait_for_timeout(300)
    if not page.locator("[data-testid=life-page]").count():
        page.locator("nav button").last.click(); page.wait_for_timeout(250)
        page.locator(".rounded-t-2xl button:has-text('People & plans')").first.click(); page.wait_for_selector("[data-testid=life-page]", timeout=8000)
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')")
    rem = rem if isinstance(rem, list) else rem.get("items", [])
    check(any("installment 2 of 12" in r.get("title", "") for r in rem if str(r.get("id", "")).startswith("life-")), "after the tick the reminder moved to the next payment (2 of 12)")
    item = page.locator("[data-testid=life-item]").first.inner_text()
    check("11,000" in item, "the tick is kept: 11,000 left — " + item.replace("\n", " · ")[:120])
    page.fill("[data-testid=life-input]", "جمعية ٢٠٠٠ في الشهر لمدة ١٠ شهور ودوري الرابع"); page.click("[data-testid=life-read]")
    page.wait_for_selector("[data-testid=life-draft]", timeout=3000)
    dr = page.locator("[data-testid=life-draft]").inner_text()
    check("savings circle" in dr.lower() and "your turn: 4" in dr, "an Egyptian جمعية, read by code: " + dr.replace("\n", " · "))
    page.click("[data-testid=life-save]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=life-item]").count() == 2, "two commitments on the page")
    page.fill("[data-testid=life-input]", "what's the weather"); page.click("[data-testid=life-read]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=life-draft]").count() == 0, "not a commitment → nothing saved (no model loaded, so no guess)")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
