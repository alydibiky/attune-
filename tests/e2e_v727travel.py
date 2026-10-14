"""v6.27 Travel in design A "Calm": the country picked from a search, five tabs (Trip · Arrive · Say it · Ask · Know) with
everything the old page had; the passport in Deadline Radar checked against the trip; flight and hotel links with the trip's
dates; the trip and its visa reminder sent to Radar; the fair-price check from the pack's own prices; phrases spoken and shown big.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727travel.py     (SHOTS=dir for screenshots)
"""
import os, json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
RADAR = {"items": [{"id": "p1", "kind": "expiry", "doc": "passport", "title": "Passport", "date": "2027-02-10", "status": "active", "created": 1}], "seen": []}
INIT = "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:radar:v1',%s);localStorage.setItem('attune:nat','eg')}catch(e){}\n" % json.dumps(json.dumps(RADAR)) + \
    "window.__agent=[];window.addEventListener('attune-agent',(e)=>window.__agent.push(e.detail.link.label));"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Travel')").first.click()
    page.wait_for_selector("[data-testid=travel-page]", timeout=5000)
    check(page.locator("[data-testid=travel-packs]").count() == 1, "no country yet → the pack list is shown")
    page.fill("[data-testid=travel-find]", "turk")
    check(page.locator("[data-testid^=travel-pack-]").count() == 1, "searching 'turk' leaves one country")
    page.click("[data-testid=travel-pack-tr]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=travel-packs]").count() == 0 and "Turkey" in page.locator("h2").first.inner_text(), "Turkey picked; the list folds away")
    for t in ["trip", "arrive", "say", "ask", "know"]: check(page.locator(f"[data-testid=travel-tab-{t}]").count() == 1, "tab " + t)
    # the trip
    check("Add your passport" not in page.locator("[data-testid=travel-passport]").inner_text(), "the passport is found in Radar")
    page.fill("[data-testid=travel-depart]", "2026-11-01"); page.fill("[data-testid=travel-ret]", "2026-11-08"); page.fill("[data-testid=travel-from]", "cai")
    page.wait_for_timeout(200)
    pp = page.locator("[data-testid=travel-pp]").inner_text()
    check("Less than 6 months" in pp and "2027-02-10" in pp, "passport ends Feb 2027, back 8 Nov → warned: " + pp[:90])
    check("7 nights" in page.locator("[data-testid=travel-trip]").inner_text(), "7 nights counted")
    check(page.locator("[data-testid=travel-entry]").count() == 1, "entry rules for an Egyptian passport are shown")
    fl = page.locator("[data-testid=travel-flight]")
    check(fl.count() == 3 and "CAI → IST" in fl.first.inner_text(), "3 flight links CAI → IST")
    check(page.locator("[data-testid=travel-hotel]").count() == 3, "3 hotel links with the trip's dates")
    fl.nth(1).click(); page.wait_for_timeout(200)
    check(page.evaluate("window.__agent") == ["Skyscanner"], "a flight link goes to the agent (Best offer / Fill; you pay)")
    page.click("[data-testid=travel-radar]"); page.wait_for_timeout(300)
    items = page.evaluate("JSON.parse(localStorage.getItem('attune:radar:v1')).items.map(x => x.title + ' ' + x.date)")
    check(any("Trip to Turkey 2026-11-01" in x for x in items), "the trip is in Deadline Radar: %s" % items)
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "travel-trip.png"))
    page.fill("[data-testid=travel-depart]", "2026-11-10"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=travel-trip-issue]").count() == 1, "a return before the departure is said")
    page.fill("[data-testid=travel-depart]", "2026-11-01")
    # arrive
    page.click("[data-testid=travel-tab-arrive]")
    check("112" in page.locator("[data-testid=travel-emergency]").inner_text(), "the emergency number first")
    page.fill("[data-testid=travel-fair-q]", "taxi 900"); page.wait_for_timeout(150)
    a = page.locator("[data-testid=travel-fair-a]").inner_text()
    check("Too high" in a and "Taxi 5km in Istanbul" in a, "taxi 900 TRY → too high, the pack's line shown: " + a.replace("\n", " "))
    page.fill("[data-testid=travel-fair-q]", "taxi 200"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=travel-fair-a]").inner_text().startswith("Fair"), "taxi 200 → fair")
    page.fill("[data-testid=travel-fair-q]", "haircut 300"); page.wait_for_timeout(150)
    check("No usual price" in page.locator("[data-testid=travel-fair-a]").inner_text(), "no price line → not guessed")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "travel-arrive.png"))
    # say it
    page.click("[data-testid=travel-tab-say]")
    check(page.locator("[data-testid=travel-say]").count() >= 10, "every phrase can be spoken")
    page.locator("[data-testid=travel-big]").first.click()
    check("İmdat!" in page.locator("[data-testid=travel-bigview]").inner_text(), "a phrase shown big to hand the phone over")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "travel-big.png"))
    page.click("[data-testid=travel-bigview]")
    check(page.locator("[data-testid=travel-bigview]").count() == 0, "tap closes it")
    # know: everything else is still there
    page.click("[data-testid=travel-tab-know]")
    body = page.locator("[data-testid=travel-page]").inner_text().lower()
    check(all(x.lower() in body for x in ["How you'll get overcharged", "What things cost", "Getting around", "Useful numbers", "Write my tips in"]), "Know keeps the overcharges, prices, transport, numbers and the tips language")
    page.click("[data-testid=travel-tab-say]"); page.click("[data-testid=travel-translate]"); page.wait_for_timeout(300)
    check(page.evaluate("localStorage.getItem('attune:translate:to')") == "tr", "'A sign or menu' opens Translate into Turkish")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
