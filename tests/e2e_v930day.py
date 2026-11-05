"""v9.3 Your day on Home (Ali, 5 Nov 2026: D1 A — "I want the prayers not to be automatic, people open it in the settings first, this is a
global app"; A2 A — Ramadan only when switched on, with a box to write anything; notifications → the day: "WhatsApp messages, YouTube,
Instagram, SMS notifications — it will help in planning my day").
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v930day.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2026, 11, 5, 13, 0, 0)
ms = lambda d: int(d.timestamp() * 1000)
H = 3600000
NOTES = [
  {"id": "1", "pkg": "com.whatsapp", "app": "WhatsApp", "title": "Ahmed", "text": "can we meet tomorrow at 5?", "ts": ms(NOW) - 1 * H},
  {"id": "2", "pkg": "com.whatsapp", "app": "WhatsApp", "title": "Family: Mama", "text": "تعالى بكرة الساعة ٨ نتعشى", "ts": ms(NOW) - 2 * H},
  {"id": "3", "pkg": "com.google.android.apps.messaging", "app": "Messages", "title": "Aramex", "text": "Your shipment is out for delivery today", "ts": ms(NOW) - 3 * H},
  {"id": "4", "pkg": "com.instagram.android", "app": "Instagram", "title": "sara", "text": "liked your photo", "ts": ms(NOW) - 2 * H},
  {"id": "5", "pkg": "com.google.android.youtube", "app": "YouTube", "title": "Veritasium", "text": "New video", "ts": ms(NOW) - 4 * H},
]
MOCK = "(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); N.recallNotes = () => %s; N.payAccess = () => true; } w(); })();" % json.dumps(json.dumps(NOTES))
AGENTS = {"agents": [{"id": "h1", "kind": "watch", "on": True, "title": "Hotels · Makkah", "what": "Hotels near the Haram", "best3": [{"name": "Hilton", "price": 44800}], "checks": [{"at": ms(NOW) - H, "price": 44800}], "currency": "EGP"}], "usual": {}}
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:agents:v1', %s)}catch(e){}" % json.dumps(json.dumps(AGENTS))
def go(page, m): page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(600)
def dayset(page): return json.loads(page.evaluate("localStorage.getItem('attune:dayset:v1')") or "{}")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + MOCK)
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=your-day]", timeout=15000); page.wait_for_timeout(800)
    # prayers and Ramadan are OFF until turned on (a global app)
    check(page.locator("[data-testid=day-prayers]").count() == 0 and page.locator("[data-testid=ramadan-card]").count() == 0, "a new user: no prayer times and no Ramadan card on Home (off until chosen in Settings)")
    # notifications → the day
    nt = page.inner_text("[data-testid=day-notes]")
    check("Ahmed" in nt and "Mama" in nt and "Aramex" in nt, "From your messages: who wrote today (Ahmed, Mama, Aramex)")
    check(page.locator("[data-testid=day-ask]").count() == 2 and "can we meet tomorrow at 5" in nt, "…what was asked for at a time: Ahmed's and Mama's")
    check("out for delivery" in page.inner_text("[data-testid=day-arriving]"), "…what arrives today")
    check("Instagram 1" in page.inner_text("[data-testid=day-apps]") and "YouTube 1" in page.inner_text("[data-testid=day-apps]"), "…and the other apps counted (Instagram, YouTube)")
    check(page.locator("[data-testid=day-agent]").count() == 1 and "44,800" in page.inner_text("[data-testid=day-agents]"), "the agents' news: the hotel agent found 44,800")
    page.locator("[data-testid=day-ask]").first.locator("[data-testid=day-ask-add]").click(); page.wait_for_timeout(500)
    rem = json.loads(page.evaluate("localStorage.getItem('reminders') || localStorage.getItem('attune:reminders') || '[]'") or "[]")
    keys = page.evaluate("Object.keys(localStorage).filter(k => /remind/i.test(k))")
    allrem = [r for k in keys for r in (json.loads(page.evaluate("(k) => localStorage.getItem(k)", k) or "[]") if isinstance(json.loads(page.evaluate("(k) => localStorage.getItem(k)", k) or "[]"), list) else [])]
    r = [x for x in allrem if isinstance(x, dict) and str(x.get("title", "")).startswith("Ahmed:")]
    check(len(r) == 1 and datetime.datetime.fromtimestamp(r[0]["at"] / 1000).hour == 17, "Add a reminder → “Ahmed: can we meet tomorrow at 5?” tomorrow at 17:00")
    check(page.locator("[data-testid=day-ask]").count() == 1, "…and that ask leaves the card")
    # Settings → Your day
    page.click("[data-testid=home-menu]"); page.click("[data-testid=phone-side] [data-testid=side-settings]"); page.wait_for_selector("[data-testid=day-settings]")
    check(page.locator("[data-testid=set-prayers][aria-checked=false]").count() == 1 and page.locator("[data-testid=set-ramadan][aria-checked=false]").count() == 1, "Settings → Your day: Prayer times and Ramadan mode, both off")
    page.click("[data-testid=set-prayers]"); page.wait_for_selector("[data-testid=set-prayer-city]")
    page.select_option("[data-testid=set-prayer-city]", "alex")
    check(dayset(page).get("prayers") is True, "turning Prayer times on is kept")
    page.click("[data-testid=set-notes-apps]"); page.wait_for_selector("[data-testid=set-apps]")
    page.locator("[data-testid=set-apps] label", has_text="Instagram").locator("input").uncheck()
    check("com.instagram.android" in dayset(page).get("offApps", []), "an app can be left out of Your day (Instagram)")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=day-settings]").count() == 0, "Back closes Settings")
    page.evaluate("window.__attuneForceRamadan = true")
    page.evaluate("(() => { const v = JSON.parse(localStorage.getItem('attune:dayset:v1')); v.ramadan = true; localStorage.setItem('attune:dayset:v1', JSON.stringify(v)); window.dispatchEvent(new CustomEvent('attune-dayset')); })()")
    go(page, "chat"); go(page, "home"); page.wait_for_selector("[data-testid=day-prayers]", timeout=5000)
    check(page.locator("[data-testid^=day-prayer-]").count() == 5 and "alexandria" in page.inner_text("[data-testid=day-prayers]").lower(), "Home now shows the five prayers for Alexandria")
    check(page.locator("[data-testid=day-prayer-asr][data-next='1']").count() == 1, "…the next one (Asr at 1 pm) is marked")
    check("Instagram" not in (page.inner_text("[data-testid=day-apps]") if page.locator("[data-testid=day-apps]").count() else ""), "…and Instagram is no longer counted")
    check(page.locator("[data-testid=ramadan-card][data-to=iftar]").count() == 1 and ":" in page.inner_text("[data-testid=ramadan-left]"), "Ramadan mode on (during Ramadan): the countdown to iftar")
    page.fill("[data-testid=ramadan-ask]", "what should I cook for iftar?"); page.click("[data-testid=ramadan-send]"); page.wait_for_timeout(900)
    if page.locator("text=Recommended for this device").count(): page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)   # no model on the test phone: Chat asks to install one first
    box = page.evaluate("[...document.querySelectorAll('textarea')].map(t => t.value).join(' | ')")
    check("what should I cook for iftar" in box or "what should I cook for iftar" in page.inner_text("body"), "the Ramadan box: write anything → Chat opens with it, ready to ask: " + box[:80])
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
    ctx.close()
    # the evening: Close the day + Move to tomorrow
    EVE = datetime.datetime(2026, 11, 5, 21, 0, 0)
    REM = [{"id": "a", "at": ms(datetime.datetime(2026, 11, 5, 11, 0)), "title": "Call the insurance company", "repeat": "none"},
           {"id": "c", "at": ms(datetime.datetime(2026, 11, 5, 8, 0)), "title": "Pay the maid", "repeat": "none", "done": True, "doneAt": ms(datetime.datetime(2026, 11, 5, 8, 5))}]
    INIT2 = INIT + ";try{localStorage.setItem('attune:reminders:v1', %s)}catch(e){}" % json.dumps(json.dumps(REM))
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT2)
    ctx.clock.set_fixed_time(EVE)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=your-day]", timeout=15000); page.wait_for_timeout(800)
    key = page.evaluate("Object.keys(localStorage).find(k => /remind/i.test(k) && k !== 'attune:reminders:v1') || ''")
    if key:   # the app keeps reminders under its own key: put them there
        page.evaluate("(k) => localStorage.setItem(k, localStorage.getItem('attune:reminders:v1'))", key); go(page, "chat"); go(page, "home")
    check(page.locator("[data-testid=day-close]").count() == 1 and "Done 1 today" in page.inner_text("[data-testid=day-close]"), "at 9 pm Home says Close the day: done 1 today · 1 left")
    page.click("[data-testid=day-move]"); page.wait_for_timeout(500)
    k2 = key or "attune:reminders:v1"
    moved = [x for x in json.loads(page.evaluate("(k) => localStorage.getItem(k)", k2)) if x["id"] == "a"][0]
    check(datetime.datetime.fromtimestamp(moved["at"] / 1000).day == 6 and datetime.datetime.fromtimestamp(moved["at"] / 1000).hour == 11, "Move 1 to tomorrow → the call is on the 6th at 11:00")
    errs = real_errors(errors)
    check(not errs, "no page errors (evening): %s" % errs[:3])
env.close()
finish()
