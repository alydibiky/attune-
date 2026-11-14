"""v9.9.35 "Set up your life" (Ali picked GD-5 + GW-A + TR-3 — "the extra 7 days by ACTUALLY completing the setting up") in the real page:
Home card → Start → the questions in Chat → the salary answer saved as a repeating income in Money → ✓ and the next question → Skip →
Settings → Set up your life shows it; and with 6 of 8 really done during the trial, the 7 days are given once and Home says so.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9935setup.py
"""
import json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000); DAY = 86400000
LED = {"currency": "EGP", "accounts": [{"id": "c", "name": "Cash", "currency": "EGP", "start": 0}], "txns": [], "budgets": {"overall": 0, "cats": {}}, "recurring": []}
BASE = "localStorage.setItem('attune:test:quiet','0');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));localStorage.setItem('attune:start','home');localStorage.setItem('attune:first-run',String(%d));" % (now - DAY)
def init(extra=""):
    return "try{" + BASE + "localStorage.setItem('ledger.v3',%s);" % json.dumps(json.dumps(LED)) + extra + "}catch(e){}"
cards = lambda page: page.evaluate("JSON.parse(localStorage.getItem('attune:chats:v1')||localStorage.getItem('attune:chats')||'[]')")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=init())
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(700)
    card = page.locator("[data-testid=setup-home]")
    check(card.count() == 1 and card.get_attribute("data-done") == "0", "Home: “Set up your life · 0 of 8”")
    check("7 days" in card.inner_text(), "…during the trial it says really finishing 6 of 8 adds 7 days: " + card.inner_text().replace("\n", " ")[:160])
    page.click("[data-testid=setup-continue]")
    page.wait_for_selector("text=When does your salary arrive", timeout=10000)
    check(True, "Start → Chat opens with the first question (salary)")
    comp = page.locator("textarea[placeholder='Message Attune']")
    comp.fill("On the 25th, 18,500"); page.locator("button[title='Send']").click()
    page.wait_for_selector("text=Saved: your salary", timeout=8000)
    rec = page.evaluate("(JSON.parse(localStorage.getItem('ledger.v3')).recurring||[]).filter(r => r.type==='income')")
    check(len(rec) == 1 and rec[0]["amount"] == 18500 and rec[0]["freq"] == "monthly" and rec[0]["nextDate"].endswith("-25"), "the answer is a repeating income in Money: 18,500 on the 25th of every month")
    page.wait_for_selector("text=Your salary day — done (1 of 8)", timeout=8000)
    check(True, "the guide checks Money and says ✓ only now (1 of 8)")
    page.wait_for_selector("text=Let Attune read your bank and wallet messages", timeout=8000)
    check(page.locator("button:has-text('Allow bank messages')").count() >= 1, "next: bank messages, with its Allow button")
    page.locator("button:has-text('Skip this one')").last.click()
    page.wait_for_selector("text=What do you pay every month", timeout=8000)
    check(True, "Skip → the next question (bills)")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'setup'}}))"); page.wait_for_selector("[data-testid=setup-page]", timeout=8000); page.wait_for_timeout(300)
    check(page.locator("[data-testid=setup-step][data-id=salary]").get_attribute("data-done") == "1" and page.locator("[data-testid=setup-step][data-id=bank]").get_attribute("data-done") == "0", "Settings → Set up your life: salary done, bank not (skipping is not doing)")
    check(page.evaluate("localStorage.getItem('attune:setup:bonus')") is None, "no bonus for 1 of 8")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors))[:200])
    ctx.close()
    # ---- 6 of 8 really done during the trial → +7 days, once
    errors.clear()
    six = ("localStorage.setItem('ledger.v3',%s);" % json.dumps(json.dumps({**LED, "txns": [{"id": "t", "type": "expense", "amount": 85, "date": datetime.date.today().isoformat(), "source": "notification", "account": "c"}],
            "recurring": [{"id": "r", "type": "income", "amount": 18500, "freq": "monthly", "nextDate": (datetime.date.today() + datetime.timedelta(days=10)).isoformat(), "active": True}]}))
          + "localStorage.setItem('attune:life:v1',%s);" % json.dumps(json.dumps({"v": 1, "items": [{"id": "l1", "kind": "bill", "dir": "out", "amount": 612, "every": "month", "title": "Electricity"}, {"id": "l2", "kind": "subscription", "dir": "out", "amount": 450, "every": "month", "title": "Internet"}, {"id": "l3", "kind": "installment", "dir": "in", "person": "Sheikh", "amount": 2500, "every": "month"}]}))
          + "localStorage.setItem('attune:reminders:v1',%s);" % json.dumps(json.dumps([{"id": "rw", "at": now + DAY, "title": "The maid comes", "repeat": "weekly", "created": now - DAY}]))
          + "localStorage.setItem('attune:radar:v1',%s);" % json.dumps(json.dumps({"items": [{"id": "p1", "kind": "passport", "title": "Passport", "date": "2028-03-03"}, {"id": "p2", "kind": "licence", "title": "Car licence", "date": "2027-01-04"}], "seen": []})))
    ctx, page = new_page(br, env, errors, extra_init="try{" + BASE + six + "}catch(e){}")
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.wait_for_function("localStorage.getItem('attune:setup:bonus')", timeout=10000)
    until = int(page.evaluate("localStorage.getItem('attune:pro-bonus-until')") or 0)
    check(abs(until - (now - DAY + 14 * DAY)) < 60000, "6 of 8 really done → Pro until 14 days after the trial started")
    page.wait_for_timeout(4500)
    check("You earned 7 more days of Pro" in page.locator("[data-testid=setup-home]").inner_text(), "Home says it, with the new end date")
    first = page.evaluate("localStorage.getItem('attune:pro-bonus-until')")
    page.reload(); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(2500)
    check(page.evaluate("localStorage.getItem('attune:pro-bonus-until')") == first, "given once — reopening doesn't add more")
    check(not real_errors(errors), "no page errors (bonus): " + str(real_errors(errors))[:200])
    ctx.close(); br.close()
finish()
