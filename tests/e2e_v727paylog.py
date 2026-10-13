"""v6.27 — "Money tracks itself": payment notifications (read on the phone by PayListener.kt, mocked here) are listed in
Money to add with one tap; Add writes them into Money's own ledger (Yusr, through the bridge "add-txns"); Dismiss forgets.
With notification access off, one card explains it and opens Android's switch.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727paylog.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000)
Q = [{"id": "1", "app": "CIB", "title": "CIB", "text": "Your card ending 1234 was charged EGP 350.00 at CARREFOUR", "ts": now - 3600000},
     {"id": "2", "app": "InstaPay", "title": "InstaPay", "text": "You have received EGP 1,000.00 from AHMED MOHAMED", "ts": now - 1800000},
     {"id": "3", "app": "CIB", "title": "CIB", "text": "Your OTP is 482913", "ts": now - 600000}]
def mock(access):
    return r"""(() => { const S = window.__paymock = { forgot: [], opened: 0 };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.payAccess = () => %s; N.openPayAccess = () => { S.opened++; };
    N.payQueue = () => %s; N.payForget = (ids) => { S.forgot.push(...JSON.parse(ids)); };
  }; go(); })();""" % ("true" if access else "false", json.dumps(json.dumps(Q)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=mock(True))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button:has-text('Money')").click()
    page.wait_for_selector("[data-testid=paylog]", timeout=8000)
    check("2 payments read from your notifications" in page.locator("[data-testid=paylog]").inner_text(), "Money lists 2 payments read from notifications (the one-time code is not one)")
    page.click("[data-testid=paylog-open]"); page.wait_for_timeout(200)
    items = page.locator("[data-testid=paylog-item]").all_inner_texts()
    check(len(items) == 2 and "+1,000" in items[0] and "−350" in items[1] and "CARREFOUR" in items[1], "newest first, with amount, who and app: %s" % [i.replace("\n", " · ") for i in items])
    page.wait_for_function("() => { const f = document.querySelector('iframe[title=Money]'); return f && f.contentWindow && f.contentWindow.document.readyState === 'complete'; }", timeout=10000); page.wait_for_timeout(1500)
    page.locator("[data-testid=paylog-add]").nth(1).click(); page.wait_for_timeout(1200)
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3') || '{}')")
    tx = [t for t in (led.get("txns") or []) if t.get("amount") == 350]
    check(len(tx) == 1 and tx[0]["type"] == "expense" and "CARREFOUR" in tx[0]["note"], "Add puts −350 Carrefour into Money's own ledger: %s" % tx)
    page.locator("[data-testid=paylog-dismiss]").first.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=paylog]").count() == 0, "Dismiss clears the last one; the strip goes away")
    check(sorted(page.evaluate("window.__paymock.forgot")) == ["1", "2"], "handled payments are forgotten on the phone")
    ctx.close()
    # access off: one card that explains and opens Android's switch
    ctx, page = new_page(br, env, errors, extra_init=mock(False))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button:has-text('Money')").click()
    page.wait_for_selector("[data-testid=paylog-setup]", timeout=8000)
    check("Never SMS" in page.locator("[data-testid=paylog-setup]").inner_text(), "with notification access off: a card that says what it does (never SMS, nothing leaves the phone)")
    page.click("[data-testid=paylog-turn-on]"); page.wait_for_timeout(200)
    check(page.evaluate("window.__paymock.opened") == 1, "“Turn on” opens Android's Notification access screen")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
