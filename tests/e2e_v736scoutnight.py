"""v6.32 — Scout at night (roadmap "Scout extras"): every goal change hands tonight's searches to the phone (ScoutNight.kt runs
them around 3:00 with Attune closed); the next time Attune opens, what the night found is checked by code like any run — the
match shows on the goal and a strong find → a notification. Paused goals are left out of the plan.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v736scoutnight.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
ADS = [{"url": "https://www.aqarmap.com.eg/en/listing/555-apartment-maadi", "title": "Apartment for rent in Maadi Degla", "text": "Apartment for rent in Maadi, Degla. 3 bedrooms, 2 bathrooms, 170 m². Floor: 3. Elevator, near Maadi metro station. Price: 13,500 EGP per month."}]
MOCK = r"""try{localStorage.setItem('attune:start','home')}catch(e){}
(() => { const ADS = %s; window.__plans = [];
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.search = (id, arg) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ hits: [], via: "mock" })), 20);
    N.scoutNightPlan = (p) => { window.__plans.push(JSON.parse(p)); return "ok"; };
    N.scoutNightTake = () => { let d = { goals: [] }; try { d = JSON.parse(localStorage.getItem("attune:scout:v1")) || d; } catch (e) {}
      return localStorage.getItem("test:night") === "1" && d.goals[0] ? JSON.stringify({ [d.goals[0].id]: ADS }) : "{}"; };
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
    check(len(notes) == 1 and "Degla" in notes[0], "what the night found is checked on open → a strong find is told: %s" % notes)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'scout'}}))"); page.wait_for_selector("[data-testid=scout-page]", timeout=5000); page.wait_for_timeout(300)
    check(page.locator("[data-testid=scout-ad]").count() == 1 and "Degla" in page.locator("[data-testid=scout-ad]").first.inner_text(), "the night's match is on the goal")
    page.locator("[data-testid=scout-goal] button[aria-label='Pause']").first.click(); page.wait_for_timeout(200)
    check(page.evaluate("window.__plans[window.__plans.length-1].length") == 0, "pausing the goal → the night run stops")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
