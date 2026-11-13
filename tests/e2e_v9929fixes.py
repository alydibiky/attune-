"""v9.9.29 Ali's two screenshots (13 Nov):
 1. Travel showed "I found a stay · Telegram" for a news line «… قاعدة عسكرية خشبية …» and "Stay · 11 nights" in the trip — he couldn't
    tell what it was or what he had added. Now: news / chats / offers are never offered; a real booking shows the words it read; every
    trip item opens to its details + the message it came from, and can be removed.
 2. "Plan my week" showed the To-dos page through it (its page sat outside the themed part, so its background was see-through).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9929fixes.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NEWS = {"id": "t1", "ts": 1, "app": "Telegram", "title": "Telegram", "text": "عاجل | طيران الاحتلال يقصف قاعدة عسكرية خشبية الليلة الماضية بعد ١١ ليلة من القصف"}
HOTEL = {"id": "t2", "ts": 2, "app": "Gmail", "title": "Booking.com", "text": "Your reservation at Hilton Makkah is confirmed. Check-in 03 Mar 2027, check-out 07 Mar 2027. Confirmation number 4471923856"}
OLD = {"bookings": [{"id": "bold", "kind": "stay", "code": "", "name": "", "checkin": "", "checkout": "", "nights": 11, "sure": {}}], "seenMsgs": []}
def init(notes, trip=None):
    s = ("try { localStorage.setItem('attune:start','home'); %s } catch (e) {}\n"
         "(() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.recallNotes = () => %s; }; go(); })();")
    return s % (("localStorage.setItem('attune:trip:v1', %s);" % json.dumps(json.dumps(trip))) if trip else "", json.dumps(json.dumps(notes)))
def travel(page):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'travel'}}))"); page.wait_for_selector("[data-testid=travel-page]", timeout=8000)
    if page.locator("[data-testid=trip-bookings]").count() == 0:
        t = page.locator("[data-testid=travel-tab-trip]")
        if t.count(): t.first.click()
    page.wait_for_selector("[data-testid=trip-bookings]", timeout=6000); page.wait_for_timeout(300)
with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- 1a: the Telegram news line is not offered; the old empty "Stay · 11 nights" opens and can be removed
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init([NEWS], OLD))
    ctx.clock.set_fixed_time(datetime.datetime(2027, 2, 20, 12, 0, 0))
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    travel(page)
    check(page.locator("[data-testid=trip-found]").count() == 0, "1: the Telegram news line is NOT offered as a stay")
    it = page.locator("[data-testid=trip-item]")
    check(it.count() == 1 and "11 nights" in it.inner_text(), "1: the old item is listed: " + (it.inner_text() if it.count() else "none"))
    page.click("[data-testid=trip-item-open]"); page.wait_for_timeout(200)
    det = page.locator("[data-testid=trip-item-detail]")
    check(det.count() == 1 and "Hotel" in det.inner_text() and "Booking code" in det.inner_text(), "1: tapping it opens what was saved: " + (det.inner_text()[:200] if det.count() else "none"))
    page.click("[data-testid=trip-item-remove]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=trip-item]").count() == 0 and page.evaluate("JSON.parse(localStorage.getItem('attune:trip:v1')).bookings.length") == 0, "1: Remove from the trip takes it out (saved)")
    ctx.close()
    # ---- 1b: a real hotel email is offered WITH the words it read; once added, the item shows its details and the message
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init([NEWS, HOTEL]))
    ctx.clock.set_fixed_time(datetime.datetime(2027, 2, 20, 12, 0, 0))
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    travel(page); page.wait_for_selector("[data-testid=trip-found]", timeout=6000)
    check("Hilton Makkah" in page.locator("[data-testid=trip-found-line]").inner_text(), "1: the real booking is offered (Hilton Makkah)")
    msg = page.locator("[data-testid=trip-found-msg]")
    check(msg.count() == 1 and "Confirmation number 4471923856" in msg.inner_text(), "1: the card shows the words it read")
    page.click("[data-testid=trip-found-add]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=trip-found]").count() == 0, "1: after Add, the news line is still not offered")
    page.click("[data-testid=trip-item-open]"); page.wait_for_timeout(200)
    det = page.locator("[data-testid=trip-item-detail]").inner_text()
    check("Hilton Makkah" in det and "4" in det and "4471923856" in det, "1: details — hotel, nights, code: " + det[:200])
    im = page.locator("[data-testid=trip-item-msg]")
    check(im.count() == 1 and "Gmail" in im.inner_text() and "Check-in 03 Mar 2027" in im.inner_text(), "1: and the message it came from, with the app")
    ctx.close()
    # ---- 2: Plan my week (and the other full-screen pages there) have a solid background in the theme
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init="try{localStorage.setItem('attune:start','home');}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-weekplan'))"); page.wait_for_selector("[data-testid=weekplan-page]", timeout=6000)
    bg = page.evaluate("getComputedStyle(document.querySelector('[data-testid=weekplan-page]')).backgroundColor")
    check(bg not in ("rgba(0, 0, 0, 0)", "transparent"), "2: Plan my week has a solid background (was see-through): " + bg)
    page.locator("[data-testid=weekplan-back]").click(); page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-braindump',{detail:{text:''}}))"); page.wait_for_timeout(400)
    if page.locator("[data-testid=braindump]").count():
        bg = page.evaluate("getComputedStyle(document.querySelector('[data-testid=braindump]')).backgroundColor")
        check(bg not in ("rgba(0, 0, 0, 0)", "transparent"), "2: brain dump too: " + bg)
    ctx.close()
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
