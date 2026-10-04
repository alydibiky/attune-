"""v6.12 — Maps: "Address east compound" (Ali's search, New Cairo) is found: Photon and Nominatim are asked at once with the
map's centre; the simpler wording finds it; the result is pinned and can be saved. The map services are mocked.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v700maps.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
asked = []

def svc(route):
    u = route.request.url; asked.append(u)
    if "photon.komoot.io" in u and "q=Address+east&" in u:
        body = {"features": [{"properties": {"name": "Address East", "osm_key": "landuse", "osm_value": "residential", "city": "New Cairo", "country": "Egypt"}, "geometry": {"coordinates": [31.503, 30.021]}}]}
    elif "photon.komoot.io" in u: body = {"features": []}
    elif "overpass" in u: body = {"elements": []}
    elif "nominatim" in u: body = []
    else: return route.continue_()
    route.fulfill(status=200, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"}, body=json.dumps(body))

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    ctx.route("**/*", lambda r: svc(r) if any(h in r.request.url for h in ("photon.komoot.io", "nominatim.openstreetmap.org", "overpass-api.de")) else r.continue_())
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Maps')").first.click()
    page.wait_for_selector("input[placeholder^='Search a place']", timeout=5000)
    page.fill("input[placeholder^='Search a place']", "Address east compound")
    page.locator("button:has-text('Search')").first.click()
    page.wait_for_selector("[data-testid=map-hit]", timeout=15000)
    hit = page.locator("[data-testid=map-hit]").first.inner_text()
    check("Address East" in hit, "Ali's search finds the compound: %s" % hit.replace("\n", " · "))
    check(any("photon" in u and "lat=" in u for u in asked) and any("nominatim" in u and "viewbox=" in u for u in asked), "both services asked, near the map's centre")
    page.locator("[data-testid=map-hit]").first.click()
    page.wait_for_selector("[data-testid=map-found-pin]", timeout=3000)
    check(page.locator("[data-testid=map-found-pin]").count() == 1, "the result is pinned on the map")
    page.click("[data-testid=map-save-found]"); page.wait_for_timeout(300)
    check(page.locator("text=Your places").count() >= 1, "and it can be saved")
    ctx.grant_permissions(["geolocation"]); ctx.set_geolocation({"latitude": 30.0205, "longitude": 31.4995})
    page.click("[data-testid=map-locate]")
    page.wait_for_selector("[data-testid=map-me]", timeout=8000)
    check(page.locator("[data-testid=map-me]").count() == 1, "my location: a blue dot where the phone is")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
