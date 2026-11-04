"""v9.2 Agents (Ali, 4 Nov 2026, picked 2A: one pattern for every agent; "make sure the hotel photos, or at least a logo instead of the
word booking.com"; "make sure that I can interact with the agents and set any rules I want and it understands").
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v922agents.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
HOTEL = {"id": "h1", "kind": "watch", "on": True, "title": "Hotels · Masjid al-Haram · 4 nights", "site": "Booking.com", "url": "https://www.booking.com/searchresults.html?ss=Makkah",
  "below": 50000, "currency": "EGP", "checks": [], "fields": {"city": "Masjid al-Haram, Makkah", "nights": 4},
  "best3": [{"key": "a", "name": "Booking.com", "price": 30000, "currency": "EGP", "checkin": "2027-01-08", "checkout": "2027-01-12", "text": "Elaf Al Mashaer · 3 stars · 7.9 · 1.2 km", "site": "Booking.com"},
            {"key": "b", "name": "Hilton Suites Makkah", "price": 38000, "currency": "EGP", "checkin": "2027-01-08", "checkout": "2027-01-12", "text": "5-star hotel · 9.0 · 200 m · Breakfast included", "site": "Booking.com"},
            {"key": "c", "name": "Swissôtel Makkah", "price": 41000, "currency": "EGP", "checkin": "2027-01-04", "checkout": "2027-01-08", "text": "5 stars · 8.6 · 350 m", "site": "Booking.com"}]}
BUY = {"id": "b1", "kind": "buy", "on": True, "what": "Huawei FreeClip 2", "site": "Amazon · noon", "below": 8400, "currency": "EGP", "step": "confirm",
  "pending": {"name": "HUAWEI FreeClip 2 Open-Ear", "price": 7950, "currency": "EGP", "site": "noon", "href": "https://www.noon.com/x"}, "checks": []}
INIT = "try{localStorage.setItem('attune:agents:v1', %s)}catch(e){}" % json.dumps(json.dumps({"agents": [HOTEL, BUY], "usual": {}}))
CAP = "window.__plans = []; (function w(){ if (window.AttuneNative) { window.AttuneNative.agentWatchPlan = (p) => window.__plans.push(p); window.AttuneNative.openInApp = (u) => { window.__opened = u; return JSON.stringify({ ok: true, how: 'app' }); }; } else setTimeout(w, 5); })();"
SCOUT = "try{localStorage.setItem('attune:scout:v1', JSON.stringify({ goals: [{ id: 'g1', text: 'Hyundai Tucson 2022 used', seen: ['a','b','c'], unseen: ['d'], lastRun: Date.now() - 3600000 }] }))}catch(e){}"
def go(page, m): page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(700)
def agents(page): return {a["id"]: a for a in json.loads(page.evaluate("localStorage.getItem('attune:agents:v1')"))["agents"]}
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + ";" + CAP + ";" + SCOUT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1200); go(page, "agents")
    page.wait_for_selector("[data-testid=agent-head]", timeout=8000)
    # one pattern, Needs you first
    groups = page.evaluate("[...document.querySelectorAll('[data-testid^=agents-group-]')].map(e => e.dataset.testid.slice(13))")
    check(groups == ["needs", "working"], "groups in order: Needs you, then Working: %s" % groups)
    check("Huawei FreeClip 2" in page.inner_text("[data-testid=agents-group-needs]"), "…the agent waiting for an OK to buy is under Needs you")
    st = page.evaluate("[...document.querySelectorAll('[data-testid=agent-status]')].map(e => e.innerText)")
    check(st == ["Needs you", "Found", "Found"], "every card shows its status the same way — the Scout goal too: %s" % st)
    sc = page.locator("[data-testid=agents-scout]")
    check(sc.locator("[data-testid=agent-head]").count() == 1 and sc.locator("[data-testid=agent-menu]").count() == 1 and sc.locator("[data-testid=agent-actions]").count() == 1,
          "v9.2 round 3 (Ali: “not consistent”): the Scout card has the same header (status, ⋯) and button row as every agent")
    # logos, never the word
    marks = page.evaluate("[...document.querySelectorAll('[data-testid=agent-head] [data-testid=site-mark]')].map(e => e.innerText)")
    check("B." in marks, "the hotel agent shows Booking's mark, not the word: %s" % marks)
    check(page.locator("[data-testid=agent-photo-mark]").count() >= 1, "an offer with no photo shows the site's mark on its picture")
    names = page.evaluate("[...document.querySelectorAll('[data-testid=agent-best-name], [data-testid=agent-more] span.block.text-\\\\[13\\\\.5px\\\\]')].map(e => e.innerText)")
    check(all("Booking.com" not in n for n in names) and "Elaf Al Mashaer" in " ".join(names), "an offer saved as “Booking.com” shows its hotel's own name: %s" % names)
    # rules: talk to the agent
    hotel = page.locator("[data-testid=agent-watch]")
    hotel.locator("[data-testid=agent-menu]").click(); hotel.locator("[data-testid=agent-rules-open]").click()
    hotel.locator("[data-testid=agent-rule-input]").fill("only 5 stars"); hotel.locator("[data-testid=agent-rule-go]").click(); page.wait_for_timeout(300)
    check("5+ stars" in hotel.locator("[data-testid=agent-rules]").inner_text() and "Got it" in hotel.locator("[data-testid=agent-rule-said]").inner_text(), "“only 5 stars” → understood, shown as a chip")
    check(agents(page)["h1"]["rules"]["minStars"] == 5, "…kept on the agent")
    check("Elaf" not in page.inner_text("[data-testid=agent-best-name]") and "Hilton" in page.inner_text("[data-testid=agent-best-name]"), "…the 3-star hotel is no longer the best offer — Hilton (5 stars) is")
    hotel.locator("[data-testid=agent-rule-input]").fill("بلاش اكتر من ٣٠٠ متر مشي"); hotel.locator("[data-testid=agent-rule-go]").click(); page.wait_for_timeout(300)
    check(agents(page)["h1"]["rules"].get("maxWalk") == 300, "an Egyptian Arabic rule: «٣٠٠ متر مشي» → walk under 300 m")
    check(page.locator("[data-testid=agent-more]").count() == 0, "…Swissôtel (350 m) drops out, only Hilton (200 m) is left")
    hotel.locator("[data-testid=agent-rule-input]").fill("check every 6 hours"); hotel.locator("[data-testid=agent-rule-go]").click(); page.wait_for_timeout(600)
    plans = page.evaluate("window.__plans")
    check(any('"hours":6' in x for x in plans), "“check every 6 hours” → the phone is asked to check this agent every 6 hours")
    hotel.locator("[data-testid=agent-rule-input]").fill("make it nice please"); hotel.locator("[data-testid=agent-rule-go]").click(); page.wait_for_timeout(300)
    check("didn't understand" in hotel.locator("[data-testid=agent-rule-said]").inner_text(), "a sentence with no rule (and no model) → says so, nothing changes")
    hotel.locator("[data-testid=agent-rule-chip]", has_text="walk").click(); page.wait_for_timeout(300)
    check("maxWalk" not in agents(page)["h1"]["rules"] and page.locator("[data-testid=agent-more]").count() == 1, "× on a chip removes that rule only — Swissôtel is back")
    # v9.2 round 3 (Ali: "when it opens Booking it doesn't open the specific listing"): the card's button opens the best offer itself
    page.click("[data-testid=agent-watch] [data-testid=agent-open]"); page.wait_for_timeout(200)
    op = page.evaluate("window.__opened") or ""
    check("ss=Hilton" in op and "booking.com" in op, "“Open the best offer” opens THAT hotel (searched by its own name, with the dates), not the whole list: " + op[:120])
    check(page.locator("[data-testid=agent-watch] [data-testid=agent-actions] button").count() == 2, "one row: Check now + Open the best offer (the site search lives in ⋯)")
    # ⋯ menu: pause
    hotel.locator("[data-testid=agent-menu]").click(); hotel.locator("[data-testid=agent-toggle]").click(); page.wait_for_timeout(300)
    check(agents(page)["h1"]["on"] is False and page.locator("[data-testid=agents-group-done]").count() == 1, "Pause (in ⋯) moves it to Done & paused")
    # board
    page.click("[data-testid=agents-view-board]"); page.wait_for_selector("[data-testid=agents-board]")
    cols = page.evaluate("[...document.querySelectorAll('[data-testid^=agents-col-]')].map(e => e.dataset.testid.slice(11) + ':' + e.querySelectorAll('[data-testid=agents-board-card]').length)")
    check(cols == ["needs:1", "working:0", "found:1", "done:1"], "Board: Needs you · Working · Found · Done & paused: %s" % cols)
    check(page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "no sideways scroll of the page (the board scrolls inside itself)")
    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
env.close()
finish()
