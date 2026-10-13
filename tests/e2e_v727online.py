"""v6.27 — a country's map shown ONLINE without downloading it (Ali: "streets and compounds everywhere online — and I don't
want to pay for maps"). Nothing is installed; the phone's mapRange (HTTP range requests to our free GitHub release) is
mocked with a tiny real vector map of central Cairo (tests/fixtures/cairo-mini.pmtiles).

  python3 tests/e2e_v727online.py
"""
import base64, json, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = base64.b64encode(open(os.path.join(HERE, "fixtures", "cairo-mini.pmtiles"), "rb").read()).decode()
env = Env(); errors = []
INIT = r"""
(() => { const S = window.__mapmock = { calls: [] };
  const raw = atob("%(fix)s"); const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.mapPacks = () => JSON.stringify({ packs: [], assets: false });
    N.mapRead = (a) => { S.calls.push(["read", JSON.parse(a).path]); return ""; };
    N.unmetered = () => false;   // mobile data: the world map must not download by itself
    const later = (id, v, ms) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), ms || 30);
    N.mapRange = (id, a) => { const o = JSON.parse(a); S.calls.push(["range", o.code, o.name, o.offset, o.length]);
      later(id, { b64: b64(bytes.subarray(o.offset, Math.min(bytes.length, o.offset + o.length))) }); };
    N.mapAssets = (id) => { S.calls.push(["assets"]); later(id, { assets: true }); };
    N.mapRemote = (id, a) => later(id, { code: JSON.parse(a).code, date: "2026-10-09", files: [{ name: "x.pmtiles", bytes: 1 }] });
    N.mapInstall = (id) => { S.calls.push(["install"]); };
  }; go(); })();""" % {"fix": FIX}

with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.on("dialog", lambda d: d.accept())
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("localStorage.setItem('attune:map:v1', JSON.stringify({ view: { lat: 30.05, lon: 31.25, z: 12 }, places: [] }))")
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Maps')").first.click()
    page.wait_for_selector("[data-testid=map-page]", timeout=8000)
    page.wait_for_function("() => window.__attuneMap && window.__attuneMap.isStyleLoaded()", timeout=30000)
    page.evaluate("window.__attuneMap.jumpTo({ center: [31.25, 30.05], zoom: 12 })")
    page.wait_for_function("() => (document.querySelector('[data-testid=map-mode]') || {}).innerText && document.querySelector('[data-testid=map-mode]').innerText.includes('online map')", timeout=15000)
    page.wait_for_function("() => window.__attuneMap.isStyleLoaded() && window.__attuneMap.areTilesLoaded()", timeout=20000); page.wait_for_timeout(800)
    feats = page.evaluate("() => window.__attuneMap.queryRenderedFeatures().map((f) => f.sourceLayer || f.layer.id)")
    check("roads" in feats, "with nothing downloaded, Cairo's streets are drawn online: %s" % sorted(set(feats))[:8])
    calls = page.evaluate("window.__mapmock.calls")
    ranges = [c for c in calls if c[0] == "range"]
    check(len(ranges) >= 2 and all(c[1] == "eg" and c[2] == "eg.pmtiles" for c in ranges), "every piece came from Egypt's published map through the phone (%d pieces)" % len(ranges))
    check(all(c[4] <= 4_000_000 for c in ranges), "only small pieces are asked for (largest %d bytes)" % max(c[4] for c in ranges))
    check(["assets"] in calls and not any(c[0] == "install" for c in calls), "only the fonts and icons are downloaded — never the whole country")
    mode = page.locator("[data-testid=map-mode]").inner_text()
    check("online map" in mode and "Egypt" in mode, "the search bar says: " + mode)
    check(page.locator("[data-testid=map-empty]").count() == 0, "no 'No map yet' box while the online map shows")
    page.click("[data-testid=map-open-offline]"); page.wait_for_selector("[data-testid=map-offline]", timeout=3000)
    check(page.locator("[data-testid=map-online-note]").count() == 1, "the country list says every country shows online without downloading")
    # no signal: nothing online, the empty state again
    page.evaluate("window.dispatchEvent(new Event('offline'))"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=map-empty]").count() == 1, "with no signal and nothing downloaded: 'No map on this device yet'")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
