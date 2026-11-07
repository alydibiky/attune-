"""v9.8 (Ali, 7 Nov: "the agents still don't redirect to the specific listing — fix it for good"): the agent kit gives each offer
its OWN page only (never the map / reviews / search link of its card), and goTo() finds one offer on a results page by its name
(else its price) and goes INTO its page — by its listing link, or by tapping it when the site opens cards by script.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v980agentopen.py
"""
import os
from playwright.sync_api import sync_playwright
from harness import check, finish, HERE
KIT = os.path.join(HERE, "..", "web-src", "agent-kit.js")
RESULTS = """<html><body><h1>Makkah · 4 nights</h1>
<div class=card><h3>Swissotel Makkah</h3><a href="https://www.hotels.test/search?city=makkah&map=1">Show on map</a>
  <a href="https://www.hotels.test/hotel/sa/swissotel-makkah.html?checkin=2026-12-01">See availability</a><div>SAR 2,450</div></div>
<div class=card><h3>Pullman ZamZam Makkah</h3><a href="https://www.hotels.test/reviews/pullman">1,203 reviews</a><div>SAR 1,980</div></div>
<div class=card id=js><h3 onclick="location.assign('https://www.hotels.test/makkah/hilton-suites-room')">Hilton Suites Makkah</h3><div>SAR 2,100</div></div>
<div class=card><h3>Agoda style</h3><a href="https://www.hotels.test/en-gb/le-meridien/hotel/makkah-sa.html">Le Meridien Towers</a><div>SAR 1,700</div></div>
</body></html>"""
PAGE = "<html><body><h1>%s</h1></body></html>"
with sync_playwright() as p:
    br = p.chromium.launch(); page = br.new_page()
    page.route("https://www.hotels.test/**", lambda route: route.fulfill(status=200, content_type="text/html",
        body=RESULTS if "/results" in route.request.url else PAGE % route.request.url))
    page.goto("https://www.hotels.test/results?city=makkah"); page.add_script_tag(path=KIT)
    top = page.evaluate("window.__attuneAgent.best({cheapest:true, many:true}, true).top")
    by = {o["name"]: o["href"] for o in top}
    check(by.get("Swissotel Makkah", "").startswith("https://www.hotels.test/hotel/sa/swissotel-makkah.html"), "Swissotel: its own hotel page, not the map link: %s" % by.get("Swissotel Makkah"))
    check(by.get("Pullman ZamZam Makkah") == "", "Pullman: no own link (only reviews) → none, never the reviews page: %r" % by.get("Pullman ZamZam Makkah"))
    check("/hotel/makkah-sa.html" in by.get("Le Meridien Towers", by.get("Agoda style", "")), "an Agoda-style hotel link is a listing")
    # goTo by name → its listing link
    r = page.evaluate("window.__attuneAgent.goTo({name: 'Swissotel Makkah', price: 2450})")
    check(r["ok"] and "swissotel-makkah" in r["href"], "goTo by name finds Swissotel's own page")
    page.wait_for_url("**/hotel/sa/swissotel-makkah.html**", timeout=5000)
    check("swissotel-makkah" in page.url, "…and goes into it: %s" % page.url)
    # goTo an offer opened by script only → tapped
    page.goto("https://www.hotels.test/results?city=makkah"); page.add_script_tag(path=KIT)
    r = page.evaluate("window.__attuneAgent.goTo({name: 'Hilton Suites', price: 2100})")
    check(r["ok"] and r.get("tapped"), "Hilton (no link, opens by script): tapped")
    page.wait_for_url("**/hilton-suites-room", timeout=5000)
    check("hilton-suites-room" in page.url, "…and its own page opened: %s" % page.url)
    # by price when the name is unknown
    page.goto("https://www.hotels.test/results?city=makkah"); page.add_script_tag(path=KIT)
    r = page.evaluate("window.__attuneAgent.goTo({name: '', price: 2450})")
    check(r["ok"] and "swissotel" in r["href"], "no name → found by its price")
    r = page.evaluate("window.__attuneAgent.goTo({name: 'Ritz Paris', price: 99})")
    check(not r["ok"], "an offer that isn't on the page → not ok (nothing random opened)")
    br.close()
finish()
