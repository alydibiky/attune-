"""v6.28 — Ali: Scout "if it's made correctly, very strong, very accurate and works with everything". A goal searched on the sites
that matter (the app's own web search, mocked here with real-looking ad pages): the flat that fits every wish first, each wish ✓
with the ad's own words, what an ad doesn't say shown as "not stated", the ground-floor / over-budget ads and a search page left
out, the same flat on two sites shown once; 👎 removes an ad; a strong new find → a notification; "find me …" on Home starts a goal.
Computer: two panels.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v731scout.py     (SHOTS=dir for screenshots)
"""
import os, json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
ADS = [
  {"url": "https://www.aqarmap.com.eg/en/listing/123456-apartment-maadi", "title": "Apartment for rent in Maadi Sarayat", "text": "Apartment for rent in Maadi, Sarayat. 3 bedrooms, 2 bathrooms, 180 m². Floor: 4. Fully furnished, elevator, 5 minutes walk to Maadi metro station. Price: 14,000 EGP per month. Pets allowed. Contact 01005556667."},
  {"url": "https://www.propertyfinder.eg/en/plp/rent/apartment-for-rent-cairo-maadi-999.html", "title": "Maadi Sarayat 3BR", "text": "Apartment for rent in Maadi, Sarayat. 3 bedrooms, 2 bathrooms, 180 m². Floor: 4. Fully furnished, elevator, 5 minutes walk to Maadi metro station. Price: 14,000 EGP per month. Pets allowed."},
  {"url": "https://www.dubizzle.com.eg/en/ad/apartment-ground-floor-maadi-ID9988.html", "title": "شقة للإيجار المعادي", "text": "شقة للايجار بالمعادي دور ارضي ٣ غرف ١٦٠ متر السعر ١٢٠٠٠ جنيه شهريا"},
  {"url": "https://www.dubizzle.com.eg/en/ad/flat-maadi-ID7777.html", "title": "Flat Maadi", "text": "Nice flat in Maadi, 3 rooms. Price 13,000 EGP monthly."},
  {"url": "https://www.bayut.eg/en/property/details-4444.html", "title": "Maadi apartment", "text": "Apartment in Maadi 3 bedrooms floor 2 price 22,000 EGP monthly"},
  {"url": "https://www.aqarmap.com.eg/en/for-rent/apartment/cairo/maadi/", "title": "Apartments for rent in Maadi", "text": "a 14,000 EGP b 15,000 EGP c 9,000 EGP d 11,000 EGP"},
]
MOCK = r"""try{localStorage.setItem('attune:start','home')}catch(e){}
(() => { const ADS = %s; window.__searches = [];
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.search = (id, arg) => { const a = JSON.parse(arg); window.__searches.push(a.q); const site = (/site:(\S+)/.exec(a.q) || [])[1] || "";
      const hits = ADS.filter((h) => !site || h.url.includes(site.split("/")[0]));
      setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ hits, via: "mock" })), 30); };
  }; go(); })();""" % json.dumps(ADS)
GOAL = "Find me a 3-bedroom flat for rent in Maadi under 15,000, not ground floor, near the metro, allows a cat"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=MOCK)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(300)
    page.locator(".rounded-t-2xl button:has-text('Scout')").first.click(); page.wait_for_selector("[data-testid=scout-page]", timeout=5000)
    page.fill("[data-testid=scout-text]", GOAL); page.click("[data-testid=scout-add]")
    page.wait_for_selector("[data-testid=scout-ad]", timeout=15000); page.wait_for_timeout(300)
    qs = page.evaluate("window.__searches")
    check(any("site:aqarmap.com.eg" in q for q in qs) and any("site:propertyfinder.eg" in q for q in qs) and len(qs) >= 5, "searched the property sites that matter: %d searches" % len(qs))
    ads = page.locator("[data-testid=scout-ad]")
    check(ads.count() == 2, "2 results: the full match and the vague one (ground floor, over budget and the search page left out): %d" % ads.count())
    a0 = ads.first.inner_text()
    check("Sarayat" in a0 and "14,000" in a0 and "also on propertyfinder.eg" in a0, "the full match first, shown once with its twin on another site")
    check("Floor: 4" in a0 and "metro" in a0.lower() and "Pets allowed" in a0, "every wish ✓ with the ad's own words")
    a1 = ads.nth(1).inner_text()
    check("not stated in the ad" in a1, "the vague ad: what it doesn't say is 'not stated', never assumed")
    notes = page.evaluate("window.__mock.notes.filter(n => n.id.startsWith('scout-')).map(n => n.title + ' | ' + n.body)")
    check(len(notes) == 1 and "Sarayat" in notes[0], "a strong new find → one notification: %s" % notes)
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "scout-phone.png"), full_page=True)
    ads.nth(1).locator("[data-testid=scout-down]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=scout-ad]").count() == 1, "👎 removes an ad")
    page.click("[data-testid=scout-run]"); page.wait_for_timeout(1500)
    notes2 = page.evaluate("window.__mock.notes.filter(n => n.id.startsWith('scout-')).length")
    check(notes2 == 1, "Check now again: nothing new → no new notification")
    check("1 matches" in page.locator("[data-testid=scout-goal]").inner_text() or "matches" in page.locator("[data-testid=scout-goal]").inner_text(), "the goal shows its last check")
    # from Home
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.fill("[data-testid=home-ask]", "دورلي على عربية هيونداي توسان 2019 لـ 2021 أقل من 900 ألف"); page.click("[data-testid=home-send]")
    page.wait_for_selector("[data-testid=scout-page]", timeout=5000); page.wait_for_timeout(1500)
    check(page.locator("[data-testid=scout-goal]").count() == 2 and any("hatla2ee" in q for q in page.evaluate("window.__searches")), "«دورلي على عربية …» on Home → a new Scout goal, searched on the car sites")
    # computer
    page.set_viewport_size({"width": 1366, "height": 860}); page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000)
    page.locator("[data-testid=side] input").first.fill("Scout"); page.wait_for_timeout(200)
    page.locator("[data-testid=side-go-scout]").first.click(); page.wait_for_selector("[data-testid=scout-page]", timeout=5000); page.wait_for_timeout(300)
    page.locator("[data-testid=scout-goal] button").filter(has_text="flat").first.click(); page.wait_for_timeout(200)
    g, r = page.locator("[data-testid=scout-goals]").bounding_box(), page.locator("[data-testid=scout-results]").bounding_box()
    check(r["x"] > g["x"] + g["width"] - 2, "computer: goals on the left, finds on the right")
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, "scout-desk.png"))
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
