"""v6.15 — Maps look A and whole-country offline maps (Ali: "download a whole country at once … every time something
updates I can install the update"). The phone's MapPacks are mocked: a tiny real vector map of central Cairo
(tests/fixtures/cairo-mini.pmtiles) is read through N.mapRead, exactly as on the phone.

  python3 tests/e2e_v722maps.py
"""
import base64, json, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = base64.b64encode(open(os.path.join(HERE, "fixtures", "cairo-mini.pmtiles"), "rb").read()).decode()
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))

INSTALLED = {"code": "eg", "name": "Egypt", "date": "2026-10-02", "bytes": 412000000, "installed": True, "files": [{"name": "eg.pmtiles", "bytes": 400000000}, {"name": "eg-places.sqlite", "bytes": 12000000}]}
NEWER = {"code": "eg", "name": "Egypt", "date": "2026-10-09", "files": [{"name": "eg.pmtiles", "bytes": 401000000, "sha256": "x"}, {"name": "eg-places.sqlite", "bytes": 12100000, "sha256": "y"}]}
TR = {"code": "tr", "name": "Turkey", "date": "2026-10-09", "files": [{"name": "tr.pmtiles", "bytes": 900000000, "sha256": "z"}]}
INIT = r"""
(() => { const S = window.__mapmock = { calls: [], installed: [%(inst)s] };
  const raw = atob("%(fix)s"); const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.mapPacks = () => JSON.stringify({ packs: S.installed, assets: true });
    N.mapRead = (a) => { const o = JSON.parse(a); S.calls.push(["read", o.path]);
      if (!/\.pmtiles$/.test(o.path)) return "";
      const end = o.length < 0 ? bytes.length : Math.min(bytes.length, o.offset + o.length); return b64(bytes.subarray(o.offset, end)); };
    const later = (id, v, ms) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), ms || 40);
    N.mapRemote = (id, a) => { const c = JSON.parse(a).code; S.calls.push(["remote", c]); later(id, c === "eg" ? %(newer)s : %(tr)s); };
    N.mapInstall = (id, a) => { const c = JSON.parse(a).code; S.calls.push(["install", c]);
      [20, 55, 90].forEach((p, i) => setTimeout(() => window.__attuneNative.progress(id, p, c + ".pmtiles", p + " MB"), 60 * (i + 1)));
      setTimeout(() => { const m = c === "eg" ? %(newer)s : %(tr)s; S.installed = S.installed.filter((x) => x.code !== c).concat([{ ...m, bytes: 1, installed: true }]); window.__attuneNative.resolve(id, JSON.stringify(m)); }, 300); };
    N.mapRemove = (c) => { S.installed = S.installed.filter((x) => x.code !== c); return true; };
    N.mapSearch = (id, a) => { const o = JSON.parse(a); S.calls.push(["search", o]);
      later(id, { places: o.kinds && o.kinds.length ? [{ name: "Wataniya", name_ar: "وطنية", kind: "amenity/fuel", lat: 30.06, lon: 31.34, dist: 1.2 }]
        : [{ name: "مدينة نصر", name_ar: "مدينة نصر", name_en: "Nasr City", kind: "place/suburb", lat: 30.057, lon: 31.33, dist: 9.1 }] }); };
  }; go(); })();""" % {"fix": FIX, "inst": json.dumps(INSTALLED), "newer": json.dumps(NEWER), "tr": json.dumps(TR)}

