"""v9.9.25 B7 travel (Ali's picks TR1 B, TR2 A+B, TR3 A): Travel → Trip: the EgyptAir SMS Recall kept is offered — "I found a flight ·
MS643 · CAI → JED …" — Add puts it in the trip; a pasted schedule change updates it (one flight, the new time); the hotel is added; the
flight-day card on the day ticks along (gate F7 from EgyptAir; a "gate B2" from an unknown number ignored) and is on Home too; its
notifications are scheduled on the phone; Money: 30,000 EGP ≈ 2,301 SAR and a shared cost settles; Papers: the passport ending 1 May
2027 must be renewed (Saudi: 6 months from arrival).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9925travel.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
NOW = datetime.datetime(2027, 3, 3, 7, 45, 0)
NOTES = [{"id": "n1", "ts": 1, "app": "EgyptAir", "title": "EgyptAir", "text": "Your flight MS 643 Cairo (CAI) to Jeddah (JED) on 03 Mar 2027 at 09:40. Booking ref K7QX2P."}]
NOTES2 = NOTES + [{"id": "n2", "ts": int(datetime.datetime(2027, 3, 3, 7, 40).timestamp() * 1000), "app": "EgyptAir", "title": "EgyptAir", "text": "Gate changed to F7. Boarding 09:00"},
                  {"id": "n3", "ts": int(datetime.datetime(2027, 3, 3, 7, 41).timestamp() * 1000), "app": "Messages", "title": "+201001234567", "text": "Gate changed to B2"}]
RADAR = {"items": [{"id": "p1", "kind": "expiry", "doc": "passport", "title": "Passport", "date": "2027-05-01", "status": "active"}]}
def init(notes):
    return ("try { localStorage.setItem('attune:start','home'); localStorage.setItem('attune:radar:v1', %s); } catch (e) {}\n"
            "window.__sched = []; (() => { const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0); N.recallNotes = () => %s;"
            " N.schedule = (j) => { window.__sched.push(JSON.parse(j)); return true; }; N.unschedule = () => true; N.scheduled = () => '[]'; }; go(); })();") % (json.dumps(json.dumps(RADAR)), json.dumps(json.dumps(notes)))
def travel(page):
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'travel'}}))"); page.wait_for_selector("[data-testid=travel-page]", timeout=8000)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(NOTES))
    ctx.clock.set_fixed_time(datetime.datetime(2027, 2, 20, 12, 0, 0))
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    travel(page); page.wait_for_selector("[data-testid=trip-found]", timeout=6000)
    ln = page.locator("[data-testid=trip-found-line]").inner_text()
    check("MS643" in ln and "CAI → JED" in ln and "09:40" in ln and "K7QX2P" in ln, "asks first: " + ln)
    check(page.evaluate("JSON.parse(localStorage.getItem('attune:trip:v1') || '{}').bookings") in (None, []), "nothing added before the tap")
    page.click("[data-testid=trip-found-add]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=trip-item]").count() == 1, "Add → the flight is in the trip")
    page.fill("[data-testid=trip-paste]", "Schedule change: flight MS643 now departs on 03/03/2027 at 10:15 instead of 09:40. PNR K7QX2P"); page.click("[data-testid=trip-paste-read]")
    page.wait_for_selector("[data-testid=trip-found][data-status=changed]"); page.click("[data-testid=trip-found-add]"); page.wait_for_timeout(300)
    it = page.locator("[data-testid=trip-item]").all_inner_texts()
    check(len(it) == 1 and "10:15" in it[0] and "CAI → JED" in it[0], "a change updates it — one flight, the new time, the route kept: %s" % it)
    page.fill("[data-testid=trip-paste]", "Booking.com: Your reservation at Hilton Makkah is confirmed. Check-in 03 Mar 2027, check-out 07 Mar 2027. Confirmation number 4471923856"); page.click("[data-testid=trip-paste-read]")
    page.click("[data-testid=trip-found-add]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=trip-item]").count() == 2 and "Hilton Makkah" in page.locator("[data-testid=trip-items]").inner_text(), "the hotel added (4 nights)")
    # Money (pick Saudi Arabia as the country)
    page.fill("[data-testid=travel-find]", "saudi"); page.wait_for_timeout(200)
    if page.locator("[data-testid=travel-pack-sa]").count(): page.click("[data-testid=travel-pack-sa]"); page.wait_for_timeout(500)
    page.click("[data-testid=travel-tab-money]"); page.fill("[data-testid=trip-budget]", "30000"); page.fill("[data-testid=trip-rate]", "0.0767"); page.wait_for_timeout(100)
    check("30,000" in page.locator("[data-testid=trip-budget-line]").inner_text() and "2,301" in page.locator("[data-testid=trip-budget-line]").inner_text(), "Money: 30,000 EGP ≈ 2,301 SAR")
    for n in ["Ali", "Mona"]: page.fill("[data-testid=trip-person]", n); page.click("[data-testid=trip-person-add]")
    page.fill("[data-testid=trip-cost]", "1000"); page.click("[data-testid=trip-cost-add]"); page.wait_for_timeout(100)
    check("Mona pays Ali 500" in page.locator("[data-testid=trip-split]").inner_text(), "a shared 1,000 → Mona pays Ali 500")
    # Papers
    page.click("[data-testid=travel-tab-papers]")
    pp = page.locator("[data-testid=trip-passport]")
    check(pp.get_attribute("data-ok") == "" and "Renew" in pp.inner_text() and "6 months from arrival" in pp.inner_text(), "Papers: passport ends 1 May 2027 → renew (Saudi, 6 months from arrival)")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    trip = page.evaluate("localStorage.getItem('attune:trip:v1')")
    # the flight day: the gate from EgyptAir, not from an unknown number
    ctx.close(); ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(NOTES2) + "try{localStorage.setItem('attune:trip:v1', %s)}catch(e){}" % json.dumps(trip))
    ctx.clock.set_fixed_time(NOW)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.wait_for_selector("[data-testid=flight-day]", timeout=6000)
    card = page.locator("[data-testid=flight-day]").inner_text()
    check("Gate F7" in card and "B2" not in card and "boarding 09:00" in card, "Home on the day: the flight-day card — gate F7 from EgyptAir (B2 from an unknown number ignored): " + card.replace("\n", " | "))
    steps = page.evaluate("[...document.querySelectorAll('[data-testid=flight-step]')].map(e => e.dataset.key + (e.dataset.done ? '✓' : ''))")
    check(steps == ["checkin", "leave✓", "boarding", "takeoff"], "it ticks along: %s" % steps)
    page.click("[data-testid=flight-checked-in]"); page.wait_for_timeout(200)
    page.evaluate("window.__attuneAddReminder && window.__attuneAddReminder({ id: 'x1', at: Date.now() + 864e5, title: 'Water the plants', body: '', repeat: 'none', created: 1, done: false })"); page.wait_for_timeout(300)
    sched = page.evaluate("window.__sched.map(x => x.id + ' ' + x.title)")
    check(any("fd-MS643-gate-F7" in s and "Gate F7" in s for s in sched), "the gate change is a notification on the phone: %s" % [s for s in sched if s.startswith("fd-")])
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
