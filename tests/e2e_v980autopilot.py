"""v9.8 I1 Autopilot (Ali: "I1 ok"): the phone's notifications become cards on Home — Add saves it through the Home box's path
(Money / a reminder / a bill), Not this hides it, the bank SMS + app copy are one, after 3 of a kind it asks to do them by itself.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v980autopilot.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 7, 10, 0, 0)
ms = lambda d: int(d.timestamp() * 1000)
H = 3600000; T0 = ms(NOW)
NOTES = [
  {"id": 1, "pkg": "com.cib.mobile", "app": "CIB", "title": "Card transaction", "text": "Your card ending 4421 was debited EGP 1,250.00 at CARREFOUR MAADI", "ts": T0 - H},
  {"id": 2, "pkg": "com.google.android.apps.messaging", "app": "Messages", "title": "CIB", "text": "Your card ending 4421 was debited EGP 1,250.00 at CARREFOUR MAADI", "ts": T0 - H + 20000},
  {"id": 3, "pkg": "com.amazon.mShop.android.shopping", "app": "Amazon Shopping", "title": "Shipped", "text": "Arriving Thursday · your Anker charger", "ts": T0 - 2 * H},
  {"id": 4, "pkg": "com.whatsapp", "app": "WhatsApp", "title": "Ahmed Salah 012 (Dayı)", "text": "ابعتلي الورق بكرة", "ts": T0 - 3 * H},
  {"id": 8, "pkg": "com.jumia.android", "app": "Jumia", "title": "50% off", "text": "Mega sale today only", "ts": T0 - 7 * H},
  {"id": 9, "pkg": "com.whatsapp", "app": "WhatsApp", "title": "Mama", "text": "Missed voice call", "ts": T0 - 8 * H},
  {"id": 10, "pkg": "com.talabat", "app": "talabat", "title": "Arriving", "text": "300 EGP OFF Your Groceries! Get 300 EGP OFF selected products when you spend 1,000 EGP on talabat mart. Delivered in just 15 minutes!", "ts": T0 - 9 * H}]
L = {"currency": "EGP", "accounts": [{"id": "b", "name": "Cash", "currency": "EGP", "start": 5000}], "txns": [], "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": []}
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('ledger.v3', %s)}catch(e){}" % json.dumps(json.dumps(L))
MOCK = "(() => { const notes = %s; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => JSON.stringify(notes); } w(); })();" % json.dumps(NOTES)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=autopilot]", timeout=15000)
    items = page.locator("[data-testid=autopilot-item]")
    txt = " | ".join(items.all_inner_texts()).replace("\n", " ")
    check(items.count() == 4, "four things to do (the SMS copy is the same payment, the sale and Talabat's offer are nothing): " + txt)
    check("Call back Mama" in txt and "talabat" not in txt.lower(), "a WhatsApp missed voice call from Mama → call back; Talabat's '300 EGP OFF' is an offer, not a delivery")
    check("CARREFOUR" in txt and "1,250" in txt and "Ahmed Salah" in txt and "Amazon" in txt, "…the Carrefour expense, Ahmed's to-do, the Amazon delivery")
    page.locator("[data-testid=autopilot-item]", has_text="CARREFOUR").locator("[data-testid=autopilot-add]").click(); page.wait_for_timeout(300)
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3'))")
    ex = [t for t in led["txns"] if t["type"] == "expense"]
    check(len(ex) == 1 and abs(ex[0]["amount"] - 1250) < 0.01 and ex[0]["cat"] == "groceries", "Add → one expense in Money: 1,250, groceries: %s" % ex)
    check(page.locator("[data-testid=autopilot-item]", has_text="CARREFOUR").count() == 0, "…and it leaves the card")
    page.locator("[data-testid=autopilot-item]", has_text="Ahmed").locator("[data-testid=autopilot-add]").click(); page.wait_for_timeout(300)
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')"); rem = rem if isinstance(rem, list) else rem.get("items", [])
    check(any("Ahmed Salah" in r.get("title", "") and r.get("source") == "autopilot" for r in rem), "Ahmed's message → a reminder for tomorrow")
    # v9.8 (Ali: "I want to see the whole message … and reply to it and tell it to add it like I want"): a tap shows it all
    am = page.locator("[data-testid=autopilot-item]", has_text="Amazon")
    am.locator("[data-testid=autopilot-open]").click(); page.wait_for_timeout(150)
    check("Arriving Thursday · your Anker charger" in am.locator("[data-testid=autopilot-full]").inner_text(), "a tap shows the whole message")
    am.locator("[data-testid=autopilot-say-input]").fill("subscription 200 every month: Amazon Prime"); am.locator("[data-testid=autopilot-say-go]").click(); page.wait_for_timeout(400)
    life = page.evaluate("JSON.parse(localStorage.getItem('attune:life:v1')||'{\"items\":[]}')")
    check(any(c.get("kind") == "subscription" and c.get("amount") == 200 for c in life.get("items", [])), "…and what I type saves it MY way: a subscription of 200 a month")
    check(page.locator("[data-testid=autopilot-item]", has_text="Amazon").count() == 0, "…then it leaves the card")
    page.locator("[data-testid=autopilot-item]", has_text="Mama").locator("[data-testid=autopilot-no]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=autopilot-item]").count() == 0, "Not this → gone")
    page.reload(); page.wait_for_timeout(1500)
    check(page.locator("[data-testid=autopilot-item]").count() == 0, "…and nothing comes back after a restart (never twice)")
    check(not real_errors(errors), "no JavaScript errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
