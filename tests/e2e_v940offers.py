"""v9.4 (Ali, 5 Nov 2026, a screenshot of "Offer 3" on a blurred card: "very bad and confusing and does not open on the specific
listing"): an offer known by its hotel's name or page is a story card whose Book opens THAT hotel; one read without them is a plain
row of its days and price, and its button says what it opens (the site's hotels for those days).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v940offers.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
U = "https://www.booking.com/searchresults.html?ss=Madrid&checkin=%s&checkout=%s"
def bare(k, p, ci, co): return {"key": k, "name": "Booking.com", "price": p, "currency": "EGP", "checkin": ci, "checkout": co, "url": U % (ci, co), "text": "4 nights, 2 adults EGP %d" % p, "site": "Booking.com"}
HOTEL = {"id": "h1", "kind": "watch", "on": True, "title": "Hotels · Madrid · 4 nights", "site": "Booking.com", "url": "https://www.booking.com/searchresults.html?ss=Madrid&group_adults=2",
  "below": 60000, "currency": "EGP", "checks": [], "fields": {"city": "Madrid", "nights": 4},
  "best3": [{"key": "a", "name": "Room Mate Alicia", "price": 39900, "currency": "EGP", "checkin": "2027-01-04", "checkout": "2027-01-08", "href": "https://www.booking.com/hotel/es/alicia.html", "text": "Room Mate Alicia · 8.6", "site": "Booking.com"},
            bare("b", 42124, "2027-01-01", "2027-01-05"), bare("c", 44000, "2027-01-08", "2027-01-12")]}
ONLY = dict(HOTEL, id="h2", title="Hotels · Rome · 4 nights", best3=[bare("d", 30000, "2027-02-01", "2027-02-05")])
INIT = "try{localStorage.setItem('attune:agents:v1', %s)}catch(e){}" % json.dumps(json.dumps({"agents": [HOTEL, ONLY], "usual": {}}))
CAP = "(function w(){ if (window.AttuneNative) { window.AttuneNative.openInApp = (u) => { window.__opened = u; return JSON.stringify({ ok: true, how: 'app' }); }; } else setTimeout(w, 5); })();"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + CAP)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'agents'}}))"); page.wait_for_timeout(900)
    page.wait_for_selector("[data-testid=agent-podium]", timeout=8000)
    check(page.locator("[data-testid=agent-podium]").count() == 1, "only the agent with a named hotel shows the photo podium")
    check("Room Mate Alicia" in page.inner_text("[data-testid=agent-best-name]"), "…its best is the hotel known by name")
    check(page.locator("[data-testid=agent-more]").count() == 0, "…offers without a hotel's name are not story cards")
    rows = page.locator("[data-testid=agent-date-row]")
    check(rows.count() == 3, "they are plain rows of days and price (2 under Madrid, 1 for Rome): %d" % rows.count())
    txt = page.inner_text("[data-testid=agent-date-rows] >> nth=0")
    # (v9.9.21, Ali: "01/08 → 01/12 — January or August?"): the days in words with the weekday
    check("Offer" not in txt and "Jan 1 →" in txt and "Jan 5" in txt and "01/01" not in txt, "a row shows its days in words, never 'Offer 3' or 01/01: %r" % txt[:120])
    check("Hotels on Booking" in page.inner_text("[data-testid=agent-date-open] >> nth=0"), "its button says what it opens")
    page.click("[data-testid=agent-best-open]"); page.wait_for_timeout(300)
    o = page.evaluate("window.__opened") or ""
    check(o.startswith("https://www.booking.com/hotel/es/alicia.html") and "checkin=2027-01-04" in o and "group_adults=2" in o, "Book opens THAT hotel's own page with its days and guests: %s" % o)
    page.click("[data-testid=agent-best]"); page.wait_for_timeout(400)
    page.click("[data-testid=agent-sheet-book]"); page.wait_for_timeout(300)
    check((page.evaluate("window.__opened") or "").startswith("https://www.booking.com/hotel/es/alicia.html"), "…and so does the full-screen sheet's Book")
    page.click("[data-testid=agent-sheet-close]"); page.wait_for_timeout(300)
    page.locator("[data-testid=agent-date-open]").first.click(); page.wait_for_timeout(300)
    o = page.evaluate("window.__opened") or ""
    check("checkin=2027-01-01" in o and "checkout=2027-01-05" in o, "a row's button opens the site for exactly those days: %s" % o)
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
finish()
