"""v6.32 — Scout at night (roadmap "Scout extras"): every goal change hands tonight's searches to the phone (ScoutNight.kt runs
them around 3:00 with Attune closed); the next time Attune opens, what the night found is checked by code like any run — the
match shows on the goal and a strong find → a notification. Paused goals are left out of the plan.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736scoutnight.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
ADS = [{"url": "https://www.dubizzle.com.eg/en/ad/flat-maadi-degla-ID5151.html", "title": "Flat in Maadi Degla, cheap", "text": "Flat for rent in Maadi Degla, 3 bedrooms, floor 3, 170 m2. Price 8,000 EGP monthly. Transfer the deposit first.", "pic": 1},
       {"url": "https://www.aqarmap.com.eg/en/listing/555-apartment-maadi", "title": "Apartment for rent in Maadi Degla", "text": "Apartment for rent in Maadi, Degla. 3 bedrooms, 2 bathrooms, 170 m². Floor: 3. Elevator, near Maadi metro station. Price: 13,500 EGP per month."}]
MOCK = r"""try{localStorage.setItem('attune:start','home')}catch(e){}
(() => { const ADS = %s; window.__plans = [];
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.search = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ hits: [], via: "mock" })), 20);
    N.mapSearch = (id, arg) => { const a = JSON.parse(arg); window.__maps = (window.__maps || 0) + 1;
      const places = a.q ? [{ name: "Maadi", kind: "place/suburb", lat: 29.9602, lon: 31.2569, rank: 70 }]
        : [{ name: "Maadi", name_en: "Maadi Metro Station", name_ar: "محطة مترو المعادي", kind: "transport/station", lat: 29.9602, lon: 31.2620 }];
      setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ places })), 10); };
    N.scoutNightPlan = (p) => { window.__plans.push(JSON.parse(p)); return "ok"; };
    N.scoutNightTake = () => { let d = { goals: [] }; try { d = JSON.parse(localStorage.getItem("attune:scout:v1")) || d; } catch (e) {}
      // the same photo in two different ads (one cheap and pushy) — drawn here as a small JPEG, as the search brings it
      const c = document.createElement("canvas"); c.width = 320; c.height = 200; const x = c.getContext("2d");
      for (let i = 0; i < 8; i++) { x.fillStyle = "hsl(" + i * 45 + ",60%%," + (30 + i * 6) + "%%)"; x.fillRect(i * 40, 0, 40, 200); }
      const img = c.toDataURL("image/jpeg", 0.8);
      const ads = ADS.map((a) => ({ ...a, image: img }));
      return localStorage.getItem("test:night") === "1" && d.goals[0] ? JSON.stringify({ [d.goals[0].id]: ads }) : "{}"; };
  }; go(); })();""" % json.dumps(ADS)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=MOCK)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'scout'}}))"); page.wait_for_selector("[data-testid=scout-page]", timeout=5000)
    page.fill("[data-testid=scout-text]", "3-bedroom flat for rent in Maadi under 15,000, not ground floor"); page.click("[data-testid=scout-add]")
    page.wait_for_timeout(1500)
    plans = page.evaluate("window.__plans")
    check(plans and len(plans[-1]) == 1 and any("aqarmap" in q for q in plans[-1][0]["queries"]), "a new goal → tonight's searches handed to the phone: %s" % (plans[-1][0]["queries"][:2] if plans else plans))
    check(page.locator("[data-testid=scout-ad]").count() == 0, "nothing found by day")
    # the night found an ad → next open
    page.evaluate("localStorage.setItem('test:night','1')")
    page.goto(env.url); page.wait_for_selector("[data-testid=phone-home]", timeout=15000); page.wait_for_timeout(800)
    notes = page.evaluate("window.__mock.notes.filter(n => n.id.startsWith('scout-')).map(n => n.title + ' | ' + n.body)")
    # (v6.36: the cheap Degla ad says "Transfer the deposit first" — the scam check keeps it out of the notification; it is still listed)
    check(len(notes) == 1 and "Degla" in notes[0] and "1 strong" in notes[0], "what the night found is checked on open → the strong find is told, the money-first ad is not: %s" % notes)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'scout'}}))"); page.wait_for_selector("[data-testid=scout-page]", timeout=5000); page.wait_for_timeout(300)
    page.wait_for_timeout(600)
    ads = page.locator("[data-testid=scout-ad]")
    check(ads.count() == 2 and "Apartment for rent in Maadi Degla" in ads.nth(0).inner_text() + ads.nth(1).inner_text(), "the night's matches are on the goal: %d" % ads.count())
    ph = page.locator("[data-testid=scout-photo]")
    t = [ph.nth(i).inner_text() for i in range(ph.count())]
    check(ph.count() == 2 and any("dubizzle.com.eg · 8,000" in x for x in t) and any("aqarmap.com.eg · 13,500" in x for x in t), "the same photo in two different ads → both marked: %s" % [ph.nth(i).inner_text() for i in range(ph.count())])
    page.wait_for_timeout(500)
    m = page.locator("[data-testid=scout-metro]")
    check(m.count() >= 1 and "Maadi Metro Station" in m.first.inner_text() and "min walk" in m.first.inner_text(), "the nearest metro from the offline map, in minutes on foot: %s" % (m.first.inner_text() if m.count() else None))
    n0 = page.evaluate("window.__maps")
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'home'}}))"); page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'scout'}}))"); page.wait_for_timeout(400)
    check(page.evaluate("window.__maps") == n0, "the station is kept, not looked up again")
    page.locator("[data-testid=scout-goal] button[aria-label='Pause']").first.click(); page.wait_for_timeout(200)
    check(page.evaluate("window.__plans[window.__plans.length-1].length") == 0, "pausing the goal → the night run stops")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
