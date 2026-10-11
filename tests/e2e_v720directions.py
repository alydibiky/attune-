"""v6.20 — directions inside Attune, offline (Ali: "what's the point of maps if it will redirect me to another map … a lot
of places is not in the map"). The phone's MapPacks are mocked: the real vector map of central Cairo and a real route file
of downtown Cairo (tests/fixtures/cairo-route-small.bin, from Overture's road network) are read through N.mapRead.

  python3 tests/e2e_v720directions.py          SHOTS=<dir> keeps screenshots
"""
import base64, json, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

HERE = os.path.dirname(os.path.abspath(__file__))
B64 = lambda f: base64.b64encode(open(os.path.join(HERE, "fixtures", f), "rb").read()).decode()
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))

PACK = {"code": "eg", "name": "Egypt", "date": "2026-10-09", "bytes": 1, "installed": True, "routes": False,
        "files": [{"name": "eg.pmtiles", "bytes": 1}, {"name": "eg-places.sqlite", "bytes": 1}]}
REMOTE = {**PACK, "files": PACK["files"] + [{"name": "eg-route.bin", "bytes": 312000000, "sha256": "x"}]}
INIT = r"""
(() => { const S = window.__mapmock = { calls: [], installed: [%(pack)s] };
  const dec = (b) => { const raw = atob(b); const u = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u[i] = raw.charCodeAt(i); return u; };
  const files = { "eg/eg.pmtiles": dec("%(tiles)s"), "eg/eg-route.bin": dec("%(route)s") };
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.mapPacks = () => JSON.stringify({ packs: S.installed, assets: true });
    N.mapRead = (a) => { const o = JSON.parse(a); S.calls.push(["read", o.path]); const f = files[o.path];
      if (!f || (o.path.endsWith("route.bin") && !S.installed[0].routes)) return "";
      const end = o.length < 0 ? f.length : Math.min(f.length, o.offset + o.length); return b64(f.subarray(o.offset, end)); };
    const later = (id, v, ms) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), ms || 40);
    N.mapRemote = (id, a) => { S.calls.push(["remote"]); later(id, %(remote)s); };
    N.mapInstall = (id, a) => { const o = JSON.parse(a); S.calls.push(["install", o]);
      setTimeout(() => window.__attuneNative.progress(id, 50, "eg-route.bin", "156 / 312 MB"), 60);
      setTimeout(() => { S.installed[0] = { ...S.installed[0], routes: true }; window.__attuneNative.resolve(id, JSON.stringify({ code: "eg", routes: true })); }, 250); };
    N.mapSearch = (id, a) => { later(id, { places: [{ name: "Zamalek", name_ar: "الزمالك", name_en: "Zamalek", kind: "place/suburb", lat: 30.059, lon: 31.2243, dist: 2.1 }] }); };
  }; go(); })();""" % {"tiles": B64("cairo-mini.pmtiles"), "route": B64("cairo-route-small.bin"), "pack": json.dumps(PACK), "remote": json.dumps(REMOTE)}

