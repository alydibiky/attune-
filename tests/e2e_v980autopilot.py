"""v9.8 I1 Autopilot (Ali: "I1 ok") — v9.9.30: what Attune is sure of is done by itself ("Done for you" + Undo); the rest are cards on Home — Add saves it through the Home box's path
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
    page.goto(env.url); page.wait_for_selector("[data-testid=autopilot-done]", timeout=15000); page.wait_for_timeout(600)
    # v9.9.30 (Ali, 13 Nov: "understand notifications very well, not keep asking … really smart"): what Attune is sure of is DONE,
    # listed under "Done for you" with Undo — nothing waits for a tap
    check(page.locator("[data-testid=autopilot-item]").count() == 0, "nothing waits for a tap")
    done = page.locator("[data-testid=autopilot-done]").inner_text()
    check("Call back Mama" in done and "Ahmed Salah" in done and "Amazon" in done, "done by itself: call back Mama, Ahmed's request, the Amazon delivery: " + done.replace("\n", " | "))
    check("talabat" not in done.lower() and "Jumia" not in done, "the sale and Talabat's '300 EGP OFF' are nothing")
    check("CARREFOUR" not in done, "the CIB debit is left to Money, which adds it by itself (one copy: the SMS is the same payment)")
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')"); rem = rem if isinstance(rem, list) else rem.get("items", [])
    check(any("Ahmed Salah" in r.get("title", "") and r.get("source") == "autopilot" for r in rem), "Ahmed's message → a reminder for tomorrow")
    check(any("Call back Mama" in r.get("title", "") for r in rem) and any("Amazon" in r.get("title", "") for r in rem), "…and the call back and the delivery are reminders")
    row = page.locator("[data-testid=autopilot-done] div", has_text="Ahmed Salah").first
    row.locator("[data-testid=autopilot-undo]").click(); page.wait_for_timeout(300)
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')"); rem = rem if isinstance(rem, list) else rem.get("items", [])
    check(not any("Ahmed Salah" in r.get("title", "") for r in rem), "Undo takes the reminder back")
    check("todo:WhatsApp" in page.evaluate("JSON.parse(localStorage.getItem('attune:autopilot:v1')).manual"), "…and from now on such a request from WhatsApp waits for a tap")
    n0 = len(rem)
    page.reload(); page.wait_for_timeout(1800)
    rem = page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')||'[]')"); rem = rem if isinstance(rem, list) else rem.get("items", [])
    check(len(rem) == n0 and page.locator("[data-testid=autopilot-item]").count() == 0, "nothing comes back after a restart (never twice)")
    ctx.close()
    # a kind the person asked to see first (Undo once → "manual"): the card waits; a tap shows it all and saves it MY way
    AP0 = {"v": 1, "seen": {}, "ok": {}, "no": {}, "always": [], "asked": [], "done": [], "skipApps": [], "manual": ["followup:Amazon Shopping"]}
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK + ";try{localStorage.setItem('attune:autopilot:v1', %s)}catch(e){}" % json.dumps(json.dumps(AP0)))
    ctx.clock.set_fixed_time(NOW); page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=autopilot-item]", timeout=15000)
    check(page.locator("[data-testid=autopilot-item]").count() == 1 and "Amazon" in page.locator("[data-testid=autopilot-item]").inner_text(), "the Amazon delivery waits (asked to see these first)")
    am = page.locator("[data-testid=autopilot-item]", has_text="Amazon")
    am.locator("[data-testid=autopilot-open]").click(); page.wait_for_timeout(150)
    check("Arriving Thursday · your Anker charger" in am.locator("[data-testid=autopilot-full]").inner_text(), "a tap shows the whole message")
    am.locator("[data-testid=autopilot-say-input]").fill("subscription 200 every month: Amazon Prime"); am.locator("[data-testid=autopilot-say-go]").click(); page.wait_for_timeout(400)
    life = page.evaluate("JSON.parse(localStorage.getItem('attune:life:v1')||'{\"items\":[]}')")
    check(any(c.get("kind") == "subscription" and c.get("amount") == 200 for c in life.get("items", [])), "…and what I type saves it MY way: a subscription of 200 a month")
    check(page.locator("[data-testid=autopilot-item]", has_text="Amazon").count() == 0, "…then it leaves the card")
    check(not real_errors(errors), "no JavaScript errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
