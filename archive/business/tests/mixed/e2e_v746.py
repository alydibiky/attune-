"""v6.46 Ali's 21 Oct problems: (1) Business → "I run a clinic with appointments" → the system is built at once from the clinic
template (no waiting on "Designing the tables…", no model call); (2) Scout: a Tucson goal saved by an older Scout (only "used"
understood, a list page at "151 EGP", nfl.com and a calculator kept) is read again — only the real ads with real prices show.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v746.py
"""
import json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
now = int(time.time() * 1000)
OLD = {"goals": [{"id": "s1", "text": "Hyundai Tuscon 2022 used price", "g": {"raw": "Hyundai Tuscon 2022 used price", "kind": "car", "wish": [{"k": "used", "say": ["used", "مستعمل"]}], "what": "Hyundai Tuscon 2022 used price"},
  "votes": {}, "taste": {}, "lastRun": now - 3600000, "on": True, "listSeen": [{"site": "forum.lowyat.net", "v": 14201, "t": now - 3600000}],
  "seen": [{"id": "dub", "url": "https://www.dubizzle.com.eg/en/vehicles/cars-for-sale/hyundai/tucson/", "site": "dubizzle.com.eg", "title": "Hyundai Tuscon - Vehicles for sale in Egypt | dubizzle Egypt (OLX)", "facts": {"price": 151, "cur": "EGP"}, "lastSeen": now - 3600000, "firstSeen": now - 3600000},
           {"id": "nfl", "url": "https://www.nfl.com/news/tucson", "site": "nfl.com", "title": "Tucson", "facts": {"price": 14201, "cur": "EGP"}, "lastSeen": now - 3600000, "firstSeen": now - 3600000}]}]}
HITS = [{"url": "https://eg.hatla2ee.com/en/car/used/hyundai/tucson/5123456", "title": "Hyundai Tucson 2022 used", "text": "Hyundai Tucson 2022, automatic, 38,000 km, one owner, price 1,420,000 EGP."},
        {"url": "https://www.nfl.com/news/arizona-tucson", "title": "Cardinals camp in Tucson", "text": "Tickets from $151. Tucson 2022 price 14,201"},
        {"url": "https://www.calculator.io/car-loan-calculator/", "title": "Car loan calculator", "text": "Hyundai Tucson 2022 price 1,400,000"}]
INIT = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:scout:v1'," + json.dumps(json.dumps(OLD)) + ")}catch(e){}"
        "(function w(){ var N = window.AttuneNative; if (!N) return setTimeout(w, 0); var H = " + json.dumps(HITS) + ";"
        "N.search = function (id, arg) { setTimeout(function () { window.__attuneNative.resolve(id, JSON.stringify({ hits: H, via: 'mock' })); }, 20); }; })();")
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    # ---- 1. the clinic, at once
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Business')").first.click()
    page.wait_for_selector("[data-testid=erp-new]", timeout=8000); page.click("[data-testid=erp-new]")
    page.evaluate("() => { window.__mock.bodies = []; }")
    page.locator("button:has-text('I run a clinic with appointments')").first.click()
    t0 = time.time(); page.click("[data-testid=erp-design]")
    page.wait_for_selector("[data-testid=erp-draft]", timeout=5000)
    check(time.time() - t0 < 3 and "Patients" in page.inner_text("[data-testid=erp-draft]"), "a clinic is built at once from its template (%.1f s): Patients…" % (time.time() - t0))
    check(len([b for b in page.evaluate("window.__mock.bodies || []") if b.get("max_tokens", 0) > 2]) == 0, "…without waiting on the model")
    # ---- 2. Scout: the old goal, cleaned
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Scout')").first.click(); page.wait_for_selector("[data-testid=scout-page]", timeout=5000)
    page.locator("[data-testid=scout-goal]").first.click(); page.wait_for_timeout(300)
    body = page.inner_text("[data-testid=scout-page]")
    check("151" not in body and "nfl.com" not in body, "what the old Scout kept (the 151 EGP list page, nfl.com) is gone at once")
    page.locator("[data-testid=scout-run]").first.click()
    page.wait_for_selector("[data-testid=scout-ad]", timeout=15000); page.wait_for_timeout(500)
    ads = page.locator("[data-testid=scout-ad]")
    check(ads.count() == 1 and "hatla2ee" in ads.first.inner_text() and "1,420,000" in ads.first.inner_text(), "a new run: only the real Tucson 2022 ad (1,420,000 EGP)")
    check("Tucson" in page.inner_text("[data-testid=scout-page]") and page.locator("[data-testid=scout-car-note]").count() == 1, "the goal is understood again: Hyundai Tucson")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