with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    ctx.grant_permissions(["geolocation"]); ctx.set_geolocation({"latitude": 30.0444, "longitude": 31.2357})   # Tahrir Square
    page.set_viewport_size({"width": 390, "height": 844})
    page.on("dialog", lambda d: d.accept())
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Maps')").first.click()
    page.wait_for_selector("[data-testid=map-page]", timeout=8000)
    page.wait_for_function("() => window.__attuneMap && window.__attuneMap.isStyleLoaded()", timeout=30000)

    # ---- directions are offered inside Attune, not handed to another app ----
    page.fill("[data-testid=map-search]", "Zamalek"); page.press("[data-testid=map-search]", "Enter")
    page.wait_for_selector("[data-testid=map-hit]", timeout=8000); page.locator("[data-testid=map-hit]").first.click()
    page.wait_for_selector("[data-testid=map-directions]", timeout=3000)
    check(page.locator("[data-testid=map-place] a[href^='geo:']").count() == 0, "the place card's Directions is a button inside Attune, not a link to another app")
    page.click("[data-testid=map-directions]")
    page.wait_for_selector("[data-testid=map-trip-need-routes]", timeout=5000)
    check("312 MB" in page.locator("[data-testid=map-get-routes]").inner_text(), "without the directions on the phone: an offer to download them, with the size")
    shot(page, "v720-need-routes")
    page.click("[data-testid=map-get-routes]")
    try: page.wait_for_selector("[data-testid=map-trip-summary]", timeout=20000)
    except Exception:
        print("   DEBUG trip:", page.locator("[data-testid=map-trip]").inner_text()[:400]); print("   DEBUG calls:", page.evaluate("window.__mapmock.calls.slice(-6)")); print("   DEBUG errors:", errors[:5]); raise
    inst = [c for c in page.evaluate("window.__mapmock.calls") if c[0] == "install"]
    check(inst and inst[0][1].get("routesOnly") is True, "only the directions are downloaded (the map is already there)")

    # ---- the route: drawn, timed, step by step ----
    summ = page.locator("[data-testid=map-trip-summary]").inner_text()
    steps = page.locator("[data-testid=map-step]").all_inner_texts()
    check("min" in summ and "km" in summ and "offline" in summ, "a car route from where you are (Tahrir) to Zamalek: " + summ.replace("\n", " · "))
    check(len(steps) >= 2 and "Head out" in steps[0], "step by step: %s" % " | ".join(s.replace("\n", " ") for s in steps[:4]))
    n = page.evaluate("() => { const s = window.__attuneMap.getSource('trip'); const d = s && (s._data && s._data.geometry ? s._data : s.serialize && s.serialize().data); return d && d.geometry ? d.geometry.coordinates.length : -1; }")
    check(n > 10, "the route is drawn on the map (%d points)" % n)
    shot(page, "v720-car")
    page.click("[data-testid=map-mode-walk]")
    page.wait_for_function("() => document.querySelector('[data-testid=map-mode-walk]').getAttribute('aria-pressed') === 'true' && document.querySelector('[data-testid=map-trip-summary]')", timeout=20000)
    page.wait_for_timeout(300)
    walk = page.locator("[data-testid=map-steps]").inner_text()
    check("قصر النيل" in walk and "on foot" in page.locator("[data-testid=map-trip-summary]").inner_text(), "on foot: across Qasr El Nil bridge")
    shot(page, "v720-walk")
    check(page.locator("[data-testid=map-other-app]").count() == 1, "another maps app stays possible, as a small link")
    page.click("[data-testid=map-trip-close]"); page.wait_for_timeout(200)
    n = page.evaluate("() => { const s = window.__attuneMap.getSource('trip'); const d = s && (s._data && s._data.geometry ? s._data : s.serialize && s.serialize().data); return d && d.geometry ? d.geometry.coordinates.length : -1; }")
    check(n == 0, "closing the directions clears the line")

    # ---- a place that isn't on the map: add it yourself ----
    page.click("[data-testid=map-add-place]"); page.wait_for_selector("[data-testid=map-add-form]")
    page.fill("[data-testid=map-add-name]", "Ali's crane yard"); page.click("[data-testid=map-add-save]"); page.wait_for_timeout(250)
    saved = page.evaluate("() => JSON.parse(localStorage.getItem('attune:map') || localStorage.getItem('attune:maps') || '{}')")
    page.fill("[data-testid=map-search]", "crane yard"); page.press("[data-testid=map-search]", "Enter")
    page.wait_for_selector("[data-testid=map-hit]", timeout=8000)
    check("crane yard" in page.locator("[data-testid=map-hit]").first.inner_text(), "the place you added is found by search")

    # ---- Arabic ----
    page.evaluate("localStorage.setItem('attune:ui:lang', 'ar')"); page.reload(); page.wait_for_selector("[data-testid=map-page], nav", timeout=15000)
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
