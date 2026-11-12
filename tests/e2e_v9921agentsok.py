"""v9.9.21 Ali OK'd OK-1…OK-4 (the combined Agents page): one clear list (no Cards / List / Board), all the offers inside an agent —
10 written clearly, each Open going to ITS page — "What I watch" with every setting changeable, one sheet per setting, Save → check again.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9921agentsok.py
"""
import json, time, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000); H = 3600000
d0 = datetime.date.today() + datetime.timedelta(days=40); d1 = d0 + datetime.timedelta(days=4)
HOTELS = ["Swissôtel Makkah", "Hilton Suites Makkah", "Pullman Zamzam", "Fairmont Clock Tower", "Conrad Makkah", "Le Meridien Towers", "Jabal Omar Marriott", "Anjum Hotel", "Movenpick Hajar", "Raffles Makkah"]
B3 = [{"name": n, "price": 41495 + i * 1700, "stars": 5, "dist": 150 + i * 90, "checkin": d0.isoformat(), "checkout": d1.isoformat(), "site": "booking.com", "href": "https://www.booking.com/hotel/sa/h%d.html" % i} for i, n in enumerate(HOTELS)]
HOTEL = {"id": "h1", "kind": "watch", "on": True, "created": now - 50 * H, "title": "Hotels · Masjid al-Haram · 4 nights · 5★", "site": "Booking.com",
         "url": "https://www.booking.com/searchresults.html?ss=Mecca", "below": 45000, "currency": "EGP",
         "fields": {"city": "Masjid al-Haram, Makkah", "checkin": d0.isoformat(), "checkout": d1.isoformat(), "nights": 4, "adults": 2, "rooms": 1, "stars": [5], "near": True}, "rules": {},
         "checks": [{"at": now - H, "price": 41495}], "best3": B3}
CLIPS = {"id": "p1", "kind": "watch", "on": True, "created": now - 30 * H, "title": "Huawei free clips 2", "site": "3 stores", "url": "https://www.amazon.eg/s?k=huawei", "below": 7500, "currency": "EGP",
         "what": "Huawei FreeClip 2", "rules": {}, "checks": [{"at": now - 20 * H, "price": 120}],
         "best3": [{"name": "Huawei FreeClip 2", "price": 120, "site": "amazon.eg", "href": "https://www.amazon.eg/dp/case"}, {"name": "Huawei FreeClip 2", "price": 7999, "site": "noon.com", "href": "https://www.noon.com/egypt-en/freeclip-2/p/"}]}
INIT = """try{localStorage.setItem('attune:start','home'); localStorage.setItem('attune:agents:legacy','0'); localStorage.setItem('attune:agents:v1', %s);}catch(e){}
(() => { function w(){ const N = window.AttuneNative; if (!N) return setTimeout(w, 5); window.__opened = [];
  N.agentWatchPlan = (p) => 'ok'; N.agentWatchTake = () => '{}'; N.agentWatchWords = (j) => 'ok';
  N.openInApp = (u) => { window.__opened.push(u); return JSON.stringify({ok: true, how: 'app'}); };
  N.openUrl = (u) => { window.__opened.push(u); return true; };
  N.agentOpen = (id, arg) => { window.__checked = (window.__checked || 0) + 1; setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({reason: 'done', offers: 0, top: []})), 50); };
  } w(); })();""" % json.dumps(json.dumps({"agents": [HOTEL, CLIPS], "usual": {}}))
