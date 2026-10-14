"""v6.27 What you're owed — one sheet opened from Chat, Travel, Deadline Radar and Money Guardian (no new page): the flight
check worked out by code (EU261 / UK261 / Canada), the claim letter; a return or warranty request from Radar. Phone + desktop.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v727owed.py
"""
import json, datetime
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
T = datetime.date.today()
RADAR = {"items": [{"id": "r1", "kind": "return", "title": "Headphones", "date": (T + datetime.timedelta(days=10)).isoformat(), "base": T.isoformat(), "amount": 99, "currency": "EUR", "status": "active", "created": 1}], "seen": []}
INIT = "try{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);localStorage.setItem('attune:start','chat');localStorage.setItem('attune:radar:v1',%s)}}catch(e){}" % json.dumps(json.dumps(RADAR))
def send(page, t):
    page.locator("textarea[placeholder='Message Attune']").fill(t); page.locator("button[title='Send']").click(); page.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    for W, H in ((390, 844), (1280, 860)):
        ctx, page = new_page(br, env, errors, extra_init=INIT)
        page.set_viewport_size({"width": W, "height": H}); dev = "phone" if W < 600 else "desktop"
        page.goto(env.url); page.wait_for_timeout(1500)
        if dev == "desktop": page.locator("[data-testid=side-go-chat]").first.click(); page.wait_for_timeout(300)
        send(page, "my flight LH400 from FRA to JFK was 5 hours late")
        card = page.locator("[data-testid=card-emerald]").last
        check("owe you" in card.inner_text() and "FRA → JFK" in card.inner_text(), f"{dev}: Chat reads the flight and offers the check")
        card.locator("button:has-text(\"See what I'm owed\")").click(); page.wait_for_selector("[data-testid=owed-sheet]")
        res = page.locator("[data-testid=owed-result]").inner_text()
        check("probably owed" in res.lower() and "€600" in res and "EU261" in res, f"{dev}: FRA→JFK 5 h, cause not said → probably owed €600: " + res.replace("\n", " · ")[:120])
        page.select_option("[data-testid=owed-cause]", "technical"); page.wait_for_timeout(100)
        check("you are owed" in page.locator("[data-testid=owed-result]").inner_text().lower(), f"{dev}: a technical fault → owed")
        page.select_option("[data-testid=owed-cause]", "weather"); page.wait_for_timeout(100)
        check("no compensation" in page.locator("[data-testid=owed-result]").inner_text().lower(), f"{dev}: bad weather → not owed, said why")
        page.select_option("[data-testid=owed-cause]", "technical")
        page.click("[data-testid=owed-write]"); page.wait_for_timeout(100)
        L = page.locator("[data-testid=owed-letter-text]").input_value()
        check("€600 per passenger" in L and "261/2004" in L and "LH400" in L, f"{dev}: the claim letter has the amount, the law and the flight")
        box = page.locator("[data-testid=owed-sheet] > div").bounding_box()
        if dev == "desktop": check(box["width"] <= 520 and box["x"] > 300, f"desktop: the sheet is a centred window ({int(box['width'])} px wide at x={int(box['x'])})")
        else: check(box["width"] >= 380, "phone: the sheet is a full-width bottom sheet")
        page.click("[data-testid=owed-close]")
        ctx.close()
    # Travel → Trip and Radar
    ctx, page = new_page(br, env, errors, extra_init=INIT.replace("'chat'", "'home'"))
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Travel')").first.click(); page.wait_for_selector("[data-testid=travel-page]")
    page.fill("[data-testid=travel-find]", "turk"); page.click("[data-testid=travel-pack-tr]"); page.wait_for_timeout(300)
    page.fill("[data-testid=travel-from]", "LHR")
    page.click("[data-testid=travel-owed]"); page.wait_for_selector("[data-testid=owed-sheet]")
    check(page.locator("[data-testid=owed-from]").input_value() == "LHR" and page.locator("[data-testid=owed-to]").input_value() == "IST", "Travel: the check opens with the trip's airports (LHR → IST)")
    page.click("[data-testid=owed-kind-cancel]"); page.fill("[data-testid=owed-notice]", "3"); page.select_option("[data-testid=owed-cause]", "crew"); page.wait_for_timeout(100)
    res = page.locator("[data-testid=owed-result]").inner_text()
    check("£350" in res and "UK261" in res, "LHR→IST cancelled 3 days ahead, crew shortage → £350 (UK261): " + res.replace("\n", " · ")[:100])
    page.click("[data-testid=owed-close]")
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Deadline Radar')").first.click(); page.wait_for_timeout(500)
    page.click("[data-testid=radar-letter]"); page.wait_for_selector("[data-testid=owed-letter-text]")
    L = page.locator("[data-testid=owed-letter-text]").input_value()
    check("Return request — Headphones" in L and "99 EUR" in L, "Radar: a return window → the return request, filled in")
    ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
