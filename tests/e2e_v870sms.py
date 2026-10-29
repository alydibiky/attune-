"""v8.7 (Ali, 29 Oct: "we agreed that it reads SMS, but not one-time codes"): in the APK Ali installs, Money offers to bring in
the bank SMS already on the phone (READ_SMS, once — SmsInbox.kt, mocked here); they wait in the review list (never added by
themselves), and a one-time code is never among them (the phone filters it; the page never sees it).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v870sms.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000)
OLD = [{"id": "sms:11", "pkg": "sms", "app": "SMS", "who": "NBE", "title": "NBE", "text": "Your account was debited EGP 1,250.00 at VODAFONE on 03/05", "ts": now - 150 * 86400000},
       {"id": "sms:12", "pkg": "sms", "app": "SMS", "who": "CIB", "title": "CIB", "text": "Salary of EGP 30,000.00 credited to your account", "ts": now - 120 * 86400000}]
init = "try{localStorage.setItem('attune:paylog:auto','1');localStorage.setItem('ledger.v3', JSON.stringify({currency:'EGP',accounts:[{id:'c',name:'Cash',currency:'EGP',start:0}],txns:[],budgets:{overall:0,cats:{}},recurring:[],debts:[]}));}catch(e){}\n" + r"""(() => { const S = window.__sms = { asked: 0, granted: false };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.payAccess = () => true; N.payAvailable = () => true; N.payQueue = () => "[]"; N.payForget = () => {};
    N.smsInboxState = () => JSON.stringify({ declared: true, granted: S.granted });
    N.smsInboxAsk = () => { S.asked++; S.granted = true; setTimeout(() => window.dispatchEvent(new CustomEvent('attune-sms-perm', { detail: true })), 50); };
    N.smsInboxMoney = (d) => { S.days = d; return %s; };
  }; go(); })();""" % json.dumps(json.dumps(OLD))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=init)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button:has-text('Money')").click()
    page.wait_for_selector("[data-testid=sms-old]", timeout=8000)
    check("never one-time codes" in page.locator("[data-testid=sms-old]").inner_text(), "Money offers to bring in the old bank SMS (never one-time codes)")
    page.click("[data-testid=sms-old-go]")
    page.wait_for_selector("[data-testid=paylog]", timeout=8000)
    check(page.evaluate("window.__sms.asked") == 1 and page.evaluate("window.__sms.days") == 365, "Android is asked once, then the last 12 months are read")
    check("2 bank messages" in page.locator("[data-testid=sms-old]").inner_text(), "it says how many are waiting")
    check("2 payments" in page.locator("[data-testid=paylog]").inner_text(), "they wait in the review list: %s" % page.locator("[data-testid=paylog]").inner_text()[:80])
    page.wait_for_timeout(2500)
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3') || '{}')")
    check(not (led.get("txns") or []), "old SMS are never added by themselves, even with 'add the sure ones' on")
    page.click("[data-testid=paylog-open]"); page.wait_for_timeout(200)
    page.locator("[data-testid=paylog-add]").first.click(); page.wait_for_timeout(1500)
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3') || '{}')")
    check(any(t.get("amount") == 30000 for t in (led.get("txns") or [])) or any(t.get("amount") == 1250 for t in (led.get("txns") or [])), "a tap adds one to Money")
    check(len(page.evaluate("JSON.parse(localStorage.getItem('attune:sms-old:v1') || '[]')")) == 1, "the handled one leaves the waiting list")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
