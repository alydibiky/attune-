"""v9.9 (Ali, 9 Nov: "a Google one told me the payment of Gemini and it wasn't recorded in subscriptions automatically — fix this; users
make low effort, the app makes the most effort"): a payment notification to a subscription service → added BY ITSELF to Subscriptions
(People & plans) + the expense in Money, shown on Home as done for you with Undo. Maps steps are not kept as payments.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v990subs.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 9, 10, 0, 0)
T0 = int(NOW.timestamp() * 1000); H = 3600000
NOTES = [{"id": 1, "pkg": "com.android.vending", "app": "Google Play Store", "title": "Payment successful", "text": "You paid EGP 975.00 for Google One (Google AI Pro)", "ts": T0 - 13 * H}]
PAYS = [{"id": "m1", "pkg": "com.google.android.apps.maps", "app": "Maps", "title": "50 m · At the roundabout, continue straight to stay on Road 90", "text": "12 min · 5.2 km · EGP road", "ts": T0 - 20 * H}]
L = {"currency": "EGP", "accounts": [{"id": "b", "name": "Cash", "currency": "EGP", "start": 5000}], "txns": [], "budgets": {"overall": 0, "cats": {}}, "recurring": [], "debts": [], "customCats": [], "goals": [], "projects": []}
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('ledger.v3', %s)}catch(e){}" % json.dumps(json.dumps(L))
MOCK = "(() => { const notes = %s, pays = %s; function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => JSON.stringify(notes); N.payQueue = () => JSON.stringify(pays); } w(); })();" % (json.dumps(NOTES), json.dumps(PAYS))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=autopilot]", timeout=15000); page.wait_for_timeout(500)
    life = page.evaluate("JSON.parse(localStorage.getItem('attune:life:v1')||'{\"items\":[]}').items")
    subs = [c for c in life if c.get("kind") == "subscription"]
    check(len(subs) == 1 and subs[0]["title"] == "Google Gemini" and subs[0]["amount"] == 975 and subs[0]["every"] == "month" and 0 in subs[0]["paid"], "no tap: Google Gemini 975 a month is in Subscriptions, this month paid: %s" % subs)
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
    check(len([t for t in led if t["type"] == "expense" and abs(t["amount"] - 975) < 0.01]) == 1, "…and 975 is one expense in Money")
    card = page.inner_text("[data-testid=autopilot]")
    check("Google Gemini" in card and "added to Subscriptions" in card, "Home: done for you — Google Gemini · 975 · added to Subscriptions (with Undo)")
    page.locator("[data-testid=autopilot] button", has_text="Undo").first.click(); page.wait_for_timeout(400)
    life = page.evaluate("JSON.parse(localStorage.getItem('attune:life:v1')||'{\"items\":[]}').items")
    led = page.evaluate("JSON.parse(localStorage.getItem('ledger.v3')).txns")
    check(not [c for c in life if c.get("kind") == "subscription"] and not [t for t in led if t["type"] == "expense"], "Undo takes back the subscription and the expense")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'recall'}}))"); page.wait_for_timeout(800)
    check("roundabout" not in page.inner_text("body"), "Recall: the Maps step is not listed as a payment")
    check(not real_errors(errors), "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