with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.on("dialog", lambda d: d.accept())
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Maps')").first.click()
    page.wait_for_selector("[data-testid=map-page]", timeout=8000)

    # ---- the country pack is drawn offline ----
    page.wait_for_function("() => window.__attuneMap && window.__attuneMap.loaded && window.__attuneMap.loaded() && window.__attuneMap.isStyleLoaded()", timeout=30000)
    page.evaluate("window.__attuneMap.jumpTo({ center: [31.25, 30.05], zoom: 12 })")
    page.wait_for_function("() => window.__attuneMap.areTilesLoaded()", timeout=20000); page.wait_for_timeout(600)
    feats = page.evaluate("() => window.__attuneMap.queryRenderedFeatures().map((f) => f.sourceLayer || f.layer.id)")
    check("roads" in feats and "water" in feats, "the installed country map is drawn from the phone's file (roads, the Nile): %s" % sorted(set(feats))[:8])
    reads = [c for c in page.evaluate("window.__mapmock.calls") if c[0] == "read"]
    check(len(reads) >= 2 and all(r[1].endswith(".pmtiles") or r[1].startswith("assets/") for r in reads), "every byte came through the bridge (%d reads), nothing from the internet" % len(reads))
    check("offline map" in page.locator("[data-testid=map-mode]").inner_text(), "the search bar says it is the offline map")
    shot(page, "v722-map")

    # ---- search: the offline index, then pick and save ----
    page.fill("[data-testid=map-search]", "مدينه نصر"); page.press("[data-testid=map-search]", "Enter")
    page.wait_for_selector("[data-testid=map-hit]", timeout=8000)
    hit = page.locator("[data-testid=map-hit]").first.inner_text()
    check("Nasr City" in hit and "offline" in hit, "a place is found in the country's own index, with no signal needed: " + hit.replace("\n", " · "))
    page.locator("[data-testid=map-hit]").first.click()
    page.wait_for_selector("[data-testid=map-place]", timeout=3000)
    check(page.locator("[data-testid=map-found-pin]").count() == 1 and "Directions" in page.locator("[data-testid=map-place]").inner_text(), "the place card: pinned, with Directions")
    page.click("[data-testid=map-save-found]"); page.wait_for_timeout(200)
    check(any(p["name"] == "Nasr City" for p in page.evaluate("JSON.parse(localStorage.getItem('attune:map:v1')).places")), "saved to Your places")
    page.locator("[data-testid=map-place] button[aria-label=Close]").click(); page.wait_for_timeout(200)

    # ---- a category near the map's centre ----
    page.click("[data-testid=map-chip-fuel]")
    page.wait_for_selector("[data-testid=map-hit]", timeout=8000)
    s = [c for c in page.evaluate("window.__mapmock.calls") if c[0] == "search"][-1][1]
    check(s.get("kinds") == ["amenity/fuel"] and "Wataniya" in page.locator("[data-testid=map-hit]").first.inner_text(), "Fuel asks the index for fuel stations near the centre")
    page.locator("[data-testid=map-sheet] button:has-text('Close')").first.click(); page.wait_for_timeout(200)

    # ---- updates: a newer Egypt map is offered and installed ----
    page.click("[data-testid=map-tab-offline]")
    page.wait_for_selector("[data-testid=map-update-eg]", timeout=8000)
    t = page.locator("[data-testid=map-country-eg]").inner_text()
    check("2026-10-02" in t, "Egypt is on the phone with its data date: " + t.replace("\n", " · "))
    shot(page, "v722-offline")
    page.click("[data-testid=map-update-eg]")
    page.wait_for_selector("[data-testid=map-progress]", timeout=3000)
    check("%" in page.locator("[data-testid=map-progress]").inner_text(), "the update shows its progress")
    page.wait_for_function("() => !document.querySelector('[data-testid=map-progress]')", timeout=8000)
    check("2026-10-09" in page.locator("[data-testid=map-country-eg]").inner_text() and page.locator("[data-testid=map-update-eg]").count() == 0, "after the update: the new data date, no update button")

    # ---- a whole new country in one tap ----
    page.click("[data-testid=map-dl-tr]")
    page.wait_for_function("() => (window.__mapmock.installed || []).some((x) => x.code === 'tr')", timeout=8000); page.wait_for_timeout(300)
    check("2026-10-09" in page.locator("[data-testid=map-country-tr]").inner_text(), "Turkey downloads in one tap and is listed as on the phone")
    page.click("[data-testid=map-remove-eg]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=map-dl-eg]").count() == 1, "a country map can be deleted (and downloaded again)")

    # ---- Arabic ----
    page.evaluate("localStorage.setItem('attune:ui:lang', 'ar')"); page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('الخرائط')").first.click()
    page.wait_for_selector("[data-testid=map-page]", timeout=8000)
    page.click("[data-testid=map-tab-offline]"); page.wait_for_timeout(300)
    t = page.locator("[data-testid=map-sheet]").inner_text()
    check("خرائط بدون إنترنت" in t and "تركيا" in t, "the sheet in Arabic: " + t.replace("\n", " · ")[:160])

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