def go(page, mode, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(300)
clean = lambda t: t.replace("\u2066", "").replace("\u2069", "").replace("\n", " ")
agents = lambda page: page.evaluate("JSON.parse(localStorage.getItem('attune:agents:v1')).agents")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    go(page, "agents", "[data-testid=agents-rows]")
    # OK-1
    check(page.locator("[data-testid=agents-view]").count() == 0 and page.locator("[data-testid=agents-a5], [data-testid=agents-board]").count() == 0, "OK-1: no Cards / List / Board switch — one list")
    rows = page.locator("[data-testid=agents-row]")
    h = clean(rows.filter(has_text="Masjid").inner_text())
    wdname = d0.strftime("%a")
    check("10 offers" in h and wdname in h and "41,495" in h and "/" not in h.split("·")[0], "OK-1: the hotel line in words — dates with the weekday, 10 offers, the best price: " + h[:150])
    c = clean(rows.filter(has_text="Huawei").inner_text())
    check("120" not in c.replace("7,500", "") and "7,999" in c, "OK-1: the FreeClip shows 7,999 — never the EGP 120 case: " + c[:120])
    # OK-2
    rows.filter(has_text="Masjid").click(); page.wait_for_selector("[data-testid=agent-offers]", timeout=5000); page.wait_for_timeout(200)
    offs = page.locator("[data-testid=agent-offer]")
    check(offs.count() == 10, "OK-2: all 10 offers listed: %d" % offs.count())
    first = clean(offs.nth(0).inner_text())
    check("Swissôtel" in first and "5★" in first and "41,495" in first and "a night" in first and "m away" in first and "booking" in first.lower(), "OK-2: each written clearly (name, stars, distance, dates, site, total, per night): " + first[:200])
    for i in (0, 6, 9):
        offs.nth(i).locator("[data-testid=agent-offer-open]").click(); page.wait_for_timeout(250)
    op = page.evaluate("window.__opened")
    check(any("/hotel/sa/h0.html" in u for u in op) and any("/hotel/sa/h6.html" in u for u in op) and any("/hotel/sa/h9.html" in u for u in op), "OK-2: Open on offers 1, 7 and 10 goes to EACH one's own page: " + json.dumps(op)[:300])
    check(not any("searchresults" in u for u in op), "OK-2: never the search page")
    page.click("[data-testid=agent-offers-sort-dist]"); page.wait_for_timeout(150)
    check("Swissôtel" in offs.nth(0).inner_text(), "OK-2: sort by Closest works (Swissôtel is 150 m)")
    # OK-3 + OK-4
    page.click("[data-testid=agent-watch-open]"); page.wait_for_selector("[data-testid=agent-watchpage]", timeout=4000)
    keys = page.locator("[data-testid^=agent-set-]").evaluate_all("els => els.map(e => e.dataset.testid)")
    check(all(("agent-set-" + k) in keys for k in ["dates", "city", "stars", "guests", "budget", "sites", "must", "avoid", "hours"]), "OK-3: every setting is a line: dates, where, stars, guests, budget, sites, must have, avoid, check")
    page.click("[data-testid=agent-set-budget]"); page.fill("[data-testid=set-budget]", "40000"); page.click("[data-testid=agent-set-save]"); page.wait_for_timeout(400)
    a = [x for x in agents(page) if x["id"] == "h1"][0]
    check(a["below"] == 40000 and a["rules"].get("below") == 40000 and len(a["best3"]) == 10, "OK-4: budget → 40,000 (the offers stay; the rule filters them)")
    check("40,000" in clean(page.locator("[data-testid=agent-set-val-budget]").inner_text()), "OK-3: the line now says up to 40,000")
    nd0 = d0 + datetime.timedelta(days=2); nd1 = nd0 + datetime.timedelta(days=5)
    page.click("[data-testid=agent-set-dates]"); page.fill("[data-testid=set-from]", nd0.isoformat()); page.fill("[data-testid=set-to]", nd1.isoformat()); page.click("[data-testid=agent-set-save]"); page.wait_for_timeout(400)
    a = [x for x in agents(page) if x["id"] == "h1"][0]
    check(a["fields"]["checkin"] == nd0.isoformat() and a["fields"]["nights"] == 5 and "checkin=" + nd0.isoformat() in a["url"] and a["best3"] == [] and "5 nights" in a["title"], "OK-4: new dates → the search itself changes (5 nights, new link) and the old offers are cleared: " + a["title"])
    page.click("[data-testid=agent-set-stars]"); page.click("[data-testid=set-stars-4]"); page.click("[data-testid=agent-set-save]"); page.wait_for_timeout(300)
    a = [x for x in agents(page) if x["id"] == "h1"][0]
    check(a["fields"]["stars"] == [4, 5] and a["rules"]["minStars"] == 4, "OK-4: stars → 4★ or more")
    page.click("[data-testid=agent-set-must]"); page.fill("[data-testid=set-word-input]", "breakfast"); page.keyboard.press("Enter"); page.click("[data-testid=agent-set-save]"); page.wait_for_timeout(300)
    a = [x for x in agents(page) if x["id"] == "h1"][0]
    check(a["rules"].get("mustHave") == ["breakfast"], "OK-4: must have → breakfast")
    page.click("[data-testid=agent-set-hours]"); page.click("[data-testid=set-hours-6]"); page.click("[data-testid=agent-set-save]"); page.wait_for_timeout(300)
    check([x for x in agents(page) if x["id"] == "h1"][0]["rules"]["hours"] == 6 and "6 hours" in clean(page.locator("[data-testid=agent-set-val-hours]").inner_text()), "OK-4: check → every 6 hours")
    check(page.evaluate("window.__checked || 0") >= 1, "Save → it checks again now")
    page.click("[data-testid=agent-watch-pause]"); page.wait_for_timeout(200)
    check([x for x in agents(page) if x["id"] == "h1"][0]["on"] is False, "Pause from What I watch")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
