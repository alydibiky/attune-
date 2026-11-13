"""v9.9.28 place reminders (Ali's P-2, OK-2 OK-3 OK-4): Play build says coming soon; the APK asks for "Allow all the time"
  with one line + Allow (no separate screen — OK-1 was not picked); once allowed, saving hands the phone part the places
  and the reminder with its "You arrived / You left" titles.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9928places.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

def run(br, env, errors, play, allowed):
    init = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:rem:open',JSON.stringify(['fill']));}catch(e){}"
            "window.__place={play:%s,allowed:%s,asked:0,sent:[]};"
            "(function w(){var N=window.AttuneNative;if(!N){return setTimeout(w,5);}"
            "N.placeReminders=function(){return true};N.placeIsPlay=function(){return window.__place.play};"
            "N.placeAllowed=function(){return window.__place.allowed};"
            "N.placeAsk=function(){window.__place.asked++;window.__place.allowed=true;setTimeout(function(){window.dispatchEvent(new Event('attune-place'))},10)};"
            "N.setPlaceReminders=function(j){window.__place.sent.push(JSON.parse(j))};})();") % (json.dumps(play), json.dumps(allowed))
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
    ctx.grant_permissions(["geolocation"]); ctx.set_geolocation({"latitude": 29.9601, "longitude": 31.2569})
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", "reminders")
    page.wait_for_selector("[data-testid=rem-fill]", timeout=8000)
    page.fill("[data-testid=rem-title]", "Buy milk and bread")
    page.locator("[data-testid=rem-when-place]").click(); page.wait_for_timeout(200)
    return ctx, page

with sync_playwright() as p:
    env = Env(); errors = []
    br = p.chromium.launch()
    # ---- Play build
    ctx, page = run(br, env, errors, True, False)
    check(page.locator("[data-testid=rem-place-soon]").count() == 1 and "coming soon" in page.locator("[data-testid=rem-place-soon]").inner_text().lower(), "Play: says 'coming soon'")
    check(page.locator("[data-testid=rem-place-allow]").count() == 0, "Play: never asks for the location permission")
    page.fill("[data-testid=rem-place-name]", "Carrefour Maadi"); page.locator("[data-testid=rem-place-here]").click(); page.wait_for_timeout(700)
    page.locator("[data-testid=rem-add]").click(); page.wait_for_timeout(300)
    it = page.locator("[data-testid=rem-place-item]")
    check(it.count() == 1 and "Coming soon" in it.inner_text(), "Play: the saved reminder is listed as 'Coming soon': " + (it.inner_text() if it.count() else "none"))
    ctx.close()
    # ---- APK, permission missing → one line + Allow
    ctx, page = run(br, env, errors, False, False)
    need = page.locator("[data-testid=rem-place-need]")
    check(need.count() == 1 and "Allow all the time" in need.inner_text(), "APK: one line explains 'Allow all the time'")
    check(page.locator("[data-testid=rem-place-soon]").count() == 0, "APK: no 'coming soon'")
    page.locator("[data-testid=rem-place-allow]").click(); page.wait_for_timeout(400)
    check(page.evaluate("window.__place.asked") == 1, "APK: Allow asks Android (placeAsk)")
    check(page.locator("[data-testid=rem-place-ready]").count() == 1 and page.locator("[data-testid=rem-place-need]").count() == 0, "APK: once allowed the line turns to 'ready'")
    page.fill("[data-testid=rem-place-name]", "Carrefour Maadi"); page.locator("[data-testid=rem-place-here]").click(); page.wait_for_timeout(700)
    page.locator("[data-testid=rem-place-leave]").click(); page.locator("[data-testid=rem-add]").click(); page.wait_for_timeout(300)
    sent = page.evaluate("window.__place.sent")
    last = sent[-1] if sent else {}
    rs = last.get("reminders", [])
    check(len(rs) == 1 and rs[0]["title"] == "Buy milk and bread" and rs[0]["on"] == "leave", "APK: the reminder goes to the phone part: " + json.dumps(rs)[:300])
    check(rs and rs[0].get("headArrive") == "You arrived: Carrefour Maadi" and rs[0].get("headLeave") == "You left: Carrefour Maadi", "APK: with its notification titles")
    check(len(last.get("places", [])) == 1 and abs(last["places"][0]["lat"] - 29.9601) < 1e-4, "APK: and the place with its spot")
    it = page.locator("[data-testid=rem-place-item]")
    check(it.count() == 1 and "Waiting" not in it.inner_text() and "Coming soon" not in it.inner_text(), "APK: listed as live (no 'waiting')")
    page.locator("[data-testid=rem-place-remove]").click(); page.wait_for_timeout(200)
    check(page.evaluate("window.__place.sent[window.__place.sent.length-1].reminders.length") == 0, "APK: removing it tells the phone part too")
    ctx.close()
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
